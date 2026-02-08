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
  githubId?: string;
  tier: UserTier;
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
  githubId?: string;
}

export interface UserResponse {
  id: string;
  email: string;
  tier: UserTier;
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
      githubId: data.githubId,
      tier: 'free',
      quotas: { projectsMax: 3, storageMax: 100 * 1024 * 1024, deploymentsPerMonth: 5 },
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

  async update(id: string, data: Partial<Pick<User, 'tier' | 'subscription' | 'quotas' | 'githubId'>>): Promise<User> {
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
        projectsMax: 10,
        storageMax: 5 * 1024 * 1024 * 1024,
        deploymentsPerMonth: 20,
      },
    });
  }

  async downgradeToFree(id: string): Promise<User> {
    return this.update(id, {
      tier: 'free',
      quotas: {
        projectsMax: 3,
        storageMax: 100 * 1024 * 1024,
        deploymentsPerMonth: 5,
      },
    });
  }

  toResponse(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      tier: user.tier,
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
      githubId: row.githubId ?? undefined,
      tier: row.tier as UserTier,
      subscription: row.subscription ?? undefined,
      quotas: row.quotas,
      usage: row.usage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export const userModel = new UserModel();
