// ============================================================
// GiLo AI – API Key Model
// Manages API keys for public agent endpoints
// ============================================================

import { eq, and, isNull } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';
import { getDb } from '../db';
import { apiKeys } from '../db/schema';

// ---- Types ----

export interface ApiKey {
  id: string;
  agentId: string;
  userId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  lastUsedAt: Date | null;
  requestCount: number;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface ApiKeyResponse {
  id: string;
  agentId: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: Date | null;
  requestCount: number;
  createdAt: Date;
  revoked: boolean;
}

export interface ApiKeyCreateResult {
  apiKey: ApiKeyResponse;
  rawKey: string; // Only returned once at creation time
}

// ---- Helpers ----

/**
 * Generate a new API key: gilo_<32 random hex chars>
 */
function generateRawKey(): string {
  return `gilo_${randomBytes(24).toString('hex')}`;
}

/**
 * Hash an API key with SHA-256
 */
function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

// ---- Model ----

class ApiKeyModel {

  /**
   * Create a new API key for an agent
   */
  async create(agentId: string, userId: string, name: string): Promise<ApiKeyCreateResult> {
    const db = getDb();
    const rawKey = generateRawKey();
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 12); // "gilo_xxxxxxx"

    const [row] = await db.insert(apiKeys).values({
      agentId,
      userId,
      name,
      keyHash,
      keyPrefix,
    }).returning();

    return {
      apiKey: this.toResponse(row as unknown as ApiKey),
      rawKey,
    };
  }

  /**
   * List active (non-revoked) API keys for an agent
   */
  async findByAgentId(agentId: string): Promise<ApiKey[]> {
    const db = getDb();
    const rows = await db.select().from(apiKeys)
      .where(and(
        eq(apiKeys.agentId, agentId),
        isNull(apiKeys.revokedAt),
      ))
      .orderBy(apiKeys.createdAt);
    return rows as unknown as ApiKey[];
  }

  /**
   * Validate a raw API key and return the associated agent ID
   * Also updates lastUsedAt and requestCount
   */
  async validate(rawKey: string): Promise<{ agentId: string; userId: string; keyId: string } | null> {
    const db = getDb();
    const keyHash = hashKey(rawKey);

    const [row] = await db.select().from(apiKeys)
      .where(and(
        eq(apiKeys.keyHash, keyHash),
        isNull(apiKeys.revokedAt),
      ))
      .limit(1);

    if (!row) return null;

    // Update usage stats
    await db.update(apiKeys)
      .set({
        lastUsedAt: new Date(),
        requestCount: (row.requestCount ?? 0) + 1,
      })
      .where(eq(apiKeys.id, row.id));

    return {
      agentId: row.agentId,
      userId: row.userId,
      keyId: row.id,
    };
  }

  /**
   * Revoke an API key
   */
  async revoke(keyId: string, userId: string): Promise<boolean> {
    const db = getDb();
    const result = await db.update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(apiKeys.id, keyId),
        eq(apiKeys.userId, userId),
      ))
      .returning();
    return result.length > 0;
  }

  /**
   * Delete all API keys for an agent
   */
  async deleteByAgentId(agentId: string): Promise<void> {
    const db = getDb();
    await db.delete(apiKeys).where(eq(apiKeys.agentId, agentId));
  }

  /**
   * Convert DB row to safe response (no hash)
   */
  toResponse(row: ApiKey): ApiKeyResponse {
    return {
      id: row.id,
      agentId: row.agentId,
      name: row.name,
      keyPrefix: row.keyPrefix,
      lastUsedAt: row.lastUsedAt,
      requestCount: row.requestCount,
      createdAt: row.createdAt,
      revoked: row.revokedAt !== null,
    };
  }
}

export const apiKeyModel = new ApiKeyModel();
