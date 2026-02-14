// ============================================================
// GiLo AI – Integrations Routes
// OAuth flows + CRUD for agent integrations (JWT-protected)
// ============================================================

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { integrationModel } from '../models/integration';
import { agentModel } from '../models/agent';
import { getProvider, getProviderCatalog } from '../services/oauthProviders';
import { AuthenticatedRequest } from '../middleware/auth';

export const integrationsRouter = Router();

// In-memory store for OAuth state (short-lived, maps state → { userId, agentId, scopes })
const oauthStates = new Map<string, { userId: string; agentId: string; scopes: string[]; createdAt: number }>();

// Clean up expired states every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of oauthStates) {
    if (now - val.createdAt > 10 * 60 * 1000) oauthStates.delete(key);
  }
}, 10 * 60 * 1000);

// ----------------------------------------------------------
// GET /api/integrations/providers — List available providers
// ----------------------------------------------------------
integrationsRouter.get('/providers', async (_req: Request, res: Response) => {
  try {
    const catalog = getProviderCatalog();
    res.json({ providers: catalog });
  } catch (error: any) {
    console.error('List providers error:', error);
    res.status(500).json({ error: 'Failed to list providers', details: error.message });
  }
});

// ----------------------------------------------------------
// GET /api/integrations/:agentId — List integrations for agent
// ----------------------------------------------------------
integrationsRouter.get('/:agentId', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { agentId } = req.params;

    // Verify agent belongs to user
    const agent = await agentModel.findById(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (agent.userId !== userId) return res.status(403).json({ error: 'Access denied' });

    const rows = await integrationModel.findByAgentId(agentId);
    res.json({
      integrations: rows.map(r => integrationModel.toResponse(r)),
      total: rows.length,
    });
  } catch (error: any) {
    console.error('List integrations error:', error);
    res.status(500).json({ error: 'Failed to list integrations', details: error.message });
  }
});

// ----------------------------------------------------------
// POST /api/integrations/:agentId/:provider/auth — Start OAuth flow
// ----------------------------------------------------------
integrationsRouter.post('/:agentId/:provider/auth', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { agentId, provider: providerId } = req.params;
    const { scopes } = req.body;

    // Verify agent belongs to user
    const agent = await agentModel.findById(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (agent.userId !== userId) return res.status(403).json({ error: 'Access denied' });

    // Get provider adapter
    const provider = getProvider(providerId);
    if (!provider) return res.status(400).json({ error: `Unknown provider: ${providerId}` });
    if (!provider.isConfigured()) {
      return res.status(400).json({ error: `Provider ${providerId} is not configured. Set environment variables.` });
    }

    // Generate state token
    const state = crypto.randomBytes(32).toString('hex');
    oauthStates.set(state, { userId, agentId, scopes: scopes || [], createdAt: Date.now() });

    // Generate auth URL
    const authUrl = provider.getAuthUrl(state, scopes);
    res.json({ authUrl, state });
  } catch (error: any) {
    console.error('Start OAuth error:', error);
    res.status(500).json({ error: 'Failed to start OAuth flow', details: error.message });
  }
});

// ----------------------------------------------------------
// GET /api/integrations/:provider/callback — OAuth callback (public, no JWT)
// ----------------------------------------------------------
integrationsRouter.get('/:provider/callback', async (req: Request, res: Response) => {
  try {
    const { provider: providerId } = req.params;
    const { code, state, error: oauthError } = req.query;

    // Check for OAuth error
    if (oauthError) {
      return res.redirect(`${process.env.FRONTEND_URL || 'https://nice-smoke-0fc3e1e0f.6.azurestaticapps.net'}/?integrationError=${encodeURIComponent(oauthError as string)}`);
    }

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL || 'https://nice-smoke-0fc3e1e0f.6.azurestaticapps.net'}/?integrationError=missing_params`);
    }

    // Validate state
    const stateData = oauthStates.get(state as string);
    if (!stateData) {
      return res.redirect(`${process.env.FRONTEND_URL || 'https://nice-smoke-0fc3e1e0f.6.azurestaticapps.net'}/?integrationError=invalid_state`);
    }
    oauthStates.delete(state as string);

    // Check state expiry (10 min)
    if (Date.now() - stateData.createdAt > 10 * 60 * 1000) {
      return res.redirect(`${process.env.FRONTEND_URL || 'https://nice-smoke-0fc3e1e0f.6.azurestaticapps.net'}/?integrationError=state_expired`);
    }

    // Get provider adapter
    const provider = getProvider(providerId);
    if (!provider) {
      return res.redirect(`${process.env.FRONTEND_URL || 'https://nice-smoke-0fc3e1e0f.6.azurestaticapps.net'}/?integrationError=unknown_provider`);
    }

    // Exchange code for tokens
    const tokens = await provider.exchangeCode(code as string);

    // Get user info
    let userInfo: { email?: string; name?: string; avatarUrl?: string } = {};
    try {
      userInfo = await provider.getUserInfo(tokens.accessToken);
    } catch (e) {
      console.warn('Could not fetch user info for integration:', e);
    }

    // Check if integration already exists for this agent+provider
    const existing = await integrationModel.findByAgentAndProvider(stateData.agentId, providerId);

    if (existing) {
      // Update existing integration
      await integrationModel.update(existing.id, stateData.userId, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        status: 'active',
        errorMessage: null,
        metadata: {
          email: userInfo.email,
          accountName: userInfo.name,
          avatarUrl: userInfo.avatarUrl,
        },
      });
    } else {
      // Create new integration
      await integrationModel.create(stateData.agentId, stateData.userId, {
        provider: providerId,
        label: userInfo.name || userInfo.email || provider.name,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        metadata: {
          email: userInfo.email,
          accountName: userInfo.name,
          avatarUrl: userInfo.avatarUrl,
        },
      });
    }

    // Redirect back to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'https://nice-smoke-0fc3e1e0f.6.azurestaticapps.net';
    res.redirect(`${frontendUrl}/?integrationSuccess=${providerId}&agentId=${stateData.agentId}`);
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'https://nice-smoke-0fc3e1e0f.6.azurestaticapps.net';
    res.redirect(`${frontendUrl}/?integrationError=${encodeURIComponent(error.message)}`);
  }
});

// ----------------------------------------------------------
// POST /api/integrations/:agentId/apikey — Add API key integration
// ----------------------------------------------------------
integrationsRouter.post('/:agentId/apikey', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { agentId } = req.params;
    const { provider, label, apiKey, baseUrl } = req.body;

    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'provider and apiKey are required' });
    }

    // Verify agent belongs to user
    const agent = await agentModel.findById(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (agent.userId !== userId) return res.status(403).json({ error: 'Access denied' });

    const integration = await integrationModel.create(agentId, userId, {
      provider,
      label: label || provider,
      metadata: { apiKey, baseUrl },
    });

    res.status(201).json({ integration });
  } catch (error: any) {
    console.error('Add API key integration error:', error);
    res.status(500).json({ error: 'Failed to add integration', details: error.message });
  }
});

// ----------------------------------------------------------
// DELETE /api/integrations/:agentId/:integrationId — Disconnect
// ----------------------------------------------------------
integrationsRouter.delete('/:agentId/:integrationId', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { agentId, integrationId } = req.params;

    // Verify agent belongs to user
    const agent = await agentModel.findById(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (agent.userId !== userId) return res.status(403).json({ error: 'Access denied' });

    // Optionally revoke token
    const integration = await integrationModel.findById(integrationId);
    if (integration && integration.accessToken) {
      try {
        const provider = getProvider(integration.provider);
        if (provider) {
          await provider.revokeToken(integration.accessToken);
        }
      } catch (e) {
        console.warn('Token revocation failed (continuing with delete):', e);
      }
    }

    const deleted = await integrationModel.delete(integrationId, userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Integration not found or access denied' });
    }

    res.json({ message: 'Integration disconnected', id: integrationId });
  } catch (error: any) {
    console.error('Delete integration error:', error);
    res.status(500).json({ error: 'Failed to delete integration', details: error.message });
  }
});
