// ============================================================
// GiLo AI – Rate Limiting Middleware
// Redis-backed sliding window rate limiter per API key
// Falls back to in-memory when Redis is unavailable.
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { ApiKeyRequest } from './apiKeyAuth';
import { slidingWindowRateLimit, isRedisAvailable } from '../services/redisService';

// --------------- In-memory fallback ---------------

interface RateLimitEntry {
  timestamps: number[];
}

const memStore = new Map<string, RateLimitEntry>();

// Tier limits (tight to minimise LLM costs)
const TIER_LIMITS: Record<string, { perMinute: number; perDay: number }> = {
  free: { perMinute: 10, perDay: 200 },
  pro: { perMinute: 60, perDay: 2000 },
};

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function cleanTimestamps(timestamps: number[], windowMs: number): number[] {
  const cutoff = Date.now() - windowMs;
  return timestamps.filter(t => t > cutoff);
}

/**
 * In-memory fallback rate limit check.
 */
function checkMemoryRateLimit(
  keyId: string,
  limits: { perMinute: number; perDay: number },
): { allowed: boolean; remaining: number; resetAt: number; reason?: string } {
  const now = Date.now();
  const minuteKey = `min:${keyId}`;
  const dayKey = `day:${keyId}`;

  // Per-minute
  let minuteEntry = memStore.get(minuteKey);
  if (!minuteEntry) {
    minuteEntry = { timestamps: [] };
    memStore.set(minuteKey, minuteEntry);
  }
  minuteEntry.timestamps = cleanTimestamps(minuteEntry.timestamps, MINUTE_MS);

  if (minuteEntry.timestamps.length >= limits.perMinute) {
    const resetAt = minuteEntry.timestamps[0] + MINUTE_MS;
    return { allowed: false, remaining: 0, resetAt, reason: 'minute' };
  }

  // Per-day
  let dayEntry = memStore.get(dayKey);
  if (!dayEntry) {
    dayEntry = { timestamps: [] };
    memStore.set(dayKey, dayEntry);
  }
  dayEntry.timestamps = cleanTimestamps(dayEntry.timestamps, DAY_MS);

  if (dayEntry.timestamps.length >= limits.perDay) {
    const resetAt = dayEntry.timestamps[0] + DAY_MS;
    return { allowed: false, remaining: 0, resetAt, reason: 'day' };
  }

  // Record
  minuteEntry.timestamps.push(now);
  dayEntry.timestamps.push(now);
  const remaining = limits.perMinute - minuteEntry.timestamps.length;
  return { allowed: true, remaining, resetAt: now + MINUTE_MS };
}

/**
 * Rate limiting middleware for API key-authenticated endpoints.
 * Uses Redis sliding window (sorted sets) with in-memory fallback.
 */
export const rateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const apiReq = req as ApiKeyRequest;
  const keyId = apiReq.apiKeyId;
  const tier = apiReq.agentTier || 'free';
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
  const now = Date.now();

  if (isRedisAvailable()) {
    // ---- Redis path ----
    const minuteKey = `rl:api:min:${keyId}`;
    const dayKey = `rl:api:day:${keyId}`;

    const [minuteResult, dayResult] = await Promise.all([
      slidingWindowRateLimit(minuteKey, limits.perMinute, MINUTE_MS),
      slidingWindowRateLimit(dayKey, limits.perDay, DAY_MS),
    ]);

    if (!minuteResult.allowed) {
      const resetAt = minuteResult.resetAt;
      res.set({
        'X-RateLimit-Limit': String(limits.perMinute),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
        'Retry-After': String(Math.ceil((resetAt - now) / 1000)),
      });
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: `${tier} tier allows ${limits.perMinute} requests per minute.`,
        retryAfter: Math.ceil((resetAt - now) / 1000),
      });
      return;
    }

    if (!dayResult.allowed) {
      const resetAt = dayResult.resetAt;
      res.set({
        'X-RateLimit-Limit': String(limits.perDay),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
      });
      res.status(429).json({
        error: 'Daily rate limit exceeded',
        message: `${tier} tier allows ${limits.perDay} requests per day.`,
        retryAfter: Math.ceil((resetAt - now) / 1000),
      });
      return;
    }

    res.set({
      'X-RateLimit-Limit': String(limits.perMinute),
      'X-RateLimit-Remaining': String(minuteResult.remaining),
      'X-RateLimit-Reset': String(Math.ceil(minuteResult.resetAt / 1000)),
    });
    return next();
  }

  // ---- In-memory fallback ----
  const result = checkMemoryRateLimit(keyId, limits);

  if (!result.allowed) {
    const limitValue = result.reason === 'day' ? limits.perDay : limits.perMinute;
    const windowLabel = result.reason === 'day' ? 'day' : 'minute';
    res.set({
      'X-RateLimit-Limit': String(limitValue),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      ...(result.reason === 'minute' && {
        'Retry-After': String(Math.ceil((result.resetAt - now) / 1000)),
      }),
    });
    res.status(429).json({
      error: result.reason === 'day' ? 'Daily rate limit exceeded' : 'Rate limit exceeded',
      message: `${tier} tier allows ${limitValue} requests per ${windowLabel}.`,
      retryAfter: Math.ceil((result.resetAt - now) / 1000),
    });
    return;
  }

  res.set({
    'X-RateLimit-Limit': String(limits.perMinute),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  });

  next();
};

/**
 * Periodically clean up old in-memory entries to prevent memory leaks.
 */
setInterval(() => {
  const cutoff = Date.now() - DAY_MS;
  for (const [key, entry] of memStore.entries()) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) {
      memStore.delete(key);
    }
  }
}, 5 * MINUTE_MS);
