// ============================================================
// GiLo AI – Public Rate Limiter
// Redis-backed IP-based sliding window rate limiter for public
// endpoints (subdomain chat, embeds, etc.)
// Falls back to in-memory when Redis is unavailable.
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { slidingWindowRateLimit, isRedisAvailable } from '../services/redisService';

// --------------- In-memory fallback ---------------

interface RateLimitEntry {
  timestamps: number[];
}

const memStore = new Map<string, RateLimitEntry>();

const LIMITS = {
  perMinute: parseInt(process.env.PUBLIC_RATE_LIMIT_PER_MINUTE || '30', 10),
  perDay: parseInt(process.env.PUBLIC_RATE_LIMIT_PER_DAY || '500', 10),
};

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Clean up old in-memory entries periodically (every 5 minutes)
setInterval(() => {
  const cutoff = Date.now() - DAY_MS;
  for (const [key, entry] of memStore.entries()) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) {
      memStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

function cleanTimestamps(timestamps: number[], windowMs: number): number[] {
  const cutoff = Date.now() - windowMs;
  return timestamps.filter(t => t > cutoff);
}

/**
 * Get client IP address, considering proxy headers.
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * In-memory fallback rate limit check.
 */
function checkMemoryRateLimit(
  minuteKey: string,
  dayKey: string,
): { allowed: boolean; remaining: number; resetAt: number; reason?: string } {
  const now = Date.now();

  let minuteEntry = memStore.get(minuteKey);
  if (!minuteEntry) {
    minuteEntry = { timestamps: [] };
    memStore.set(minuteKey, minuteEntry);
  }
  minuteEntry.timestamps = cleanTimestamps(minuteEntry.timestamps, MINUTE_MS);

  if (minuteEntry.timestamps.length >= LIMITS.perMinute) {
    const resetAt = minuteEntry.timestamps[0] + MINUTE_MS;
    return { allowed: false, remaining: 0, resetAt, reason: 'minute' };
  }

  let dayEntry = memStore.get(dayKey);
  if (!dayEntry) {
    dayEntry = { timestamps: [] };
    memStore.set(dayKey, dayEntry);
  }
  dayEntry.timestamps = cleanTimestamps(dayEntry.timestamps, DAY_MS);

  if (dayEntry.timestamps.length >= LIMITS.perDay) {
    const resetAt = dayEntry.timestamps[0] + DAY_MS;
    return { allowed: false, remaining: 0, resetAt, reason: 'day' };
  }

  minuteEntry.timestamps.push(now);
  dayEntry.timestamps.push(now);

  return {
    allowed: true,
    remaining: LIMITS.perMinute - minuteEntry.timestamps.length,
    resetAt: now + MINUTE_MS,
  };
}

/**
 * Public rate limiting middleware for subdomain endpoints.
 * Rate limits by client IP address (no API key required).
 * Uses Redis when available, falls back to in-memory.
 */
export async function publicRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const clientIp = getClientIp(req);
  const slug = (req as any).agentSlug || 'unknown';
  const now = Date.now();

  const minuteKeyBase = `pub:min:${clientIp}:${slug}`;
  const dayKeyBase = `pub:day:${clientIp}:${slug}`;

  if (isRedisAvailable()) {
    // ---- Redis path ----
    const minuteKey = `rl:${minuteKeyBase}`;
    const dayKey = `rl:${dayKeyBase}`;

    const [minuteResult, dayResult] = await Promise.all([
      slidingWindowRateLimit(minuteKey, LIMITS.perMinute, MINUTE_MS),
      slidingWindowRateLimit(dayKey, LIMITS.perDay, DAY_MS),
    ]);

    if (!minuteResult.allowed) {
      const resetAt = minuteResult.resetAt;
      res.set({
        'X-RateLimit-Limit': String(LIMITS.perMinute),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
        'Retry-After': String(Math.ceil((resetAt - now) / 1000)),
      });
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Maximum ${LIMITS.perMinute} requests per minute. Please try again later.`,
        retryAfter: Math.ceil((resetAt - now) / 1000),
      });
      return;
    }

    if (!dayResult.allowed) {
      const resetAt = dayResult.resetAt;
      res.set({
        'X-RateLimit-Limit': String(LIMITS.perDay),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
      });
      res.status(429).json({
        error: 'Daily rate limit exceeded',
        message: `Maximum ${LIMITS.perDay} requests per day. Please try again tomorrow.`,
        retryAfter: Math.ceil((resetAt - now) / 1000),
      });
      return;
    }

    res.set({
      'X-RateLimit-Limit': String(LIMITS.perMinute),
      'X-RateLimit-Remaining': String(minuteResult.remaining),
      'X-RateLimit-Policy': `${LIMITS.perMinute};w=60, ${LIMITS.perDay};w=86400`,
    });
    return next();
  }

  // ---- In-memory fallback ----
  const result = checkMemoryRateLimit(minuteKeyBase, dayKeyBase);

  if (!result.allowed) {
    const limitValue = result.reason === 'day' ? LIMITS.perDay : LIMITS.perMinute;
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
      message: result.reason === 'day'
        ? `Maximum ${LIMITS.perDay} requests per day. Please try again tomorrow.`
        : `Maximum ${LIMITS.perMinute} requests per minute. Please try again later.`,
      retryAfter: Math.ceil((result.resetAt - now) / 1000),
    });
    return;
  }

  res.set({
    'X-RateLimit-Limit': String(LIMITS.perMinute),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Policy': `${LIMITS.perMinute};w=60, ${LIMITS.perDay};w=86400`,
  });

  next();
}
