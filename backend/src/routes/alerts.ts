// ============================================================
// GiLo AI – Alerts Routes
// CRUD for agent alert rules + alert checking
// ============================================================

import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { validate, createAlertSchema } from '../middleware/validation';
import { agentModel } from '../models/agent';
import { getDb } from '../db';
import { agentAlerts, agentMetrics } from '../db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';

export const alertsRouter = Router();

// ----------------------------------------------------------
// GET /api/agents/:id/alerts  – List alert rules for an agent
// ----------------------------------------------------------
alertsRouter.get('/:id/alerts', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const agent = await agentModel.findById(req.params.id);
    if (!agent || agent.userId !== userId) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const db = getDb();
    const alerts = await db
      .select()
      .from(agentAlerts)
      .where(eq(agentAlerts.agentId, agent.id))
      .orderBy(desc(agentAlerts.createdAt));

    res.json({ alerts });
  } catch (error: any) {
    console.error('List alerts error:', error.message);
    res.status(500).json({ error: 'Failed to list alerts' });
  }
});

// ----------------------------------------------------------
// POST /api/agents/:id/alerts  – Create an alert rule
// ----------------------------------------------------------
alertsRouter.post('/:id/alerts', validate(createAlertSchema), async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const agent = await agentModel.findById(req.params.id);
    if (!agent || agent.userId !== userId) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const { type, config } = req.body;

    const db = getDb();
    const [alert] = await db
      .insert(agentAlerts)
      .values({
        agentId: agent.id,
        userId,
        type,
        config: {
          threshold: config.threshold,
          window: config.window || '24h',
          notifyEmail: config.notifyEmail,
          notifyWebhook: config.notifyWebhook,
        },
      })
      .returning();

    res.status(201).json({ alert });
  } catch (error: any) {
    console.error('Create alert error:', error.message);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// ----------------------------------------------------------
// PATCH /api/agents/:id/alerts/:alertId  – Update alert rule
// ----------------------------------------------------------
alertsRouter.patch('/:id/alerts/:alertId', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const db = getDb();
    const [alert] = await db
      .select()
      .from(agentAlerts)
      .where(eq(agentAlerts.id, req.params.alertId));

    if (!alert || alert.userId !== userId) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const updates: Record<string, unknown> = {};
    if (req.body.config) updates.config = { ...alert.config, ...req.body.config };
    if (req.body.enabled !== undefined) updates.enabled = req.body.enabled ? 1 : 0;

    const [updated] = await db
      .update(agentAlerts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agentAlerts.id, alert.id))
      .returning();

    res.json({ alert: updated });
  } catch (error: any) {
    console.error('Update alert error:', error.message);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// ----------------------------------------------------------
// DELETE /api/agents/:id/alerts/:alertId  – Delete alert rule
// ----------------------------------------------------------
alertsRouter.delete('/:id/alerts/:alertId', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const db = getDb();
    const [alert] = await db
      .select()
      .from(agentAlerts)
      .where(eq(agentAlerts.id, req.params.alertId));

    if (!alert || alert.userId !== userId) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    await db.delete(agentAlerts).where(eq(agentAlerts.id, alert.id));
    res.json({ message: 'Alert deleted' });
  } catch (error: any) {
    console.error('Delete alert error:', error.message);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

// ----------------------------------------------------------
// POST /api/agents/:id/alerts/check  – Manually check alerts
// ----------------------------------------------------------
alertsRouter.post('/:id/alerts/check', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const agent = await agentModel.findById(req.params.id);
    if (!agent || agent.userId !== userId) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const triggered = await checkAlerts(agent.id);
    res.json({ triggered });
  } catch (error: any) {
    console.error('Check alerts error:', error.message);
    res.status(500).json({ error: 'Failed to check alerts' });
  }
});

// ----------------------------------------------------------
// Alert checking logic
// ----------------------------------------------------------

export async function checkAlerts(agentId: string): Promise<Array<{ alertId: string; type: string; message: string }>> {
  const db = getDb();
  const triggered: Array<{ alertId: string; type: string; message: string }> = [];

  // Get active alerts for this agent
  const alerts = await db
    .select()
    .from(agentAlerts)
    .where(and(eq(agentAlerts.agentId, agentId), eq(agentAlerts.enabled, 1)));

  if (alerts.length === 0) return triggered;

  // Get recent metrics (last 24h default)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const recentMetrics = await db
    .select()
    .from(agentMetrics)
    .where(and(eq(agentMetrics.agentId, agentId), gte(agentMetrics.date, yesterday)));

  const totalErrors = recentMetrics.reduce((s, m) => s + m.errorCount, 0);
  const totalMessages = recentMetrics.reduce((s, m) => s + m.messages, 0);
  const totalCost = recentMetrics.reduce((s, m) => s + m.estimatedCost, 0);

  for (const alert of alerts) {
    const threshold = alert.config.threshold;
    let message = '';

    switch (alert.type) {
      case 'error_rate': {
        const errorRate = totalMessages > 0 ? (totalErrors / totalMessages) * 100 : 0;
        if (errorRate > threshold) {
          message = `Error rate ${errorRate.toFixed(1)}% exceeds threshold ${threshold}%`;
        }
        break;
      }
      case 'cost_limit': {
        if (totalCost > threshold) {
          message = `Estimated cost $${totalCost.toFixed(4)} exceeds limit $${threshold}`;
        }
        break;
      }
      case 'inactivity': {
        // threshold = hours of inactivity
        if (recentMetrics.length === 0 || totalMessages === 0) {
          message = `No activity in the last ${threshold} hours`;
        }
        break;
      }
      case 'rate_limit': {
        if (totalMessages > threshold) {
          message = `Message count ${totalMessages} exceeds rate limit ${threshold}`;
        }
        break;
      }
    }

    if (message) {
      triggered.push({ alertId: alert.id, type: alert.type, message });

      // Update lastTriggeredAt
      await db
        .update(agentAlerts)
        .set({ lastTriggeredAt: new Date() })
        .where(eq(agentAlerts.id, alert.id));

      // Send notification if webhook configured
      if (alert.config.notifyWebhook) {
        fetch(alert.config.notifyWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId,
            alertType: alert.type,
            message,
            timestamp: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(5000),
        }).catch(() => {});
      }
    }
  }

  return triggered;
}
