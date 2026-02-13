// ============================================================
// GiLo AI – Daily Message Quota Middleware
// Enforces per-agent daily message limits:
//   Free tier  → 200 messages/day/agent
//   Paid/Pro   → 500 messages/day/agent
//   BYO LLM   → unlimited (costs us $0)
// Uses Redis INCR with TTL, in-memory fallback.
// ============================================================

import { getRedis, isRedisAvailable } from '../services/redisService';

// --------------- Quota limits ---------------
const DAILY_LIMITS: Record<string, number> = {
  free: 200,
  pro: 500,
  paid: 500,
};

// --------------- In-memory fallback ---------------
// Map<"agentId:YYYY-MM-DD", count>
const memQuota = new Map<string, { count: number; resetAt: number }>();

// Clean expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memQuota.entries()) {
    if (now > entry.resetAt) memQuota.delete(key);
  }
}, 10 * 60 * 1000);

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function msUntilMidnightUTC(): number {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return tomorrow.getTime() - now.getTime();
}

export interface QuotaResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number; // epoch ms
}

/**
 * Check and increment the daily message quota for an agent.
 * @param agentId - The agent ID
 * @param ownerTier - The agent owner's tier ('free' | 'pro' | 'paid')
 * @param isByo - Whether the agent uses BYO LLM (unlimited)
 */
export async function checkMessageQuota(
  agentId: string,
  ownerTier: string,
  isByo: boolean,
): Promise<QuotaResult> {
  // BYO LLM → unlimited (costs us nothing)
  if (isByo) {
    return { allowed: true, remaining: Infinity, limit: Infinity, resetAt: 0 };
  }

  const limit = DAILY_LIMITS[ownerTier] || DAILY_LIMITS.free;
  const day = todayKey();
  const ttlMs = msUntilMidnightUTC();
  const resetAt = Date.now() + ttlMs;

  if (isRedisAvailable()) {
    return checkRedisQuota(agentId, day, limit, ttlMs, resetAt);
  }

  return checkMemoryQuota(agentId, day, limit, resetAt);
}

/**
 * Get current usage without incrementing.
 */
export async function getMessageUsage(
  agentId: string,
): Promise<{ used: number; day: string }> {
  const day = todayKey();
  const redisKey = `msgquota:${agentId}:${day}`;

  if (isRedisAvailable()) {
    const r = getRedis()!;
    try {
      const val = await r.get(redisKey);
      return { used: val ? parseInt(val, 10) : 0, day };
    } catch {
      // fallback
    }
  }

  const memKey = `${agentId}:${day}`;
  const entry = memQuota.get(memKey);
  return { used: entry?.count || 0, day };
}

// --------------- Redis implementation ---------------
async function checkRedisQuota(
  agentId: string,
  day: string,
  limit: number,
  ttlMs: number,
  resetAt: number,
): Promise<QuotaResult> {
  const r = getRedis()!;
  const key = `msgquota:${agentId}:${day}`;

  try {
    // Atomic check-and-increment via Lua
    const luaScript = `
      local current = tonumber(redis.call('GET', KEYS[1]) or '0')
      if current >= tonumber(ARGV[1]) then
        return {0, current}
      end
      local newVal = redis.call('INCR', KEYS[1])
      if newVal == 1 then
        redis.call('PEXPIRE', KEYS[1], ARGV[2])
      end
      return {1, newVal}
    `;

    const result = await r.eval(luaScript, 1, key, String(limit), String(ttlMs)) as number[];
    const allowed = result[0] === 1;
    const count = result[1];

    return {
      allowed,
      remaining: Math.max(0, limit - count),
      limit,
      resetAt,
    };
  } catch (err) {
    console.error('Redis message quota error:', err);
    // Fail open
    return { allowed: true, remaining: limit, limit, resetAt };
  }
}

// --------------- In-memory implementation ---------------
function checkMemoryQuota(
  agentId: string,
  day: string,
  limit: number,
  resetAt: number,
): QuotaResult {
  const memKey = `${agentId}:${day}`;
  let entry = memQuota.get(memKey);

  if (!entry) {
    entry = { count: 0, resetAt };
    memQuota.set(memKey, entry);
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, limit, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: Math.max(0, limit - entry.count),
    limit,
    resetAt: entry.resetAt,
  };
}
