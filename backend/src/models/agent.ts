import { eq, sql, like } from 'drizzle-orm';
import { getDb } from '../db';
import { agents } from '../db/schema';

// ============================================================
// GiLo AI – Agent Model (PostgreSQL-backed via Drizzle ORM)
// ============================================================

export type AgentStatus = 'draft' | 'active' | 'deployed';
export type AgentTier = 'free' | 'pro';

export interface AgentTool {
  id: string;
  name: string;
  type: 'mcp' | 'api' | 'function';
  description?: string;
  config?: Record<string, unknown>;
  enabled: boolean;
}

export interface AgentConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  systemPrompt: string;
  welcomeMessage?: string;
  language?: 'fr' | 'en';
  tools: AgentTool[];
  knowledgeBase?: string[];
  appearance?: {
    theme?: 'dark' | 'light' | 'auto';
    accentColor?: string;
    chatBackground?: string;
  };
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  slug?: string;
  description?: string;
  tier: AgentTier;
  config: AgentConfig;
  status: AgentStatus;
  endpoint?: string;
  deployedAt?: Date;
  totalConversations: number;
  totalMessages: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentCreateDTO {
  name: string;
  description?: string;
  config?: Partial<AgentConfig>;
}

export interface AgentResponse {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  tier: AgentTier;
  config: AgentConfig;
  status: AgentStatus;
  endpoint?: string;
  totalConversations: number;
  totalMessages: number;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_CONFIG: AgentConfig = {
  model: 'openai/gpt-4.1',
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: 'Tu es un assistant IA utile et concis. Réponds toujours de manière professionnelle.',
  welcomeMessage: 'Bonjour ! Comment puis-je vous aider ?',
  tools: [],
};

// ============================================================
// Agent Model — PostgreSQL-backed
// ============================================================

export class AgentModel {
  async create(userId: string, data: AgentCreateDTO, userTier: AgentTier): Promise<Agent> {
    const db = getDb();

    // Check agent limit
    try {
      const userAgents = await db.select({ count: sql<number>`count(*)::int` })
        .from(agents)
        .where(eq(agents.userId, userId));
      const count = userAgents[0]?.count || 0;
      const maxAgents = userTier === 'pro' ? 20 : 5;

      console.log(`[AgentModel] Count check: ${count}/${maxAgents} for tier ${userTier}`);

      if (count >= maxAgents) {
        throw new Error(`Agent limit reached. Maximum ${maxAgents} agents for ${userTier} tier.`);
      }
    } catch (err: any) {
      console.error('[AgentModel] Quota check failed:', err);
      throw err; // Re-throw to handle upstream
    }

    const config: AgentConfig = {
      ...DEFAULT_CONFIG,
      ...data.config,
      tools: data.config?.tools || [],
    };

    // Retry loop to handle race conditions where generated slug is taken before insert
    let attempts = 0;
    while (attempts < 3) {
      try {
        const slug = await this.generateUniqueSlug(data.name);

        const [row] = await db.insert(agents).values({
          userId,
          name: data.name,
          slug,
          description: data.description,
          tier: userTier,
          config,
          status: 'draft',
          totalConversations: 0,
          totalMessages: 0,
        }).returning();

        return this.mapRow(row);
      } catch (error: any) {
        // Check for unique constraint violation on slug (Postgres code 23505)
        if (error?.code === '23505' && error?.detail?.includes('slug')) {
          attempts++;
          continue;
        }
        throw error;
      }
    }
    
    throw new Error('Failed to generate unique slug after multiple attempts');
  }

  async findById(id: string): Promise<Agent | undefined> {
    const db = getDb();
    const row = await db.query.agents.findFirst({ where: eq(agents.id, id) });
    return row ? this.mapRow(row) : undefined;
  }

  async findByUserId(userId: string): Promise<Agent[]> {
    const db = getDb();
    const rows = await db.query.agents.findMany({
      where: eq(agents.userId, userId),
      orderBy: (agents, { desc }) => [desc(agents.updatedAt)],
    });
    return rows.map((r) => this.mapRow(r));
  }

  async findBySlug(slug: string): Promise<Agent | undefined> {
    const db = getDb();
    const row = await db.query.agents.findFirst({ where: eq(agents.slug, slug) });
    return row ? this.mapRow(row) : undefined;
  }

  async update(id: string, data: Partial<Pick<Agent, 'name' | 'description' | 'status' | 'endpoint' | 'slug' | 'totalConversations' | 'totalMessages'>>): Promise<Agent> {
    const db = getDb();
    const [row] = await db.update(agents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();
    if (!row) throw new Error('Agent not found');
    return this.mapRow(row);
  }

  async updateConfig(id: string, config: Partial<AgentConfig>): Promise<Agent> {
    const db = getDb();
    const existing = await db.query.agents.findFirst({ where: eq(agents.id, id) });
    if (!existing) throw new Error('Agent not found');

    const newConfig = { ...(existing.config as AgentConfig), ...config };
    const [row] = await db.update(agents)
      .set({ config: newConfig, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();
    return this.mapRow(row);
  }

  async delete(id: string): Promise<void> {
    const db = getDb();
    const result = await db.delete(agents).where(eq(agents.id, id)).returning();
    if (result.length === 0) throw new Error('Agent not found');
  }

  async deploy(id: string): Promise<Agent> {
    const db = getDb();
    const existing = await db.query.agents.findFirst({ where: eq(agents.id, id) });
    if (!existing) throw new Error('Agent not found');

    // Keep existing slug or generate a new unique one
    const slug = existing.slug || await this.generateUniqueSlug(existing.name || id);
    const giloDomain = process.env.GILO_DOMAIN || '';
    const subdomainUrl = giloDomain ? `https://${slug}.${giloDomain}` : undefined;
    const endpoint = subdomainUrl ? `${subdomainUrl}/chat` : `/api/agents/${id}/chat`;

    const [row] = await db.update(agents)
      .set({
        status: 'deployed',
        slug,
        endpoint,
        deployedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agents.id, id))
      .returning();
    if (!row) throw new Error('Agent not found');
    return this.mapRow(row);
  }

  toResponse(agent: Agent): AgentResponse {
    return {
      id: agent.id,
      name: agent.name,
      slug: agent.slug,
      description: agent.description,
      tier: agent.tier,
      config: agent.config,
      status: agent.status,
      endpoint: agent.endpoint,
      totalConversations: agent.totalConversations,
      totalMessages: agent.totalMessages,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
    };
  }

  private mapRow(row: any): Agent {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      slug: row.slug ?? undefined,
      description: row.description ?? undefined,
      tier: row.tier as AgentTier,
      config: row.config as AgentConfig,
      status: row.status as AgentStatus,
      endpoint: row.endpoint ?? undefined,
      deployedAt: row.deployedAt ?? undefined,
      totalConversations: row.totalConversations,
      totalMessages: row.totalMessages,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Generate a URL-safe slug from an agent name.
   * e.g. "Mon Agent Support" → "mon-agent-support"
   */
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60);
  }

  /**
   * Generate a unique slug by checking for collisions in the DB.
   * If "mon-agent" exists, tries "mon-agent-2", "mon-agent-3", etc.
   */
  private async generateUniqueSlug(name: string): Promise<string> {
    const db = getDb();
    const base = this.slugify(name);
    if (!base) return this.slugify(`agent-${Date.now()}`);

    // Check if base slug is available
    const existing = await db.query.agents.findFirst({ where: eq(agents.slug, base) });
    if (!existing) return base;

    // Find all slugs that start with this base
    const similar = await db.select({ slug: agents.slug })
      .from(agents)
      .where(like(agents.slug, `${base}-%`));

    const usedNumbers = similar
      .map(r => r.slug)
      .filter((s): s is string => !!s)
      .map(s => {
        const suffix = s.slice(base.length + 1);
        return /^\d+$/.test(suffix) ? parseInt(suffix, 10) : 0;
      })
      .filter(n => n > 0);

    const next = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 2;
    return `${base}-${next}`;
  }
}

export const agentModel = new AgentModel();
