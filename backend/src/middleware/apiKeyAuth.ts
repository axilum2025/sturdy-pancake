// ============================================================
// GiLo AI – API Key Authentication Middleware
// Authenticates public API requests using API keys
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { apiKeyModel } from '../models/apiKey';
import { agentModel } from '../models/agent';

export interface ApiKeyRequest extends Request {
  apiKeyId: string;
  agentId: string;
  apiKeyUserId: string;
  agentTier: string;
}

/**
 * Middleware that authenticates requests using API keys.
 * Expects header: Authorization: Bearer gilo_xxxxxxxxxxxxx
 * Or query param: ?api_key=gilo_xxxxxxxxxxxxx
 */
export const apiKeyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract API key from Authorization header or query param
    let rawKey: string | undefined;

    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer gilo_')) {
      rawKey = authHeader.substring(7);
    } else if (typeof req.query.api_key === 'string' && req.query.api_key.startsWith('gilo_')) {
      rawKey = req.query.api_key;
    } else if (typeof req.headers['x-api-key'] === 'string') {
      rawKey = req.headers['x-api-key'] as string;
    }

    if (!rawKey) {
      res.status(401).json({
        error: 'API key required',
        message: 'Provide an API key via Authorization: Bearer <key>, X-Api-Key header, or ?api_key= query param.',
      });
      return;
    }

    // Validate the key
    const result = await apiKeyModel.validate(rawKey);
    if (!result) {
      res.status(401).json({ error: 'Invalid or revoked API key' });
      return;
    }

    // Check that the agent exists and is deployed
    const agent = await agentModel.findById(result.agentId);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    if (agent.status !== 'deployed') {
      res.status(403).json({ error: 'Agent is not deployed. Deploy the agent first.' });
      return;
    }

    // Attach to request
    (req as ApiKeyRequest).apiKeyId = result.keyId;
    (req as ApiKeyRequest).agentId = result.agentId;
    (req as ApiKeyRequest).apiKeyUserId = result.userId;
    (req as ApiKeyRequest).agentTier = agent.tier;

    next();
  } catch (error: any) {
    console.error('API key auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};
