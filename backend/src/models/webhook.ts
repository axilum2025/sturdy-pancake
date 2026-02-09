// ============================================================
// GiLo AI – Webhook Model
// Manages webhooks for agent events
// ============================================================

import { eq, and } from 'drizzle-orm';
import { randomBytes, createHmac } from 'crypto';
import { getDb } from '../db';
import { webhooks } from '../db/schema';

// ---- Types ----

export type WebhookEvent = 'on_conversation_start' | 'on_message' | 'on_escalation' | 'on_error';

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  'on_conversation_start',
  'on_message',
  'on_escalation',
  'on_error',
];

export interface Webhook {
  id: string;
  agentId: string;
  userId: string;
  url: string;
  events: string[];
  secret: string;
  active: number;
  lastTriggeredAt: Date | null;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookResponse {
  id: string;
  agentId: string;
  url: string;
  events: string[];
  active: boolean;
  lastTriggeredAt: Date | null;
  failureCount: number;
  createdAt: Date;
}

export interface WebhookCreateDTO {
  url: string;
  events: string[];
}

// ---- Model ----

class WebhookModel {

  /**
   * Create a new webhook for an agent
   */
  async create(agentId: string, userId: string, dto: WebhookCreateDTO): Promise<{ webhook: WebhookResponse; secret: string }> {
    const db = getDb();
    const secret = randomBytes(32).toString('hex');

    const [row] = await db.insert(webhooks).values({
      agentId,
      userId,
      url: dto.url,
      events: dto.events,
      secret,
    }).returning();

    return {
      webhook: this.toResponse(row as unknown as Webhook),
      secret, // Only returned once at creation
    };
  }

  /**
   * List webhooks for an agent
   */
  async findByAgentId(agentId: string): Promise<Webhook[]> {
    const db = getDb();
    const rows = await db.select().from(webhooks)
      .where(eq(webhooks.agentId, agentId))
      .orderBy(webhooks.createdAt);
    return rows as unknown as Webhook[];
  }

  /**
   * Get a specific webhook
   */
  async findById(id: string): Promise<Webhook | null> {
    const db = getDb();
    const [row] = await db.select().from(webhooks)
      .where(eq(webhooks.id, id))
      .limit(1);
    return (row as unknown as Webhook) || null;
  }

  /**
   * Update a webhook
   */
  async update(id: string, userId: string, data: Partial<WebhookCreateDTO & { active: boolean }>): Promise<WebhookResponse | null> {
    const db = getDb();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.url !== undefined) updateData.url = data.url;
    if (data.events !== undefined) updateData.events = data.events;
    if (data.active !== undefined) updateData.active = data.active ? 1 : 0;

    const [row] = await db.update(webhooks)
      .set(updateData)
      .where(and(eq(webhooks.id, id), eq(webhooks.userId, userId)))
      .returning();

    return row ? this.toResponse(row as unknown as Webhook) : null;
  }

  /**
   * Delete a webhook
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const db = getDb();
    const result = await db.delete(webhooks)
      .where(and(eq(webhooks.id, id), eq(webhooks.userId, userId)))
      .returning();
    return result.length > 0;
  }

  /**
   * Fire webhooks for an agent event
   */
  async fire(agentId: string, event: WebhookEvent, payload: Record<string, unknown>): Promise<void> {
    const db = getDb();
    const hooks = await db.select().from(webhooks)
      .where(eq(webhooks.agentId, agentId));

    const activeHooks = (hooks as unknown as Webhook[]).filter(
      h => h.active === 1 && h.events.includes(event)
    );

    for (const hook of activeHooks) {
      try {
        const body = JSON.stringify({
          event,
          agentId,
          timestamp: new Date().toISOString(),
          data: payload,
        });

        const signature = createHmac('sha256', hook.secret)
          .update(body)
          .digest('hex');

        const response = await fetch(hook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-GiLo-Signature': `sha256=${signature}`,
            'X-GiLo-Event': event,
          },
          body,
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (response.ok) {
          await db.update(webhooks)
            .set({ lastTriggeredAt: new Date(), failureCount: 0 })
            .where(eq(webhooks.id, hook.id));
        } else {
          await db.update(webhooks)
            .set({
              lastTriggeredAt: new Date(),
              failureCount: hook.failureCount + 1,
            })
            .where(eq(webhooks.id, hook.id));
        }
      } catch (error) {
        console.error(`Webhook fire error for ${hook.url}:`, error);
        await db.update(webhooks)
          .set({ failureCount: hook.failureCount + 1 })
          .where(eq(webhooks.id, hook.id));
      }
    }
  }

  toResponse(row: Webhook): WebhookResponse {
    return {
      id: row.id,
      agentId: row.agentId,
      url: row.url,
      events: row.events,
      active: row.active === 1,
      lastTriggeredAt: row.lastTriggeredAt,
      failureCount: row.failureCount,
      createdAt: row.createdAt,
    };
  }
}

export const webhookModel = new WebhookModel();
