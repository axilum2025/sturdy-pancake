// ============================================================
// GiLo AI – Public Rate Limiter
// IP-based sliding window rate limiter for public endpoints
// (subdomain chat, embeds, etc.)
// ============================================================

import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  timestamps: number[];
}

// In-memory store (per-process). For multi-instance deployments,
// replace with Redis-backed store.
const store = new Map<string, RateLimitEntry>();

const LIMITS = {
  perMinute: parseInt(process.env.PUBLIC_RATE_LIMIT_PER_MINUTE || '30', 10),
  perDay: parseInt(process.env.PUBLIC_RATE_LIMIT_PER_DAY || '500', 10),
};

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Clean up old entries periodically (every 5 minutes)
setInterval(() => {
  const cutoff = Date.now() - DAY_MS;
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) {
      store.delete(key);
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
 * Public rate limiting middleware for subdomain endpoints.
 * Rate limits by client IP address (no API key required).
 */
export function publicRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const clientIp = getClientIp(req);
  const slug = (req as any).agentSlug || 'unknown';
  const now = Date.now();

  // Rate limit per IP + agent slug combo
  const minuteKey = `pub:min:${clientIp}:${slug}`;
  const dayKey = `pub:day:${clientIp}:${slug}`;

  // --- Per-minute check ---
  let minuteEntry = store.get(minuteKey);
  if (!minuteEntry) {
    minuteEntry = { timestamps: [] };
    store.set(minuteKey, minuteEntry);
  }
  minuteEntry.timestamps = cleanTimestamps(minuteEntry.timestamps, MINUTE_MS);

  if (minuteEntry.timestamps.length >= LIMITS.perMinute) {
    const resetAt = minuteEntry.timestamps[0] + MINUTE_MS;
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

  // --- Per-day check ---
  let dayEntry = store.get(dayKey);
  if (!dayEntry) {
    dayEntry = { timestamps: [] };
    store.set(dayKey, dayEntry);
  }
  dayEntry.timestamps = cleanTimestamps(dayEntry.timestamps, DAY_MS);

  if (dayEntry.timestamps.length >= LIMITS.perDay) {
    const resetAt = dayEntry.timestamps[0] + DAY_MS;
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

  // Record the request
  minuteEntry.timestamps.push(now);
  dayEntry.timestamps.push(now);

  // Set rate limit headers
  res.set({
    'X-RateLimit-Limit': String(LIMITS.perMinute),
    'X-RateLimit-Remaining': String(LIMITS.perMinute - minuteEntry.timestamps.length),
    'X-RateLimit-Policy': `${LIMITS.perMinute};w=60, ${LIMITS.perDay};w=86400`,
  });

  next();
}
