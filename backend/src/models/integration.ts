// ============================================================
// GiLo AI – Integration Model
// CRUD for OAuth / API Key integrations per agent
// ============================================================

import { eq, and } from 'drizzle-orm';
import { getDb } from '../db';
import { integrations, IntegrationProvider, IntegrationStatus } from '../db/schema';

// ---- Types ----

export interface Integration {
  id: string;
  agentId: string;
  userId: string;
  provider: string;
  label: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  scopes: string[];
  expiresAt: Date | null;
  status: string;
  metadata: Record<string, unknown> | null;
  lastUsedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrationResponse {
  id: string;
  agentId: string;
  provider: string;
  label: string | null;
  scopes: string[];
  expiresAt: Date | null;
  status: string;
  metadata: {
    email?: string;
    accountName?: string;
    avatarUrl?: string;
    // Do NOT expose apiKey or tokens in response
  } | null;
  lastUsedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
}

export interface IntegrationCreateDTO {
  provider: string;
  label?: string;
  accessToken?: string;
  refreshToken?: string;
  scopes?: string[];
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface IntegrationUpdateDTO {
  label?: string;
  accessToken?: string;
  refreshToken?: string;
  scopes?: string[];
  expiresAt?: Date;
  status?: IntegrationStatus;
  metadata?: Record<string, unknown>;
  errorMessage?: string | null;
}

// ---- Model ----

class IntegrationModel {

  /**
   * Create a new integration for an agent
   */
  async create(agentId: string, userId: string, dto: IntegrationCreateDTO): Promise<IntegrationResponse> {
    const db = getDb();
    const [row] = await db.insert(integrations).values({
      agentId,
      userId,
      provider: dto.provider,
      label: dto.label || null,
      accessToken: dto.accessToken || null,
      refreshToken: dto.refreshToken || null,
      scopes: dto.scopes || [],
      expiresAt: dto.expiresAt || null,
      metadata: dto.metadata || null,
    }).returning();

    return this.toResponse(row as unknown as Integration);
  }

  /**
   * List integrations for an agent
   */
  async findByAgentId(agentId: string): Promise<Integration[]> {
    const db = getDb();
    const rows = await db.select().from(integrations)
      .where(eq(integrations.agentId, agentId));
    return rows as unknown as Integration[];
  }

  /**
   * Find a specific integration
   */
  async findById(id: string): Promise<Integration | null> {
    const db = getDb();
    const [row] = await db.select().from(integrations)
      .where(eq(integrations.id, id));
    return (row as unknown as Integration) || null;
  }

  /**
   * Find integration by agent + provider (to check for duplicates)
   */
  async findByAgentAndProvider(agentId: string, provider: string): Promise<Integration | null> {
    const db = getDb();
    const [row] = await db.select().from(integrations)
      .where(and(eq(integrations.agentId, agentId), eq(integrations.provider, provider)));
    return (row as unknown as Integration) || null;
  }

  /**
   * Update an integration
   */
  async update(id: string, userId: string, dto: IntegrationUpdateDTO): Promise<IntegrationResponse | null> {
    const db = getDb();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (dto.label !== undefined) updateData.label = dto.label;
    if (dto.accessToken !== undefined) updateData.accessToken = dto.accessToken;
    if (dto.refreshToken !== undefined) updateData.refreshToken = dto.refreshToken;
    if (dto.scopes !== undefined) updateData.scopes = dto.scopes;
    if (dto.expiresAt !== undefined) updateData.expiresAt = dto.expiresAt;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata;
    if (dto.errorMessage !== undefined) updateData.errorMessage = dto.errorMessage;

    const [row] = await db.update(integrations)
      .set(updateData)
      .where(and(eq(integrations.id, id), eq(integrations.userId, userId)))
      .returning();

    return row ? this.toResponse(row as unknown as Integration) : null;
  }

  /**
   * Update tokens (for OAuth refresh)
   */
  async updateTokens(id: string, accessToken: string, refreshToken?: string, expiresAt?: Date): Promise<void> {
    const db = getDb();
    const updateData: Record<string, unknown> = {
      accessToken,
      lastUsedAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      errorMessage: null,
    };
    if (refreshToken) updateData.refreshToken = refreshToken;
    if (expiresAt) updateData.expiresAt = expiresAt;

    await db.update(integrations)
      .set(updateData)
      .where(eq(integrations.id, id));
  }

  /**
   * Mark integration as errored
   */
  async markError(id: string, errorMessage: string): Promise<void> {
    const db = getDb();
    await db.update(integrations)
      .set({
        status: 'error',
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, id));
  }

  /**
   * Delete an integration
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const db = getDb();
    const result = await db.delete(integrations)
      .where(and(eq(integrations.id, id), eq(integrations.userId, userId)))
      .returning({ id: integrations.id });
    return result.length > 0;
  }

  /**
   * Convert to safe API response (no tokens exposed)
   */
  toResponse(row: Integration): IntegrationResponse {
    return {
      id: row.id,
      agentId: row.agentId,
      provider: row.provider,
      label: row.label,
      scopes: row.scopes,
      expiresAt: row.expiresAt,
      status: row.status,
      metadata: row.metadata ? {
        email: (row.metadata as any).email,
        accountName: (row.metadata as any).accountName,
        avatarUrl: (row.metadata as any).avatarUrl,
      } : null,
      lastUsedAt: row.lastUsedAt,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
    };
  }
}

export const integrationModel = new IntegrationModel();
