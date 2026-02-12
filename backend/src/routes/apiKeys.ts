// ============================================================
// GiLo AI – API Keys Routes
// CRUD for agent API keys (JWT-protected)
// ============================================================

import { Router, Request, Response } from 'express';
import { apiKeyModel } from '../models/apiKey';
import { agentModel } from '../models/agent';
import { AuthenticatedRequest } from '../middleware/auth';
import { validate, createApiKeySchema } from '../middleware/validation';

export const apiKeysRouter = Router();

// ----------------------------------------------------------
// POST /api/agents/:id/api-keys — Create a new API key
// ----------------------------------------------------------
apiKeysRouter.post('/:id/api-keys', validate(createApiKeySchema), async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const agentId = req.params.id;
    const { name } = req.body;

    // Verify agent belongs to user
    const agent = await agentModel.findById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (agent.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await apiKeyModel.create(agentId, userId, name.trim());

    res.status(201).json({
      message: 'API key created. Store the key securely — it will not be shown again.',
      key: result.rawKey,
      apiKey: result.apiKey,
    });
  } catch (error: any) {
    console.error('Create API key error:', error);
    res.status(500).json({ error: 'Failed to create API key', details: error.message });
  }
});

// ----------------------------------------------------------
// GET /api/agents/:id/api-keys — List API keys for an agent
// ----------------------------------------------------------
apiKeysRouter.get('/:id/api-keys', async (req: Request, res: Response) => {
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

    const keys = await apiKeyModel.findByAgentId(agentId);
    res.json({
      apiKeys: keys.map(k => apiKeyModel.toResponse(k)),
      total: keys.length,
    });
  } catch (error: any) {
    console.error('List API keys error:', error);
    res.status(500).json({ error: 'Failed to list API keys', details: error.message });
  }
});

// ----------------------------------------------------------
// DELETE /api/agents/:id/api-keys/:keyId — Revoke an API key
// ----------------------------------------------------------
apiKeysRouter.delete('/:id/api-keys/:keyId', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { keyId } = req.params;

    const revoked = await apiKeyModel.revoke(keyId, userId);
    if (!revoked) {
      return res.status(404).json({ error: 'API key not found or already revoked' });
    }

    res.json({ message: 'API key revoked' });
  } catch (error: any) {
    console.error('Revoke API key error:', error);
    res.status(500).json({ error: 'Failed to revoke API key', details: error.message });
  }
});
