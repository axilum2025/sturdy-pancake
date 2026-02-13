import { randomUUID } from 'crypto';
import { eq, ilike, or, sql, desc, and, avg } from 'drizzle-orm';
import { getDb } from '../db';
import { storeAgents, storeAgentRatings } from '../db/schema';

// ============================================================
// GiLo AI – Store Agent Model (PostgreSQL-backed via Drizzle ORM)
// ============================================================

export type StoreVisibility = 'public' | 'private';
export type StoreCategory =
  | 'productivity'
  | 'support'
  | 'education'
  | 'creative'
  | 'dev-tools'
  | 'marketing'
  | 'data'
  | 'entertainment'
  | 'other';

export interface StoreAgentListing {
  id: string;
  agentId: string;
  userId: string;
  creatorName: string;
  name: string;
  description: string;
  shortDescription: string;
  icon: string;
  iconColor: string;
  features: string[];
  category: StoreCategory;
  tags: string[];
  configSnapshot: {
    model: string;
    systemPrompt: string;
    welcomeMessage: string;
    temperature: number;
    maxTokens: number;
    tools: { name: string; type: string }[];
    appearance?: {
      theme?: 'dark' | 'light' | 'auto';
      accentColor?: string;
      chatBackground?: string;
    };
  };
  visibility: StoreVisibility;
  accessToken?: string;
  accessPrice?: number;
  usageCount: number;
  remixCount: number;
  rating: number;
  ratingCount: number;
  remixedFrom?: string;
  version: string;
  publishedAt: Date;
  updatedAt: Date;
}

export interface PublishAgentDTO {
  agentId: string;
  name: string;
  description: string;
  shortDescription: string;
  icon?: string;
  iconColor?: string;
  features: string[];
  category: StoreCategory;
  tags?: string[];
  visibility: StoreVisibility;
  accessPrice?: number;
}

export interface StoreAgentCard {
  id: string;
  name: string;
  shortDescription: string;
  icon: string;
  iconColor: string;
  category: StoreCategory;
  visibility: StoreVisibility;
  rating: number;
  usageCount: number;
  creatorName: string;
}

// ============================================================
// Store Model — PostgreSQL-backed
// ============================================================

export class StoreModel {
  async publish(userId: string, creatorName: string, dto: PublishAgentDTO, configSnapshot: StoreAgentListing['configSnapshot']): Promise<StoreAgentListing> {
    const db = getDb();
    const [row] = await db.insert(storeAgents).values({
      agentId: dto.agentId,
      userId,
      creatorName,
      name: dto.name,
      description: dto.description,
      shortDescription: dto.shortDescription,
      icon: dto.icon || '',
      iconColor: dto.iconColor || '#3b82f6',
      features: dto.features,
      category: dto.category,
      tags: dto.tags || [],
      configSnapshot,
      visibility: dto.visibility,
      accessToken: dto.visibility === 'private' ? randomUUID().replace(/-/g, '') : undefined,
      accessPrice: dto.accessPrice || 0,
      usageCount: 0,
      remixCount: 0,
      rating: 0,
      ratingCount: 0,
      version: '1.0.0',
    }).returning();

    return this.mapRow(row);
  }

  async findAll(options?: { category?: StoreCategory; search?: string; visibility?: StoreVisibility }): Promise<StoreAgentListing[]> {
    const db = getDb();
    const conditions: any[] = [];

    if (options?.visibility) {
      conditions.push(eq(storeAgents.visibility, options.visibility));
    }
    if (options?.category) {
      conditions.push(eq(storeAgents.category, options.category));
    }

    const baseQuery = db.select().from(storeAgents);
    
    const filteredQuery = conditions.length > 0
      ? baseQuery.where(conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`)
      : baseQuery;

    let rows = await filteredQuery.orderBy(desc(storeAgents.usageCount));

    // Text search filter (post-query for simplicity)
    if (options?.search) {
      const q = options.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q) ||
          (r.tags as string[]).some((t: string) => t.toLowerCase().includes(q))
      );
    }

    return rows.map((r) => this.mapRow(r));
  }

  async findById(id: string): Promise<StoreAgentListing | undefined> {
    const db = getDb();
    const row = await db.query.storeAgents.findFirst({ where: eq(storeAgents.id, id) });
    return row ? this.mapRow(row) : undefined;
  }

  async findByUserId(userId: string): Promise<StoreAgentListing[]> {
    const db = getDb();
    const rows = await db.query.storeAgents.findMany({
      where: eq(storeAgents.userId, userId),
      orderBy: (storeAgents, { desc }) => [desc(storeAgents.updatedAt)],
    });
    return rows.map((r) => this.mapRow(r));
  }

  async getCards(): Promise<StoreAgentCard[]> {
    const db = getDb();
    const rows = await db.select({
      id: storeAgents.id,
      name: storeAgents.name,
      shortDescription: storeAgents.shortDescription,
      icon: storeAgents.icon,
      iconColor: storeAgents.iconColor,
      category: storeAgents.category,
      visibility: storeAgents.visibility,
      rating: storeAgents.rating,
      usageCount: storeAgents.usageCount,
      creatorName: storeAgents.creatorName,
    })
      .from(storeAgents)
      .where(eq(storeAgents.visibility, 'public'))
      .orderBy(desc(storeAgents.usageCount));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      shortDescription: r.shortDescription,
      icon: r.icon || '',
      iconColor: r.iconColor || '#3b82f6',
      category: r.category as StoreCategory,
      visibility: r.visibility as StoreVisibility,
      rating: r.rating,
      usageCount: r.usageCount,
      creatorName: r.creatorName,
    }));
  }

  async incrementUsage(id: string): Promise<void> {
    const db = getDb();
    await db.update(storeAgents)
      .set({ usageCount: sql`${storeAgents.usageCount} + 1`, updatedAt: new Date() })
      .where(eq(storeAgents.id, id));
  }

  async incrementRemix(id: string): Promise<void> {
    const db = getDb();
    await db.update(storeAgents)
      .set({ remixCount: sql`${storeAgents.remixCount} + 1`, updatedAt: new Date() })
      .where(eq(storeAgents.id, id));
  }

  async regenerateToken(id: string): Promise<string> {
    const db = getDb();
    const newToken = randomUUID().replace(/-/g, '');
    await db.update(storeAgents)
      .set({ accessToken: newToken, updatedAt: new Date() })
      .where(eq(storeAgents.id, id));
    return newToken;
  }

  async update(id: string, data: Partial<StoreAgentListing>): Promise<StoreAgentListing> {
    const db = getDb();
    const { publishedAt, ...updateData } = data as any;
    const [row] = await db.update(storeAgents)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(storeAgents.id, id))
      .returning();
    if (!row) throw new Error('Store listing not found');
    return this.mapRow(row);
  }

  async delete(id: string): Promise<void> {
    const db = getDb();
    await db.delete(storeAgents).where(eq(storeAgents.id, id));
  }

  async deleteByAgentId(agentId: string): Promise<void> {
    const db = getDb();
    await db.delete(storeAgents).where(eq(storeAgents.agentId, agentId));
  }

  async validateToken(id: string, token: string): Promise<boolean> {
    const db = getDb();
    const row = await db.query.storeAgents.findFirst({ where: eq(storeAgents.id, id) });
    if (!row) return false;
    if (row.visibility === 'public') return true;
    return row.accessToken === token;
  }

  /**
   * Rate an agent (1-5 stars). Upserts the user's rating and recalculates the average.
   */
  async rateAgent(storeAgentId: string, userId: string, rating: number): Promise<{ rating: number; ratingCount: number }> {
    const db = getDb();

    // Upsert the user's rating
    const existing = await db.query.storeAgentRatings.findFirst({
      where: and(
        eq(storeAgentRatings.storeAgentId, storeAgentId),
        eq(storeAgentRatings.userId, userId),
      ),
    });

    if (existing) {
      await db.update(storeAgentRatings)
        .set({ rating, updatedAt: new Date() })
        .where(eq(storeAgentRatings.id, existing.id));
    } else {
      await db.insert(storeAgentRatings).values({
        storeAgentId,
        userId,
        rating,
      });
    }

    // Recalculate average from all ratings
    const result = await db.select({
      avgRating: sql<number>`COALESCE(AVG(${storeAgentRatings.rating}), 0)`,
      count: sql<number>`COUNT(*)`,
    }).from(storeAgentRatings).where(eq(storeAgentRatings.storeAgentId, storeAgentId));

    const avgRating = Math.round((Number(result[0]?.avgRating) || 0) * 10) / 10;
    const ratingCount = Number(result[0]?.count) || 0;

    // Update the store agent's aggregated rating
    await db.update(storeAgents)
      .set({ rating: avgRating, ratingCount, updatedAt: new Date() })
      .where(eq(storeAgents.id, storeAgentId));

    return { rating: avgRating, ratingCount };
  }

  /**
   * Get the current user's rating for a specific store agent (or null if not rated).
   */
  async getUserRating(storeAgentId: string, userId: string): Promise<number | null> {
    const db = getDb();
    const row = await db.query.storeAgentRatings.findFirst({
      where: and(
        eq(storeAgentRatings.storeAgentId, storeAgentId),
        eq(storeAgentRatings.userId, userId),
      ),
    });
    return row ? row.rating : null;
  }

  private mapRow(row: any): StoreAgentListing {
    return {
      id: row.id,
      agentId: row.agentId,
      userId: row.userId,
      creatorName: row.creatorName,
      name: row.name,
      description: row.description || '',
      shortDescription: row.shortDescription,
      icon: row.icon || '',
      iconColor: row.iconColor || '#3b82f6',
      features: (row.features || []) as string[],
      category: (row.category || 'other') as StoreCategory,
      tags: (row.tags || []) as string[],
      configSnapshot: row.configSnapshot as StoreAgentListing['configSnapshot'],
      visibility: (row.visibility || 'public') as StoreVisibility,
      accessToken: row.accessToken ?? undefined,
      accessPrice: row.accessPrice ?? 0,
      usageCount: row.usageCount || 0,
      remixCount: row.remixCount || 0,
      rating: row.rating || 0,
      ratingCount: row.ratingCount || 0,
      remixedFrom: row.remixedFrom ?? undefined,
      version: row.version || '1.0.0',
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
    };
  }
}

export const storeModel = new StoreModel();
