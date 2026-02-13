// ============================================================
// GiLo AI – Analytics Service
// Tracks metrics, logs interactions, computes aggregates
// ============================================================

import { getDb } from '../db';
import { agentMetrics, agentLogs, agents } from '../db/schema';
import { eq, and, gte, lte, desc, sql, count } from 'drizzle-orm';

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------

export interface LogEntry {
  agentId: string;
  conversationId?: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  event: string;
  message: string;
  metadata?: {
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
  };
}

export interface MetricIncrement {
  agentId: string;
  conversations?: number;
  messages?: number;
  tokensUsed?: number;
  toolCalls?: number;
  responseMs?: number;
  errors?: number;
  estimatedCost?: number;
}

export interface AnalyticsSummary {
  totalConversations: number;
  totalMessages: number;
  totalTokens: number;
  totalToolCalls: number;
  totalErrors: number;
  avgResponseMs: number;
  estimatedCost: number;
  dailyMetrics: DailyMetric[];
}

export interface DailyMetric {
  date: string;
  conversations: number;
  messages: number;
  tokensUsed: number;
  toolCalls: number;
  errorCount: number;
  avgResponseMs: number;
  estimatedCost: number;
}

// ----------------------------------------------------------
// Logging
// ----------------------------------------------------------

/** Write a log entry */
export async function writeLog(entry: LogEntry): Promise<void> {
  try {
    const db = getDb();
    await db.insert(agentLogs).values({
      agentId: entry.agentId,
      conversationId: entry.conversationId,
      level: entry.level,
      event: entry.event,
      message: entry.message,
      metadata: entry.metadata,
    });
  } catch (err) {
    // Don't crash the app if logging fails
    console.error('Analytics log write failed:', err);
  }
}

/** Convenience: log a chat interaction */
export async function logChat(params: {
  agentId: string;
  conversationId?: string;
  userMessage: string;
  assistantResponse: string;
  tokensPrompt: number;
  tokensCompletion: number;
  responseMs: number;
  model: string;
  ragChunks?: number;
  toolCalls?: number;
  userId?: string;
}): Promise<void> {
  await writeLog({
    agentId: params.agentId,
    conversationId: params.conversationId,
    level: 'info',
    event: 'chat',
    message: `Chat: ${params.userMessage.slice(0, 80)}...`,
    metadata: {
      userMessage: params.userMessage.slice(0, 5000),
      assistantResponse: params.assistantResponse.slice(0, 5000),
      tokensPrompt: params.tokensPrompt,
      tokensCompletion: params.tokensCompletion,
      responseMs: params.responseMs,
      model: params.model,
      ragChunks: params.ragChunks,
      userId: params.userId,
    },
  });

  // Also increment daily metrics
  const totalTokens = params.tokensPrompt + params.tokensCompletion;
  // Rough cost estimate for GPT-4.1-nano: $0.10/M input, $0.40/M output
  const cost = (params.tokensPrompt * 0.1 + params.tokensCompletion * 0.4) / 1_000_000;

  await incrementMetrics({
    agentId: params.agentId,
    messages: 1,
    tokensUsed: totalTokens,
    toolCalls: params.toolCalls || 0,
    responseMs: params.responseMs,
    estimatedCost: cost,
  });
}

/** Log a tool call */
export async function logToolCall(params: {
  agentId: string;
  conversationId?: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  toolResult: string;
  success: boolean;
}): Promise<void> {
  await writeLog({
    agentId: params.agentId,
    conversationId: params.conversationId,
    level: params.success ? 'info' : 'warn',
    event: params.success ? 'tool_call' : 'tool_error',
    message: `Tool ${params.toolName}: ${params.success ? 'success' : 'error'}`,
    metadata: {
      toolName: params.toolName,
      toolArgs: params.toolArgs,
      toolResult: params.toolResult.slice(0, 2000),
    },
  });
}

/** Log an error */
export async function logError(params: {
  agentId: string;
  conversationId?: string;
  message: string;
  errorStack?: string;
}): Promise<void> {
  await writeLog({
    agentId: params.agentId,
    conversationId: params.conversationId,
    level: 'error',
    event: 'error',
    message: params.message,
    metadata: { errorStack: params.errorStack },
  });

  await incrementMetrics({ agentId: params.agentId, errors: 1 });
}

// ----------------------------------------------------------
// Metrics (daily aggregation)
// ----------------------------------------------------------

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Increment daily metrics for an agent. Creates missing row if needed. */
export async function incrementMetrics(inc: MetricIncrement): Promise<void> {
  try {
    const db = getDb();
    const date = todayStr();

    // Try to find existing row
    const [existing] = await db
      .select()
      .from(agentMetrics)
      .where(and(eq(agentMetrics.agentId, inc.agentId), eq(agentMetrics.date, date)));

    if (existing) {
      // Update running averages
      const totalMessages = existing.messages + (inc.messages || 0);
      let newAvgMs = existing.avgResponseMs;
      if (inc.responseMs && inc.messages) {
        // Weighted average
        newAvgMs = Math.round(
          (existing.avgResponseMs * existing.messages + inc.responseMs) / totalMessages
        );
      }

      await db
        .update(agentMetrics)
        .set({
          conversations: existing.conversations + (inc.conversations || 0),
          messages: totalMessages,
          tokensUsed: existing.tokensUsed + (inc.tokensUsed || 0),
          toolCalls: existing.toolCalls + (inc.toolCalls || 0),
          avgResponseMs: newAvgMs,
          errorCount: existing.errorCount + (inc.errors || 0),
          estimatedCost: existing.estimatedCost + (inc.estimatedCost || 0),
        })
        .where(eq(agentMetrics.id, existing.id));
    } else {
      await db.insert(agentMetrics).values({
        agentId: inc.agentId,
        date,
        conversations: inc.conversations || 0,
        messages: inc.messages || 0,
        tokensUsed: inc.tokensUsed || 0,
        toolCalls: inc.toolCalls || 0,
        avgResponseMs: inc.responseMs || 0,
        errorCount: inc.errors || 0,
        estimatedCost: inc.estimatedCost || 0,
      });
    }
  } catch (err) {
    console.error('Metrics increment failed:', err);
  }
}

/** Record a new conversation start */
export async function recordConversation(agentId: string): Promise<void> {
  await incrementMetrics({ agentId, conversations: 1 });

  // Also update the agent's totalConversations counter
  try {
    const db = getDb();
    await db
      .update(agents)
      .set({
        totalConversations: sql`${agents.totalConversations} + 1`,
      })
      .where(eq(agents.id, agentId));
  } catch (err) {
    console.error('Failed to increment agent conversations:', err);
  }
}

// ----------------------------------------------------------
// Queries
// ----------------------------------------------------------

/** Get analytics summary for an agent within a date range */
export async function getAgentAnalytics(
  agentId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string
): Promise<AnalyticsSummary> {
  const db = getDb();

  const rows = await db
    .select()
    .from(agentMetrics)
    .where(
      and(
        eq(agentMetrics.agentId, agentId),
        gte(agentMetrics.date, startDate),
        lte(agentMetrics.date, endDate)
      )
    )
    .orderBy(agentMetrics.date);

  const totalConversations = rows.reduce((s, r) => s + r.conversations, 0);
  const totalMessages = rows.reduce((s, r) => s + r.messages, 0);
  const totalTokens = rows.reduce((s, r) => s + r.tokensUsed, 0);
  const totalToolCalls = rows.reduce((s, r) => s + r.toolCalls, 0);
  const totalErrors = rows.reduce((s, r) => s + r.errorCount, 0);
  const estimatedCost = rows.reduce((s, r) => s + r.estimatedCost, 0);
  const avgResponseMs = totalMessages > 0
    ? Math.round(rows.reduce((s, r) => s + r.avgResponseMs * r.messages, 0) / totalMessages)
    : 0;

  return {
    totalConversations,
    totalMessages,
    totalTokens,
    totalToolCalls,
    totalErrors,
    avgResponseMs,
    estimatedCost: Math.round(estimatedCost * 10000) / 10000,
    dailyMetrics: rows.map((r) => ({
      date: r.date,
      conversations: r.conversations,
      messages: r.messages,
      tokensUsed: r.tokensUsed,
      toolCalls: r.toolCalls,
      errorCount: r.errorCount,
      avgResponseMs: r.avgResponseMs,
      estimatedCost: r.estimatedCost,
    })),
  };
}

/** Get global analytics across all agents for a user */
export async function getUserAnalytics(
  userId: string,
  startDate: string,
  endDate: string
): Promise<AnalyticsSummary & { agentBreakdown: Array<{ agentId: string; agentName: string; messages: number; tokens: number; cost: number }> }> {
  const db = getDb();

  // Get user's agents
  const userAgents = await db.select({ id: agents.id, name: agents.name }).from(agents).where(eq(agents.userId, userId));
  const agentIds = userAgents.map((a) => a.id);

  if (agentIds.length === 0) {
    return {
      totalConversations: 0,
      totalMessages: 0,
      totalTokens: 0,
      totalToolCalls: 0,
      totalErrors: 0,
      avgResponseMs: 0,
      estimatedCost: 0,
      dailyMetrics: [],
      agentBreakdown: [],
    };
  }

  // Fetch all metrics for these agents in range
  const allMetrics = await db
    .select()
    .from(agentMetrics)
    .where(
      and(
        gte(agentMetrics.date, startDate),
        lte(agentMetrics.date, endDate)
      )
    )
    .orderBy(agentMetrics.date);

  // Filter to user's agents
  const metrics = allMetrics.filter((m) => agentIds.includes(m.agentId));

  // Aggregate by date
  const byDate = new Map<string, DailyMetric>();
  for (const m of metrics) {
    const existing = byDate.get(m.date);
    if (existing) {
      existing.conversations += m.conversations;
      existing.messages += m.messages;
      existing.tokensUsed += m.tokensUsed;
      existing.toolCalls += m.toolCalls;
      existing.errorCount += m.errorCount;
      existing.estimatedCost += m.estimatedCost;
    } else {
      byDate.set(m.date, {
        date: m.date,
        conversations: m.conversations,
        messages: m.messages,
        tokensUsed: m.tokensUsed,
        toolCalls: m.toolCalls,
        errorCount: m.errorCount,
        avgResponseMs: m.avgResponseMs,
        estimatedCost: m.estimatedCost,
      });
    }
  }

  const dailyMetrics = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  const totalConversations = metrics.reduce((s, r) => s + r.conversations, 0);
  const totalMessages = metrics.reduce((s, r) => s + r.messages, 0);
  const totalTokens = metrics.reduce((s, r) => s + r.tokensUsed, 0);
  const totalToolCalls = metrics.reduce((s, r) => s + r.toolCalls, 0);
  const totalErrors = metrics.reduce((s, r) => s + r.errorCount, 0);
  const estimatedCost = metrics.reduce((s, r) => s + r.estimatedCost, 0);
  const avgResponseMs = totalMessages > 0
    ? Math.round(metrics.reduce((s, r) => s + r.avgResponseMs * r.messages, 0) / totalMessages)
    : 0;

  // Agent breakdown
  const agentMap = new Map<string, { messages: number; tokens: number; cost: number }>();
  for (const m of metrics) {
    const existing = agentMap.get(m.agentId) || { messages: 0, tokens: 0, cost: 0 };
    existing.messages += m.messages;
    existing.tokens += m.tokensUsed;
    existing.cost += m.estimatedCost;
    agentMap.set(m.agentId, existing);
  }

  const agentBreakdown = Array.from(agentMap.entries()).map(([agentId, data]) => ({
    agentId,
    agentName: userAgents.find((a) => a.id === agentId)?.name || 'Unknown',
    ...data,
    cost: Math.round(data.cost * 10000) / 10000,
  }));

  return {
    totalConversations,
    totalMessages,
    totalTokens,
    totalToolCalls,
    totalErrors,
    avgResponseMs,
    estimatedCost: Math.round(estimatedCost * 10000) / 10000,
    dailyMetrics,
    agentBreakdown,
  };
}

// ----------------------------------------------------------
// Logs queries
// ----------------------------------------------------------

/** Get logs for an agent with filtering */
export async function getAgentLogs(
  agentId: string,
  options: {
    level?: string;
    event?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ logs: any[]; total: number }> {
  const db = getDb();
  const limit = Math.min(options.limit || 50, 200);
  const offset = options.offset || 0;

  // Build conditions
  const conditions = [eq(agentLogs.agentId, agentId)];
  if (options.level) conditions.push(eq(agentLogs.level, options.level));
  if (options.event) conditions.push(eq(agentLogs.event, options.event));
  if (options.startDate) conditions.push(gte(agentLogs.createdAt, new Date(options.startDate)));
  if (options.endDate) conditions.push(lte(agentLogs.createdAt, new Date(options.endDate)));

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

  // Count total
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(agentLogs)
    .where(whereClause!);

  const logs = await db
    .select()
    .from(agentLogs)
    .where(whereClause!)
    .orderBy(desc(agentLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return { logs, total: Number(total) };
}
