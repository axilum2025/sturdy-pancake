// ============================================================
// GiLo AI – Webhook Routes
// CRUD for agent webhooks (JWT-protected)
// ============================================================

import { Router, Request, Response } from 'express';
import { webhookModel, WEBHOOK_EVENTS } from '../models/webhook';
import { agentModel } from '../models/agent';
import { AuthenticatedRequest } from '../middleware/auth';

export const webhooksRouter = Router();

// ----------------------------------------------------------
// GET /api/agents/:id/webhooks — List webhooks for an agent
// ----------------------------------------------------------
webhooksRouter.get('/:id/webhooks', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const agentId = req.params.id;

    // Verify agent belongs to user
    const agent = await agentModel.findById(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (agent.userId !== userId) return res.status(403).json({ error: 'Access denied' });

    const hooks = await webhookModel.findByAgentId(agentId);
    res.json({
      webhooks: hooks.map(h => webhookModel.toResponse(h)),
      total: hooks.length,
      availableEvents: WEBHOOK_EVENTS,
    });
  } catch (error: any) {
    console.error('List webhooks error:', error);
    res.status(500).json({ error: 'Failed to list webhooks', details: error.message });
  }
});

// ----------------------------------------------------------
// POST /api/agents/:id/webhooks — Create a webhook
// ----------------------------------------------------------
webhooksRouter.post('/:id/webhooks', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const agentId = req.params.id;
    const { url, events } = req.body;

    if (!url || !url.trim()) {
      return res.status(400).json({ error: 'Webhook URL is required' });
    }
    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        error: 'At least one event is required',
        availableEvents: WEBHOOK_EVENTS,
      });
    }

    // Validate events
    const invalidEvents = events.filter((e: string) => !WEBHOOK_EVENTS.includes(e as any));
    if (invalidEvents.length > 0) {
      return res.status(400).json({
        error: `Invalid events: ${invalidEvents.join(', ')}`,
        availableEvents: WEBHOOK_EVENTS,
      });
    }

    // Verify agent belongs to user
    const agent = await agentModel.findById(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (agent.userId !== userId) return res.status(403).json({ error: 'Access denied' });

    const result = await webhookModel.create(agentId, userId, { url, events });

    res.status(201).json({
      message: 'Webhook created. Store the secret securely — it will not be shown again.',
      webhook: result.webhook,
      secret: result.secret,
    });
  } catch (error: any) {
    console.error('Create webhook error:', error);
    res.status(500).json({ error: 'Failed to create webhook', details: error.message });
  }
});

// ----------------------------------------------------------
// PATCH /api/agents/:id/webhooks/:webhookId — Update webhook
// ----------------------------------------------------------
webhooksRouter.patch('/:id/webhooks/:webhookId', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { webhookId } = req.params;
    const { url, events, active } = req.body;

    // Validate events if provided
    if (events) {
      const invalidEvents = events.filter((e: string) => !WEBHOOK_EVENTS.includes(e as any));
      if (invalidEvents.length > 0) {
        return res.status(400).json({
          error: `Invalid events: ${invalidEvents.join(', ')}`,
          availableEvents: WEBHOOK_EVENTS,
        });
      }
    }

    const result = await webhookModel.update(webhookId, userId, { url, events, active });
    if (!result) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({ webhook: result });
  } catch (error: any) {
    console.error('Update webhook error:', error);
    res.status(500).json({ error: 'Failed to update webhook', details: error.message });
  }
});

// ----------------------------------------------------------
// DELETE /api/agents/:id/webhooks/:webhookId — Delete webhook
// ----------------------------------------------------------
webhooksRouter.delete('/:id/webhooks/:webhookId', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { webhookId } = req.params;

    const deleted = await webhookModel.delete(webhookId, userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({ message: 'Webhook deleted' });
  } catch (error: any) {
    console.error('Delete webhook error:', error);
    res.status(500).json({ error: 'Failed to delete webhook', details: error.message });
  }
});
