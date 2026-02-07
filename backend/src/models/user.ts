import { randomUUID } from 'crypto';

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
    currentPeriodEnd?: Date;
  };
  quotas: {
    projectsMax: number;
    storageMax: number; // en bytes
    deploymentsPerMonth: number;
  };
  usage: {
    projectsCount: number;
    storageUsed: number;
    deploymentsThisMonth: number;
    lastResetDate: Date;
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

export class UserModel {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
    this.initializeDefaultUser();
  }

  private initializeDefaultUser(): void {
    // Create a default demo user for testing
    const demoUser: User = {
      id: 'demo-user-id',
      email: 'demo@example.com',
      passwordHash: '$2b$10$demo', // "demo" password
      tier: 'pro',
      subscription: {
        status: 'active',
      },
      quotas: {
        projectsMax: 10,
        storageMax: 5 * 1024 * 1024 * 1024, // 5Go
        deploymentsPerMonth: 20,
      },
      usage: {
        projectsCount: 0,
        storageUsed: 0,
        deploymentsThisMonth: 0,
        lastResetDate: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(demoUser.id, demoUser);
  }

  async create(data: UserCreateDTO): Promise<User> {
    // Check if email exists
    const existing = Array.from(this.users.values()).find(u => u.email === data.email);
    if (existing) {
      throw new Error('Email already exists');
    }

    const user: User = {
      id: randomUUID(),
      email: data.email,
      passwordHash: await this.hashPassword(data.password),
      githubId: data.githubId,
      tier: 'free',
      quotas: {
        projectsMax: 3,
        storageMax: 100 * 1024 * 1024, // 100Mo
        deploymentsPerMonth: 5,
      },
      usage: {
        projectsCount: 0,
        storageUsed: 0,
        deploymentsThisMonth: 0,
        lastResetDate: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(user.id, user);
    return user;
  }

  async findById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async findByGithubId(githubId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.githubId === githubId);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error('User not found');
    }
    const updated = { ...user, ...data, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  async updateUsage(id: string, updates: Partial<User['usage']>): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error('User not found');
    }
    user.usage = { ...user.usage, ...updates };
    user.updatedAt = new Date();
    this.users.set(id, user);
    return user;
  }

  async upgradeToPro(id: string, stripeCustomerId: string, subscriptionId: string): Promise<User> {
    return this.update(id, {
      tier: 'pro',
      subscription: {
        status: 'active',
        stripeCustomerId,
        subscriptionId,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
      },
      quotas: {
        projectsMax: 10,
        storageMax: 5 * 1024 * 1024 * 1024, // 5Go
        deploymentsPerMonth: 20,
      },
    });
  }

  async downgradeToFree(id: string): Promise<User> {
    return this.update(id, {
      tier: 'free',
      quotas: {
        projectsMax: 3,
        storageMax: 100 * 1024 * 1024, // 100Mo
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

  private async hashPassword(password: string): Promise<string> {
    // Simple hash for demo - use bcrypt in production
    const crypto = await import('crypto');
    return crypto.randomBytes(16).toString('hex') + password;
  }
}

export const userModel = new UserModel();
