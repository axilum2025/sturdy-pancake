// ============================================================
// GiLo AI – Conversation Persistence Service
// Manages conversations & messages in PostgreSQL
// ============================================================

import { eq, desc, and, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { conversations, messages } from '../db/schema';

export interface ConversationSummary {
  id: string;
  agentId: string;
  userId: string | null;
  startedAt: Date;
  messageCount: number;
  preview?: string; // first user message, truncated
}

export interface Message {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: Date;
}

// ----------------------------------------------------------
// Create a new conversation
// ----------------------------------------------------------
async function create(agentId: string, userId?: string): Promise<string> {
  const db = getDb();
  const [row] = await db
    .insert(conversations)
    .values({
      agentId,
      userId: userId || null,
      messageCount: 0,
    })
    .returning({ id: conversations.id });
  return row.id;
}

// ----------------------------------------------------------
// Add a message to a conversation
// ----------------------------------------------------------
async function addMessage(
  conversationId: string,
  role: string,
  content: string,
): Promise<string> {
  const db = getDb();
  const [row] = await db
    .insert(messages)
    .values({ conversationId, role, content })
    .returning({ id: messages.id });

  // Increment message count
  await db
    .update(conversations)
    .set({ messageCount: sql`${conversations.messageCount} + 1` })
    .where(eq(conversations.id, conversationId));

  return row.id;
}

// ----------------------------------------------------------
// Add multiple messages in batch (for replay)
// ----------------------------------------------------------
async function addMessages(
  conversationId: string,
  msgs: { role: string; content: string }[],
): Promise<void> {
  if (msgs.length === 0) return;
  const db = getDb();
  await db.insert(messages).values(
    msgs.map((m) => ({ conversationId, role: m.role, content: m.content })),
  );
  await db
    .update(conversations)
    .set({ messageCount: sql`${conversations.messageCount} + ${msgs.length}` })
    .where(eq(conversations.id, conversationId));
}

// ----------------------------------------------------------
// List conversations for an agent (newest first)
// ----------------------------------------------------------
async function listByAgent(
  agentId: string,
  limit = 30,
  offset = 0,
): Promise<ConversationSummary[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.agentId, agentId))
    .orderBy(desc(conversations.startedAt))
    .limit(limit)
    .offset(offset);

  // Get preview (first user message) for each conversation
  const summaries: ConversationSummary[] = [];
  for (const row of rows) {
    let preview: string | undefined;
    const [firstMsg] = await db
      .select({ content: messages.content })
      .from(messages)
      .where(and(eq(messages.conversationId, row.id), eq(messages.role, 'user')))
      .orderBy(messages.createdAt)
      .limit(1);
    if (firstMsg) {
      preview = firstMsg.content.length > 120
        ? firstMsg.content.slice(0, 120) + '…'
        : firstMsg.content;
    }
    summaries.push({
      id: row.id,
      agentId: row.agentId,
      userId: row.userId,
      startedAt: row.startedAt,
      messageCount: row.messageCount,
      preview,
    });
  }
  return summaries;
}

// ----------------------------------------------------------
// Get all messages for a conversation
// ----------------------------------------------------------
async function getMessages(conversationId: string): Promise<Message[]> {
  const db = getDb();
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
}

// ----------------------------------------------------------
// Delete a conversation (cascade deletes messages)
// ----------------------------------------------------------
async function deleteConversation(conversationId: string): Promise<void> {
  const db = getDb();
  await db.delete(conversations).where(eq(conversations.id, conversationId));
}

// ----------------------------------------------------------
// Find existing conversation or return null
// ----------------------------------------------------------
async function findById(conversationId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return row || null;
}

// ----------------------------------------------------------
// Get the latest conversation for an agent+user pair
// ----------------------------------------------------------
async function getLatest(agentId: string, userId?: string): Promise<string | null> {
  const db = getDb();
  const conditions = userId
    ? and(eq(conversations.agentId, agentId), eq(conversations.userId, userId))
    : eq(conversations.agentId, agentId);
  const [row] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(conditions)
    .orderBy(desc(conversations.startedAt))
    .limit(1);
  return row?.id || null;
}

export const conversationService = {
  create,
  addMessage,
  addMessages,
  listByAgent,
  getMessages,
  deleteConversation,
  findById,
  getLatest,
};
