import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { users } from '../db/schema';

export type UserTier = 'free' | 'pro';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName?: string;
  githubId?: string;
  tier: UserTier;
  /** Number of extra agent slots purchased ($3/agent/month) */
  paidAgentSlots: number;
  subscription?: {
    status: SubscriptionStatus;
    stripeCustomerId?: string;
    subscriptionId?: string;
    currentPeriodEnd?: string;
  } | null;
  quotas: {
    projectsMax: number;
    storageMax: number;
    deploymentsPerMonth: number;
  };
  usage: {
    projectsCount: number;
    storageUsed: number;
    deploymentsThisMonth: number;
    lastResetDate: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCreateDTO {
  email: string;
  password: string;
  displayName?: string;
  githubId?: string;
}

export interface UserResponse {
  id: string;
  email: string;
  displayName?: string;
  tier: UserTier;
  paidAgentSlots: number;
  /** Total agent limit: 2 free + paidAgentSlots */
  maxAgents: number;
  quotas: User['quotas'];
  usage: {
    projectsCount: number;
    storageUsed: number;
    deploymentsThisMonth: number;
  };
  subscription?: User['subscription'];
}

// ============================================================
// User Model — PostgreSQL-backed via Drizzle ORM
// ============================================================

export class UserModel {
  async create(data: UserCreateDTO): Promise<User> {
    const db = getDb();

    const existing = await db.query.users.findFirst({
      where: eq(users.email, data.email),
    });
    if (existing) {
      throw new Error('Email already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const [row] = await db.insert(users).values({
      email: data.email,
      passwordHash,
      displayName: data.displayName,
      githubId: data.githubId,
      tier: 'free',
      quotas: { projectsMax: 2, storageMax: 50 * 1024 * 1024, deploymentsPerMonth: 3 },
      usage: { projectsCount: 0, storageUsed: 0, deploymentsThisMonth: 0, lastResetDate: new Date().toISOString() },
    }).returning();

    return this.mapRow(row);
  }

  async findById(id: string): Promise<User | undefined> {
    const db = getDb();
    const row = await db.query.users.findFirst({ where: eq(users.id, id) });
    return row ? this.mapRow(row) : undefined;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const db = getDb();
    const row = await db.query.users.findFirst({ where: eq(users.email, email) });
    return row ? this.mapRow(row) : undefined;
  }

  async findByGithubId(githubId: string): Promise<User | undefined> {
    const db = getDb();
    const row = await db.query.users.findFirst({ where: eq(users.githubId, githubId) });
    return row ? this.mapRow(row) : undefined;
  }

  /**
   * Find an existing user by GitHub ID or email, or create a new one.
   * If an email-only account exists, links the GitHub ID to it.
   */
  async findOrCreateByGithub(githubId: string, email: string, name?: string): Promise<User> {
    // 1. Already linked — returning user
    const byGithub = await this.findByGithubId(githubId);
    if (byGithub) return byGithub;

    // 2. Same email exists — link GitHub ID
    const byEmail = await this.findByEmail(email);
    if (byEmail) {
      return this.update(byEmail.id, { githubId, ...(name && !byEmail.displayName ? { displayName: name } : {}) });
    }

    // 3. Brand new user — create with random unguessable password
    const db = getDb();
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
    const [row] = await db.insert(users).values({
      email,
      passwordHash,
      displayName: name,
      githubId,
      tier: 'free',
      quotas: { projectsMax: 2, storageMax: 50 * 1024 * 1024, deploymentsPerMonth: 3 },
      usage: { projectsCount: 0, storageUsed: 0, deploymentsThisMonth: 0, lastResetDate: new Date().toISOString() },
    }).returning();

    return this.mapRow(row);
  }

  async update(id: string, data: Partial<Pick<User, 'tier' | 'subscription' | 'quotas' | 'githubId' | 'displayName' | 'paidAgentSlots'>>): Promise<User> {
    const db = getDb();
    const [row] = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    if (!row) throw new Error('User not found');
    return this.mapRow(row);
  }

  async updateUsage(id: string, updates: Partial<User['usage']>): Promise<User> {
    const db = getDb();
    const existing = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!existing) throw new Error('User not found');

    const newUsage = { ...existing.usage, ...updates };
    const [row] = await db.update(users)
      .set({ usage: newUsage, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return this.mapRow(row);
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async upgradeToPro(id: string, stripeCustomerId: string, subscriptionId: string): Promise<User> {
    return this.update(id, {
      tier: 'pro',
      subscription: {
        status: 'active',
        stripeCustomerId,
        subscriptionId,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      quotas: {
        projectsMax: 5,
        storageMax: 500 * 1024 * 1024,
        deploymentsPerMonth: 10,
      },
    });
  }

  async downgradeToFree(id: string): Promise<User> {
    return this.update(id, {
      tier: 'free',
      quotas: {
        projectsMax: 2,
        storageMax: 50 * 1024 * 1024,
        deploymentsPerMonth: 3,
      },
    });
  }

  /**
   * GDPR Art. 17 — Right to Erasure
   * Cascade delete removes all related data (agents, conversations, etc.)
   */
  async delete(id: string): Promise<boolean> {
    const db = getDb();
    const result = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    return result.length > 0;
  }

  /**
   * GDPR Art. 15/20 — Right of Access / Data Portability
   * Exports all user data as a structured object
   */
  async exportUserData(id: string): Promise<Record<string, any> | null> {
    const db = getDb();
    const user = await this.findById(id);
    if (!user) return null;

    // Get all user's agents
    const { agents } = await import('../db/schema');
    const userAgents = await db.query.agents.findMany({
      where: eq(agents.userId, id),
    });

    // Get all conversations
    const { conversations, messages } = await import('../db/schema');
    const userConversations = await db.query.conversations.findMany({
      where: eq(conversations.userId, id),
      with: { messages: true },
    });

    // Get all store agents
    const { storeAgents } = await import('../db/schema');
    const userStoreAgents = await db.query.storeAgents.findMany({
      where: eq(storeAgents.userId, id),
    });

    // Get all knowledge documents
    const { knowledgeDocuments } = await import('../db/schema');
    const userDocs = await db.query.knowledgeDocuments.findMany({
      where: eq(knowledgeDocuments.userId, id),
    });

    // Get API keys (metadata only, not hashes)
    const { apiKeys } = await import('../db/schema');
    const userApiKeys = await db.query.apiKeys.findMany({
      where: eq(apiKeys.userId, id),
    });

    // Get webhooks
    const { webhooks } = await import('../db/schema');
    const userWebhooks = await db.query.webhooks.findMany({
      where: eq(webhooks.userId, id),
    });

    return {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        tier: user.tier,
        quotas: user.quotas,
        usage: user.usage,
        createdAt: user.createdAt,
      },
      agents: userAgents.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        config: a.config,
        status: a.status,
        createdAt: a.createdAt,
      })),
      conversations: userConversations.map((c: any) => ({
        id: c.id,
        agentId: c.agentId,
        startedAt: c.startedAt,
        messages: c.messages?.map((m: any) => ({
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
      })),
      storeAgents: userStoreAgents.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        publishedAt: s.publishedAt,
      })),
      knowledgeDocuments: userDocs.map((d) => ({
        id: d.id,
        filename: d.filename,
        mimeType: d.mimeType,
        createdAt: d.createdAt,
      })),
      apiKeys: userApiKeys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        createdAt: k.createdAt,
      })),
      webhooks: userWebhooks.map((w) => ({
        id: w.id,
        url: w.url,
        events: w.events,
        createdAt: w.createdAt,
      })),
    };
  }

  toResponse(user: User): UserResponse {
    const paidSlots = user.paidAgentSlots || 0;
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      tier: user.tier,
      paidAgentSlots: paidSlots,
      maxAgents: 2 + paidSlots,
      quotas: user.quotas,
      usage: {
        projectsCount: user.usage.projectsCount,
        storageUsed: user.usage.storageUsed,
        deploymentsThisMonth: user.usage.deploymentsThisMonth,
      },
      subscription: user.subscription,
    };
  }

  private mapRow(row: any): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      displayName: row.displayName ?? undefined,
      githubId: row.githubId ?? undefined,
      tier: row.tier as UserTier,
      paidAgentSlots: row.paidAgentSlots ?? 0,
      subscription: row.subscription ?? undefined,
      quotas: row.quotas,
      usage: row.usage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export const userModel = new UserModel();
