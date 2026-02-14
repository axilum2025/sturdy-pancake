// ============================================================
// GiLo AI – Chat Abuse Detection & Per-User Message Quotas
// Prevents abuse:
//   1. Store "Use this Agent" → 10 messages per IP per agent (test only)
//   2. Copilot chat → per-user daily limits + spam/abuse detection
// Uses Redis when available, in-memory fallback.
// ============================================================

import { getRedis, isRedisAvailable } from '../services/redisService';

// ======================== STORE CHAT (per-IP) ========================

const STORE_SESSION_LIMIT = 10; // max messages per IP per agent

// In-memory: Map<"ip:agentId", { count, resetAt }>
const storeSessionMem = new Map<string, { count: number; resetAt: number }>();

// Clean every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of storeSessionMem.entries()) {
    if (now > entry.resetAt) storeSessionMem.delete(key);
  }
}, 10 * 60 * 1000);

export interface StoreSessionResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  message?: string;
}

/**
 * Check per-IP session limit for store agent testing.
 * Resets every 24h per IP+agent pair.
 */
export async function checkStoreSessionLimit(
  clientIp: string,
  agentId: string,
): Promise<StoreSessionResult> {
  const limit = STORE_SESSION_LIMIT;
  const ttlMs = 24 * 60 * 60 * 1000; // 24h

  if (isRedisAvailable()) {
    return checkStoreRedis(clientIp, agentId, limit, ttlMs);
  }
  return checkStoreMem(clientIp, agentId, limit, ttlMs);
}

async function checkStoreRedis(
  ip: string,
  agentId: string,
  limit: number,
  ttlMs: number,
): Promise<StoreSessionResult> {
  const r = getRedis()!;
  const key = `store:session:${ip}:${agentId}`;

  try {
    const lua = `
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
    const result = await r.eval(lua, 1, key, String(limit), String(ttlMs)) as number[];
    const allowed = result[0] === 1;
    const count = result[1];
    return {
      allowed,
      remaining: Math.max(0, limit - count),
      limit,
      message: allowed ? undefined : `You've reached the ${limit} message test limit for this agent. Create your own agent to chat without limits!`,
    };
  } catch (err) {
    console.error('Redis store session error:', err);
    return { allowed: true, remaining: limit, limit };
  }
}

function checkStoreMem(
  ip: string,
  agentId: string,
  limit: number,
  ttlMs: number,
): StoreSessionResult {
  const key = `${ip}:${agentId}`;
  let entry = storeSessionMem.get(key);

  if (!entry || Date.now() > entry.resetAt) {
    entry = { count: 0, resetAt: Date.now() + ttlMs };
    storeSessionMem.set(key, entry);
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      message: `You've reached the ${limit} message test limit for this agent. Create your own agent to chat without limits!`,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: Math.max(0, limit - entry.count),
    limit,
  };
}

// ======================== COPILOT CHAT (per-user) ========================

// Daily message limits per tier
const COPILOT_DAILY_LIMITS: Record<string, number> = {
  free: 100,
  pro: 500,
  byo: 1000,
};

// Abuse detection thresholds
const ABUSE_THRESHOLDS = {
  maxMessageLength: 15000,       // chars per message
  rapidFireWindowMs: 10_000,     // 10 seconds
  rapidFireMaxMessages: 5,       // max messages in that window
  maxMessagesPerConversation: 200, // unusually long conversation
};

// In-memory: Map<"userId:YYYY-MM-DD", { count, resetAt }>
const copilotDailyMem = new Map<string, { count: number; resetAt: number }>();
// In-memory: Map<"userId", timestamps[]> for rapid fire detection
const copilotRapidMem = new Map<string, number[]>();

// Clean every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of copilotDailyMem.entries()) {
    if (now > entry.resetAt) copilotDailyMem.delete(key);
  }
  for (const [key, timestamps] of copilotRapidMem.entries()) {
    const recent = timestamps.filter(t => now - t < 60_000);
    if (recent.length === 0) copilotRapidMem.delete(key);
    else copilotRapidMem.set(key, recent);
  }
}, 10 * 60 * 1000);

export interface CopilotQuotaResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
  blocked?: boolean;
  reason?: string;
  message?: string;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function msUntilMidnightUTC(): number {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return tomorrow.getTime() - now.getTime();
}

/**
 * Check abuse patterns and daily quota for copilot chat.
 */
export async function checkCopilotQuota(
  userId: string,
  userTier: string,
  messageContent?: string,
  conversationMessageCount?: number,
): Promise<CopilotQuotaResult> {
  const now = Date.now();
  const limit = COPILOT_DAILY_LIMITS[userTier] || COPILOT_DAILY_LIMITS.free;
  const resetAt = now + msUntilMidnightUTC();

  // --- Abuse check 1: message too long ---
  if (messageContent && messageContent.length > ABUSE_THRESHOLDS.maxMessageLength) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      resetAt,
      blocked: true,
      reason: 'message_too_long',
      message: `Message too long (${messageContent.length} chars). Maximum is ${ABUSE_THRESHOLDS.maxMessageLength} characters.`,
    };
  }

  // --- Abuse check 2: rapid fire ---
  let timestamps = copilotRapidMem.get(userId) || [];
  timestamps = timestamps.filter(t => now - t < ABUSE_THRESHOLDS.rapidFireWindowMs);
  if (timestamps.length >= ABUSE_THRESHOLDS.rapidFireMaxMessages) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      resetAt,
      blocked: true,
      reason: 'rapid_fire',
      message: 'Too many messages sent too quickly. Please slow down.',
    };
  }
  timestamps.push(now);
  copilotRapidMem.set(userId, timestamps);

  // --- Abuse check 3: conversation too long ---
  if (conversationMessageCount && conversationMessageCount > ABUSE_THRESHOLDS.maxMessagesPerConversation) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      resetAt,
      blocked: true,
      reason: 'conversation_too_long',
      message: `This conversation has ${conversationMessageCount} messages. Please start a new conversation.`,
    };
  }

  // --- Daily quota ---
  const day = todayKey();
  const ttlMs = msUntilMidnightUTC();

  if (isRedisAvailable()) {
    return checkCopilotRedis(userId, day, limit, ttlMs, resetAt);
  }
  return checkCopilotMem(userId, day, limit, resetAt);
}

async function checkCopilotRedis(
  userId: string,
  day: string,
  limit: number,
  ttlMs: number,
  resetAt: number,
): Promise<CopilotQuotaResult> {
  const r = getRedis()!;
  const key = `copilot:daily:${userId}:${day}`;

  try {
    const lua = `
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
    const result = await r.eval(lua, 1, key, String(limit), String(ttlMs)) as number[];
    const allowed = result[0] === 1;
    const count = result[1];
    return {
      allowed,
      remaining: Math.max(0, limit - count),
      limit,
      resetAt,
      reason: allowed ? undefined : 'daily_limit',
      message: allowed ? undefined : `You've reached your daily limit of ${limit} messages. Resets at midnight UTC.`,
    };
  } catch (err) {
    console.error('Redis copilot quota error:', err);
    return { allowed: true, remaining: limit, limit, resetAt };
  }
}

function checkCopilotMem(
  userId: string,
  day: string,
  limit: number,
  resetAt: number,
): CopilotQuotaResult {
  const key = `${userId}:${day}`;
  let entry = copilotDailyMem.get(key);

  if (!entry) {
    entry = { count: 0, resetAt };
    copilotDailyMem.set(key, entry);
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      resetAt: entry.resetAt,
      reason: 'daily_limit',
      message: `You've reached your daily limit of ${limit} messages. Resets at midnight UTC.`,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: Math.max(0, limit - entry.count),
    limit,
    resetAt: entry.resetAt,
  };
}

/**
 * Get current copilot usage (without incrementing).
 */
export async function getCopilotUsage(
  userId: string,
  userTier: string,
): Promise<{ used: number; limit: number; remaining: number }> {
  const limit = COPILOT_DAILY_LIMITS[userTier] || COPILOT_DAILY_LIMITS.free;
  const day = todayKey();
  const key = `copilot:daily:${userId}:${day}`;

  if (isRedisAvailable()) {
    const r = getRedis()!;
    try {
      const val = await r.get(key);
      const used = val ? parseInt(val, 10) : 0;
      return { used, limit, remaining: Math.max(0, limit - used) };
    } catch { /* fallback */ }
  }

  const memKey = `${userId}:${day}`;
  const entry = copilotDailyMem.get(memKey);
  const used = entry?.count || 0;
  return { used, limit, remaining: Math.max(0, limit - used) };
}
