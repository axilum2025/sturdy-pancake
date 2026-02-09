// ============================================================
// GiLo AI – Webhooks Routes
// CRUD for agent webhooks (JWT-protected)
// ============================================================

import { Router, Request, Response } from 'express';
import { webhookModel, WEBHOOK_EVENTS } from '../models/webhook';
import { agentModel } from '../models/agent';
import { AuthenticatedRequest } from '../middleware/auth';

export const webhooksRouter = Router();

// ----------------------------------------------------------
// POST /api/agents/:id/webhooks — Create a new webhook
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
      return res.status(400).json({ error: 'At least one event is required', availableEvents: WEBHOOK_EVENTS });
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
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (agent.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await webhookModel.create(agentId, userId, { url: url.trim(), events });

    res.status(201).json({
      message: 'Webhook created. Store the signing secret securely.',
      webhook: result.webhook,
      secret: result.secret,
    });
  } catch (error: any) {
    console.error('Create webhook error:', error);
    res.status(500).json({ error: 'Failed to create webhook', details: error.message });
  }
});

// ----------------------------------------------------------
// GET /api/agents/:id/webhooks — List webhooks for an agent
// ----------------------------------------------------------
webhooksRouter.get('/:id/webhooks', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const agentId = req.params.id;

    // Verify agent belongs to user
    const agent = await agentModel.findById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (agent.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const hooks = await webhookModel.findByAgentId(agentId);
    res.json({
      webhooks: hooks.map(h => webhookModel.toResponse(h)),
      total: hooks.length,
    });
  } catch (error: any) {
    console.error('List webhooks error:', error);
    res.status(500).json({ error: 'Failed to list webhooks', details: error.message });
  }
});

// ----------------------------------------------------------
// PATCH /api/agents/:id/webhooks/:webhookId — Update a webhook
// ----------------------------------------------------------
webhooksRouter.patch('/:id/webhooks/:webhookId', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { webhookId } = req.params;
    const { url, events, active } = req.body;

    const updated = await webhookModel.update(webhookId, userId, { url, events, active });
    if (!updated) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({ webhook: updated });
  } catch (error: any) {
    console.error('Update webhook error:', error);
    res.status(500).json({ error: 'Failed to update webhook', details: error.message });
  }
});

// ----------------------------------------------------------
// DELETE /api/agents/:id/webhooks/:webhookId — Delete a webhook
// ----------------------------------------------------------
webhooksRouter.delete('/:id/webhooks/:webhookId', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { webhookId } = req.params;

    const deleted = await webhookModel.delete(webhookId, userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Webhook not found or access denied' });
    }

    res.json({ message: 'Webhook deleted' });
  } catch (error: any) {
    console.error('Delete webhook error:', error);
    res.status(500).json({ error: 'Failed to delete webhook', details: error.message });
  }
});
