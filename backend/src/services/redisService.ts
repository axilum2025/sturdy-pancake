// ============================================================
// GiLo AI – Redis Service
// Centralized Redis client with connection management,
// rate limiting helpers, and generic cache operations.
// Falls back to in-memory store when Redis is unavailable.
// ============================================================

import Redis from 'ioredis';

// --------------- Connection ---------------

let redis: Redis | null = null;
let isConnected = false;

/**
 * Initialize the Redis connection. Call once at startup.
 * Silent fail: if REDIS_URL is not set or connection fails,
 * the service degrades gracefully to in-memory.
 */
export async function initRedis(): Promise<void> {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('⚠️  REDIS_URL not set — falling back to in-memory stores');
    return;
  }

  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 10) return null; // stop retrying
        return Math.min(times * 200, 5000);
      },
      lazyConnect: true,
    });

    redis.on('connect', () => {
      isConnected = true;
      console.log('✅ Redis connected');
    });

    redis.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
      isConnected = false;
    });

    redis.on('close', () => {
      isConnected = false;
    });

    await redis.connect();
  } catch (err: any) {
    console.warn('⚠️  Redis connection failed — falling back to in-memory:', err.message);
    redis = null;
    isConnected = false;
  }
}

/**
 * Get the raw Redis client (may be null if unavailable).
 */
export function getRedis(): Redis | null {
  return isConnected ? redis : null;
}

/**
 * Check whether Redis is available.
 */
export function isRedisAvailable(): boolean {
  return isConnected && redis !== null;
}

/**
 * Gracefully close the Redis connection.
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    isConnected = false;
    console.log('🔌 Redis disconnected');
  }
}

// --------------- Rate Limiting (Sliding Window) ---------------

/**
 * Sliding window rate limit check + increment using Redis sorted sets.
 * Returns { allowed, remaining, resetAt, total }.
 *
 * Algorithm:
 *  - Key is a sorted set where score = timestamp, member = unique id.
 *  - ZREMRANGEBYSCORE removes expired entries.
 *  - ZCARD counts current window entries.
 *  - If under limit, ZADD the new entry and EXPIRE the key.
 */
export async function slidingWindowRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number; total: number }> {
  const r = getRedis();
  if (!r) {
    // Fallback: always allow (in-memory rate limiter still runs)
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs, total: 0 };
  }

  const now = Date.now();
  const windowStart = now - windowMs;
  const uniqueMember = `${now}:${Math.random().toString(36).slice(2, 8)}`;

  // Lua script for atomicity
  const luaScript = `
    redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
    local count = redis.call('ZCARD', KEYS[1])
    if count < tonumber(ARGV[2]) then
      redis.call('ZADD', KEYS[1], ARGV[3], ARGV[4])
      redis.call('PEXPIRE', KEYS[1], ARGV[5])
      return {1, tonumber(ARGV[2]) - count - 1, count + 1}
    else
      local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
      local resetAt = 0
      if #oldest >= 2 then
        resetAt = tonumber(oldest[2]) + tonumber(ARGV[5])
      end
      return {0, 0, count, resetAt}
    end
  `;

  try {
    const result = await r.eval(
      luaScript,
      1,
      key,
      String(windowStart),
      String(limit),
      String(now),
      uniqueMember,
      String(windowMs),
    ) as number[];

    const allowed = result[0] === 1;
    const remaining = result[1];
    const total = result[2];
    const resetAt = allowed ? now + windowMs : (result[3] || now + windowMs);

    return { allowed, remaining, resetAt, total };
  } catch (err) {
    console.error('Redis rate limit error:', err);
    // Fail open: allow the request
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs, total: 0 };
  }
}

// --------------- Generic Cache ---------------

// In-memory fallback cache
const memCache = new Map<string, { value: string; expiresAt: number }>();

/**
 * Get a cached value. Checks Redis first, falls back to in-memory.
 */
export async function cacheGet<T = any>(key: string): Promise<T | null> {
  const r = getRedis();
  if (r) {
    try {
      const val = await r.get(key);
      return val ? JSON.parse(val) : null;
    } catch {
      // fall through to memory
    }
  }

  const entry = memCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return JSON.parse(entry.value);
  }
  memCache.delete(key);
  return null;
}

/**
 * Set a cached value with TTL in seconds.
 */
export async function cacheSet(key: string, value: any, ttlSeconds: number): Promise<void> {
  const serialized = JSON.stringify(value);

  const r = getRedis();
  if (r) {
    try {
      await r.set(key, serialized, 'EX', ttlSeconds);
      return;
    } catch {
      // fall through to memory
    }
  }

  memCache.set(key, {
    value: serialized,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Delete a cached key.
 */
export async function cacheDel(key: string): Promise<void> {
  const r = getRedis();
  if (r) {
    try {
      await r.del(key);
    } catch { /* ignore */ }
  }
  memCache.delete(key);
}

/**
 * Delete all keys matching a pattern (e.g. "cache:store:*").
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  const r = getRedis();
  if (r) {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await r.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await r.del(...keys);
        }
      } while (cursor !== '0');
    } catch { /* ignore */ }
  }

  // Clear matching in-memory keys
  for (const k of memCache.keys()) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    if (regex.test(k)) {
      memCache.delete(k);
    }
  }
}

// Periodic cleanup of expired in-memory entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memCache.entries()) {
    if (entry.expiresAt <= now) {
      memCache.delete(key);
    }
  }
}, 60 * 1000);
