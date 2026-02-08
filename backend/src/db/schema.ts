// ============================================================
// GiLo AI – Database Schema (Drizzle ORM)
// All tables for the application
// ============================================================

import { pgTable, uuid, varchar, text, integer, real, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================
// Users
// ============================================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  githubId: varchar('github_id', { length: 255 }),
  tier: varchar('tier', { length: 20 }).notNull().default('free'),
  subscription: jsonb('subscription').$type<{
    status: string;
    stripeCustomerId?: string;
    subscriptionId?: string;
    currentPeriodEnd?: string;
  } | null>(),
  quotas: jsonb('quotas').$type<{
    projectsMax: number;
    storageMax: number;
    deploymentsPerMonth: number;
  }>().notNull(),
  usage: jsonb('usage').$type<{
    projectsCount: number;
    storageUsed: number;
    deploymentsThisMonth: number;
    lastResetDate: string;
  }>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Agents
// ============================================================

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  tier: varchar('tier', { length: 20 }).notNull().default('free'),
  config: jsonb('config').$type<{
    model: string;
    temperature: number;
    maxTokens: number;
    topP?: number;
    systemPrompt: string;
    welcomeMessage?: string;
    tools: Array<{
      id: string;
      name: string;
      type: string;
      description?: string;
      config?: Record<string, unknown>;
      enabled: boolean;
    }>;
    knowledgeBase?: string[];
  }>().notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  endpoint: varchar('endpoint', { length: 255 }),
  deployedAt: timestamp('deployed_at', { withTimezone: true }),
  totalConversations: integer('total_conversations').notNull().default(0),
  totalMessages: integer('total_messages').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Store Agents (published agents in the Store)
// ============================================================

export const storeAgents = pgTable('store_agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: varchar('agent_id', { length: 255 }).notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  creatorName: varchar('creator_name', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  shortDescription: varchar('short_description', { length: 500 }).notNull(),
  icon: text('icon'),
  iconColor: varchar('icon_color', { length: 20 }).default('#3b82f6'),
  features: jsonb('features').$type<string[]>().notNull().default([]),
  category: varchar('category', { length: 50 }).notNull().default('other'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  configSnapshot: jsonb('config_snapshot').$type<{
    model: string;
    systemPrompt: string;
    welcomeMessage: string;
    temperature: number;
    maxTokens: number;
    tools: Array<{ name: string; type: string }>;
  }>().notNull(),
  visibility: varchar('visibility', { length: 20 }).notNull().default('public'),
  accessToken: varchar('access_token', { length: 255 }),
  accessPrice: integer('access_price').default(0),
  usageCount: integer('usage_count').notNull().default(0),
  remixCount: integer('remix_count').notNull().default(0),
  rating: real('rating').notNull().default(0),
  ratingCount: integer('rating_count').notNull().default(0),
  remixedFrom: uuid('remixed_from'),
  version: varchar('version', { length: 20 }).notNull().default('1.0.0'),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Conversations & Messages (for history)
// ============================================================

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  messageCount: integer('message_count').notNull().default(0),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Refresh Tokens
// ============================================================

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Relations
// ============================================================

export const usersRelations = relations(users, ({ many }) => ({
  agents: many(agents),
  storeAgents: many(storeAgents),
  conversations: many(conversations),
  refreshTokens: many(refreshTokens),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  user: one(users, { fields: [agents.userId], references: [users.id] }),
  conversations: many(conversations),
}));

export const storeAgentsRelations = relations(storeAgents, ({ one }) => ({
  user: one(users, { fields: [storeAgents.userId], references: [users.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  agent: one(agents, { fields: [conversations.agentId], references: [agents.id] }),
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}));
