// ============================================================
// GiLo AI – Database Schema (Drizzle ORM)
// All tables for the application
// ============================================================

import { pgTable, uuid, varchar, text, integer, real, timestamp, jsonb, vector } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================
// Users
// ============================================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 50 }),
  githubId: varchar('github_id', { length: 255 }),
  tier: varchar('tier', { length: 20 }).notNull().default('free'),
  paidAgentSlots: integer('paid_agent_slots').notNull().default(0),
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
  // GDPR consent tracking
  consentGiven: integer('consent_given').notNull().default(0),
  consentAt: timestamp('consent_at', { withTimezone: true }),
  consentVersion: varchar('consent_version', { length: 20 }),
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
  slug: varchar('slug', { length: 255 }).unique(),
  description: text('description'),
  tier: varchar('tier', { length: 20 }).notNull().default('free'),
  config: jsonb('config').$type<{
    model: string;
    temperature: number;
    maxTokens: number;
    topP?: number;
    systemPrompt: string;
    welcomeMessage?: string;
    language?: 'fr' | 'en';
    tools: Array<{
      id: string;
      name: string;
      type: string;
      description?: string;
      config?: Record<string, unknown>;
      enabled: boolean;
      parameters?: Record<string, unknown>;
    }>;
    knowledgeBase?: string[];
    appearance?: {
      theme?: 'dark' | 'light' | 'auto';
      accentColor?: string;
      chatBackground?: string;
    };
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
// Store Agent Ratings (per-user rating tracking)
// ============================================================

export const storeAgentRatings = pgTable('store_agent_ratings', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeAgentId: uuid('store_agent_id').notNull().references(() => storeAgents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Conversations & Messages (for history)
// ============================================================

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
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
// Knowledge Documents (uploaded files for RAG)
// ============================================================

export const knowledgeDocuments = pgTable('knowledge_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  filename: varchar('filename', { length: 500 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  fileSize: integer('file_size').notNull(), // bytes
  chunkCount: integer('chunk_count').notNull().default(0),
  status: varchar('status', { length: 20 }).notNull().default('processing'), // processing | ready | error
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Knowledge Chunks (vector-indexed document segments)
// ============================================================

export const knowledgeChunks = pgTable('knowledge_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => knowledgeDocuments.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  tokenCount: integer('token_count').notNull().default(0),
  embedding: vector('embedding', { dimensions: 1536 }), // text-embedding-3-small = 1536 dims
  metadata: jsonb('metadata').$type<{
    page?: number;
    section?: string;
    source?: string;
  }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// API Keys (for public agent endpoints)
// ============================================================

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  keyHash: varchar('key_hash', { length: 255 }).notNull(),
  keyPrefix: varchar('key_prefix', { length: 12 }).notNull(), // first 8 chars for display
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  requestCount: integer('request_count').notNull().default(0),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Webhooks (per-agent event hooks)
// ============================================================

export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 2048 }).notNull(),
  events: jsonb('events').$type<string[]>().notNull().default([]),
  secret: varchar('secret', { length: 255 }).notNull(), // HMAC signing secret
  active: integer('active').notNull().default(1),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
  failureCount: integer('failure_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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
// Community Tools (user-published tools for sharing)
// ============================================================

export const communityTools = pgTable('community_tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  creatorName: varchar('creator_name', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 50 }).notNull().default('other'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  icon: varchar('icon', { length: 50 }).default('Wrench'),
  /** The full tool definition that can be installed into an agent */
  definition: jsonb('definition').$type<{
    name: string;
    type: string;
    description: string;
    parameters: Record<string, unknown>;
    config: Record<string, unknown>;
  }>().notNull(),
  installCount: integer('install_count').notNull().default(0),
  rating: real('rating').notNull().default(0),
  ratingCount: integer('rating_count').notNull().default(0),
  status: varchar('status', { length: 20 }).notNull().default('active'), // active | flagged | removed
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Agent Metrics (aggregated daily analytics)
// ============================================================

export const agentMetrics = pgTable('agent_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  date: varchar('date', { length: 10 }).notNull(), // YYYY-MM-DD
  conversations: integer('conversations').notNull().default(0),
  messages: integer('messages').notNull().default(0),
  tokensUsed: integer('tokens_used').notNull().default(0),
  toolCalls: integer('tool_calls').notNull().default(0),
  avgResponseMs: integer('avg_response_ms').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),
  uniqueUsers: integer('unique_users').notNull().default(0),
  satisfaction: real('satisfaction'), // avg rating 1-5 from thumbs
  estimatedCost: real('estimated_cost').notNull().default(0), // USD
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Agent Logs (detailed per-interaction logs)
// ============================================================

export const agentLogs = pgTable('agent_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id'),
  level: varchar('level', { length: 10 }).notNull().default('info'), // info | warn | error | debug
  event: varchar('event', { length: 50 }).notNull(), // chat, tool_call, tool_error, rag_search, deploy, etc.
  message: text('message').notNull(),
  metadata: jsonb('metadata').$type<{
    userMessage?: string;
    assistantResponse?: string;
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    toolResult?: string;
    ragChunks?: number;
    tokensPrompt?: number;
    tokensCompletion?: number;
    responseMs?: number;
    model?: string;
    errorStack?: string;
    userId?: string;
    ip?: string;
  }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Agent Alerts (configurable alert rules)
// ============================================================

export const agentAlerts = pgTable('agent_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 30 }).notNull(), // error_rate | cost_limit | inactivity | rate_limit
  config: jsonb('config').$type<{
    threshold: number;
    window?: string; // e.g. '1h', '24h'
    notifyEmail?: string;
    notifyWebhook?: string;
  }>().notNull(),
  enabled: integer('enabled').notNull().default(1),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Integrations (OAuth / API Key connections per agent)
// ============================================================

export type IntegrationProvider = 'google' | 'slack' | 'notion' | 'github' | 'stripe' | 'airtable' | 'hubspot' | 'custom';
export type IntegrationStatus = 'active' | 'expired' | 'revoked' | 'error';

export const integrations = pgTable('integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 50 }).notNull(), // google, slack, notion, etc.
  label: varchar('label', { length: 255 }), // user-friendly display name
  accessToken: text('access_token'), // encrypted
  refreshToken: text('refresh_token'), // encrypted
  scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  status: varchar('status', { length: 20 }).notNull().default('active'), // active | expired | revoked | error
  metadata: jsonb('metadata').$type<{
    email?: string;
    accountName?: string;
    avatarUrl?: string;
    apiKey?: string; // for API key type integrations
    baseUrl?: string; // for custom integrations
    [key: string]: unknown;
  }>(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Relations
// ============================================================

export const usersRelations = relations(users, ({ many }) => ({
  agents: many(agents),
  storeAgents: many(storeAgents),
  conversations: many(conversations),
  refreshTokens: many(refreshTokens),
  apiKeys: many(apiKeys),
  webhooks: many(webhooks),
  knowledgeDocuments: many(knowledgeDocuments),
  communityTools: many(communityTools),
  agentAlerts: many(agentAlerts),
  integrations: many(integrations),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  user: one(users, { fields: [agents.userId], references: [users.id] }),
  conversations: many(conversations),
  apiKeys: many(apiKeys),
  webhooks: many(webhooks),
  knowledgeDocuments: many(knowledgeDocuments),
  knowledgeChunks: many(knowledgeChunks),
  metrics: many(agentMetrics),
  logs: many(agentLogs),
  alerts: many(agentAlerts),
  integrations: many(integrations),
}));

export const storeAgentsRelations = relations(storeAgents, ({ one, many }) => ({
  user: one(users, { fields: [storeAgents.userId], references: [users.id] }),
  ratings: many(storeAgentRatings),
}));

export const storeAgentRatingsRelations = relations(storeAgentRatings, ({ one }) => ({
  storeAgent: one(storeAgents, { fields: [storeAgentRatings.storeAgentId], references: [storeAgents.id] }),
  user: one(users, { fields: [storeAgentRatings.userId], references: [users.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  agent: one(agents, { fields: [conversations.agentId], references: [agents.id] }),
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  agent: one(agents, { fields: [apiKeys.agentId], references: [agents.id] }),
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}));

export const webhooksRelations = relations(webhooks, ({ one }) => ({
  agent: one(agents, { fields: [webhooks.agentId], references: [agents.id] }),
  user: one(users, { fields: [webhooks.userId], references: [users.id] }),
}));

export const knowledgeDocumentsRelations = relations(knowledgeDocuments, ({ one, many }) => ({
  agent: one(agents, { fields: [knowledgeDocuments.agentId], references: [agents.id] }),
  user: one(users, { fields: [knowledgeDocuments.userId], references: [users.id] }),
  chunks: many(knowledgeChunks),
}));

export const knowledgeChunksRelations = relations(knowledgeChunks, ({ one }) => ({
  document: one(knowledgeDocuments, { fields: [knowledgeChunks.documentId], references: [knowledgeDocuments.id] }),
  agent: one(agents, { fields: [knowledgeChunks.agentId], references: [agents.id] }),
}));

export const communityToolsRelations = relations(communityTools, ({ one }) => ({
  user: one(users, { fields: [communityTools.userId], references: [users.id] }),
}));

export const agentMetricsRelations = relations(agentMetrics, ({ one }) => ({
  agent: one(agents, { fields: [agentMetrics.agentId], references: [agents.id] }),
}));

export const agentLogsRelations = relations(agentLogs, ({ one }) => ({
  agent: one(agents, { fields: [agentLogs.agentId], references: [agents.id] }),
}));

export const agentAlertsRelations = relations(agentAlerts, ({ one }) => ({
  agent: one(agents, { fields: [agentAlerts.agentId], references: [agents.id] }),
  user: one(users, { fields: [agentAlerts.userId], references: [users.id] }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  agent: one(agents, { fields: [integrations.agentId], references: [agents.id] }),
  user: one(users, { fields: [integrations.userId], references: [users.id] }),
}));
