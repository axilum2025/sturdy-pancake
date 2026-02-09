// ============================================================
// GiLo AI – Rate Limiting Middleware
// In-memory sliding window rate limiter per API key
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { ApiKeyRequest } from './apiKeyAuth';

interface RateLimitEntry {
  timestamps: number[]; // timestamps of requests within the current window
}

// In-memory store (per-process). For multi-instance deployments,
// replace with Redis-backed store.
const store = new Map<string, RateLimitEntry>();

// Tier limits
const TIER_LIMITS: Record<string, { perMinute: number; perDay: number }> = {
  free: { perMinute: 60, perDay: 1000 },
  pro: { perMinute: 300, perDay: 10000 },
};

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function cleanTimestamps(timestamps: number[], windowMs: number): number[] {
  const cutoff = Date.now() - windowMs;
  return timestamps.filter(t => t > cutoff);
}

/**
 * Rate limiting middleware for API key-authenticated endpoints.
 * Uses a sliding window algorithm.
 */
export const rateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const apiReq = req as ApiKeyRequest;
  const keyId = apiReq.apiKeyId;
  const tier = apiReq.agentTier || 'free';
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

  const now = Date.now();
  const minuteKey = `min:${keyId}`;
  const dayKey = `day:${keyId}`;

  // --- Per-minute check ---
  let minuteEntry = store.get(minuteKey);
  if (!minuteEntry) {
    minuteEntry = { timestamps: [] };
    store.set(minuteKey, minuteEntry);
  }
  minuteEntry.timestamps = cleanTimestamps(minuteEntry.timestamps, MINUTE_MS);

  if (minuteEntry.timestamps.length >= limits.perMinute) {
    const resetAt = minuteEntry.timestamps[0] + MINUTE_MS;
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

  // --- Per-day check ---
  let dayEntry = store.get(dayKey);
  if (!dayEntry) {
    dayEntry = { timestamps: [] };
    store.set(dayKey, dayEntry);
  }
  dayEntry.timestamps = cleanTimestamps(dayEntry.timestamps, DAY_MS);

  if (dayEntry.timestamps.length >= limits.perDay) {
    const resetAt = dayEntry.timestamps[0] + DAY_MS;
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

  // Record the request
  minuteEntry.timestamps.push(now);
  dayEntry.timestamps.push(now);

  // Set rate limit headers
  const remaining = limits.perMinute - minuteEntry.timestamps.length;
  const resetAt = now + MINUTE_MS;
  res.set({
    'X-RateLimit-Limit': String(limits.perMinute),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
  });

  next();
};

/**
 * Periodically clean up old entries to prevent memory leaks.
 */
setInterval(() => {
  const cutoff = Date.now() - DAY_MS;
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}, 5 * MINUTE_MS); // Clean every 5 minutes
