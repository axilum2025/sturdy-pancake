import { Router, Request, Response } from 'express';
import { storeModel, PublishAgentDTO, StoreCategory } from '../models/storeAgent';
import { agentModel, enforceModelForTier, isByoLlm } from '../models/agent';
import { checkMessageQuota } from '../middleware/messageQuota';
import { copilotService } from '../services/copilotService';
import { userModel } from '../models/user';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { validate, publishAgentSchema, rateAgentSchema } from '../middleware/validation';
import { cacheGet, cacheSet, cacheDelPattern } from '../services/redisService';

export const storeRouter = Router();

// ============================================================
// GET /api/store — List all public store agents (cards view)
// ============================================================
storeRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { category, search } = req.query;
    const options: { category?: StoreCategory; search?: string } = {};

    if (category && category !== 'all') {
      options.category = category as StoreCategory;
    }
    if (search) {
      options.search = search as string;
    }

    // Cache key based on filters (only cache non-search requests for 60s)
    const cacheKey = `cache:store:list:${category || 'all'}:${search || ''}`;
    if (!search) {
      const cached = await cacheGet<{ agents: any[]; total: number }>(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    const listings = await storeModel.findAll(options);

    // Return lightweight cards for the grid
    const cards = listings.map((l) => ({
      id: l.id,
      name: l.name,
      shortDescription: l.shortDescription,
      icon: l.icon,
      iconColor: l.iconColor,
      category: l.category,
      visibility: l.visibility,
      rating: l.rating,
      ratingCount: l.ratingCount,
      usageCount: l.usageCount,
      creatorName: l.creatorName,
    }));

    const result = { agents: cards, total: cards.length };

    // Cache non-search listings for 60 seconds
    if (!search) {
      await cacheSet(cacheKey, result, 60);
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /api/store/categories — List available categories
// ============================================================
storeRouter.get('/categories', (req: Request, res: Response) => {
  const categories = [
    { id: 'productivity', label: 'Productivité', icon: '⚡' },
    { id: 'support', label: 'Support Client', icon: '🎧' },
    { id: 'education', label: 'Éducation', icon: '📚' },
    { id: 'creative', label: 'Créatif', icon: '🎨' },
    { id: 'dev-tools', label: 'Dev Tools', icon: '💻' },
    { id: 'marketing', label: 'Marketing', icon: '📈' },
    { id: 'data', label: 'Data & Analytics', icon: '📊' },
    { id: 'entertainment', label: 'Divertissement', icon: '🎮' },
    { id: 'other', label: 'Autre', icon: '📦' },
  ];
  res.json(categories);
});

// ============================================================
// GET /api/store/admin/check — Check if current user is admin
// (MUST be before /:id to avoid route collision)
// ============================================================
storeRouter.get('/admin/check', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const adminEmail = process.env.ADMIN_EMAIL;
    const isAdmin = !!(adminEmail && user && user.email === adminEmail);
    res.json({ isAdmin });
  } catch (error: any) {
    res.json({ isAdmin: false });
  }
});

// ============================================================
// DELETE /api/store/admin/:id — Admin-only: remove any agent from store
// (MUST be before DELETE /:id to avoid route collision)
// ============================================================
storeRouter.delete('/admin/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail || user.email !== adminEmail) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const listing = await storeModel.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    await storeModel.delete(req.params.id);
    res.json({ message: 'Removed from store by admin' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /api/store/:id — Get full detail of a store agent
// ============================================================
storeRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const listing = await storeModel.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Agent not found in store' });
    }

    // If private, require token
    if (listing.visibility === 'private') {
      const token = req.headers['x-access-token'] as string;
      if (!token || !(await storeModel.validateToken(listing.id, token))) {
        // Return limited info for private agents
        return res.json({
          id: listing.id,
          name: listing.name,
          shortDescription: listing.shortDescription,
          icon: listing.icon,
          iconColor: listing.iconColor,
          category: listing.category,
          visibility: 'private',
          creatorName: listing.creatorName,
          usageCount: listing.usageCount,
          remixCount: listing.remixCount,
          rating: listing.rating,
          ratingCount: listing.ratingCount,
          version: listing.version,
          publishedAt: listing.publishedAt,
          updatedAt: listing.updatedAt,
          requiresToken: true,
        });
      }
    }

    // Enrich configSnapshot with live appearance from source agent (for agents published before appearance was added)
    if (listing.configSnapshot && !listing.configSnapshot.appearance && listing.agentId) {
      try {
        const sourceAgent = await agentModel.findById(listing.agentId);
        if (sourceAgent?.config?.appearance) {
          listing.configSnapshot.appearance = sourceAgent.config.appearance;
        }
      } catch (e) {
        // Ignore — will just not have appearance
      }
    }

    res.json(listing);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /api/store/:id/validate-token — Validate access token
// ============================================================
storeRouter.post('/:id/validate-token', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const valid = await storeModel.validateToken(req.params.id, token);
    res.json({ valid });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /api/store/publish — Publish an agent to the store
// ============================================================
storeRouter.post('/publish', validate(publishAgentSchema), async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const dto: PublishAgentDTO = req.body;

    // Load agent config snapshot
    const agent = await agentModel.findById(dto.agentId);
    const configSnapshot = agent
      ? {
          model: agent.config.model,
          systemPrompt: agent.config.systemPrompt,
          welcomeMessage: agent.config.welcomeMessage || 'Bonjour !',
          temperature: agent.config.temperature,
          maxTokens: agent.config.maxTokens,
          tools: agent.config.tools.map((t) => ({ name: t.name, type: t.type })),
          appearance: agent.config.appearance,
        }
      : {
          model: 'openai/gpt-4.1-nano',
          systemPrompt: dto.description,
          welcomeMessage: 'Bonjour ! Comment puis-je vous aider ?',
          temperature: 0.7,
          maxTokens: 1024,
          tools: [],
        };

    const creatorUser = await userModel.findById(userId);
    const creatorName = creatorUser?.displayName || creatorUser?.email?.split('@')[0] || 'User';
    const listing = await storeModel.publish(userId, creatorName, dto, configSnapshot);

    // Update agent status to deployed
    if (agent) {
      await agentModel.deploy(agent.id);
    }

    // Invalidate store listing cache
    await cacheDelPattern('cache:store:*');

    res.status(201).json(listing);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /api/store/:id/use — Track usage (increment counter)
// ============================================================
storeRouter.post('/:id/use', async (req: Request, res: Response) => {
  try {
    await storeModel.incrementUsage(req.params.id);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /api/store/:id/rate — Rate an agent (1-5 stars, authenticated)
// ============================================================
storeRouter.post('/:id/rate', authMiddleware, validate(rateAgentSchema), async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const listing = await storeModel.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Agent not found' });

    // Prevent self-rating
    if (listing.userId === userId) {
      return res.status(403).json({ error: 'You cannot rate your own agent' });
    }

    const { rating } = req.body;
    const result = await storeModel.rateAgent(req.params.id, userId, rating);

    // Invalidate store caches
    await cacheDelPattern('cache:store:*');

    res.json({ rating: result.rating, ratingCount: result.ratingCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /api/store/:id/my-rating — Get current user's rating for an agent
// ============================================================
storeRouter.get('/:id/my-rating', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const userRating = await storeModel.getUserRating(req.params.id, userId);
    res.json({ rating: userRating });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /api/store/:id/chat — Chat with a store agent (SSE streaming)
// ============================================================
storeRouter.post('/:id/chat', async (req: Request, res: Response) => {
  try {
    const listing = await storeModel.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Validate access for private agents
    if (listing.visibility === 'private') {
      const token = req.headers['x-access-token'] as string;
      if (!token || !(await storeModel.validateToken(listing.id, token))) {
        return res.status(403).json({ error: 'Invalid access token' });
      }
    }

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    // Daily message quota check
    const byoLlm = isByoLlm(listing.configSnapshot as any);
    let storeOwnerTier = 'free';
    try {
      const owner = await userModel.findById(listing.userId);
      if (owner) storeOwnerTier = owner.tier;
    } catch { /* fallback to free */ }
    const quota = await checkMessageQuota(listing.id, storeOwnerTier, byoLlm);
    if (!quota.allowed) {
      return res.status(429).json({
        error: 'Daily message limit reached',
        message: `This agent has reached its daily limit of ${quota.limit} messages. Please try again tomorrow.`,
        limit: quota.limit,
        remaining: 0,
        resetAt: quota.resetAt,
      });
    }

    // Increment usage
    await storeModel.incrementUsage(listing.id);

    // Build the full messages array with system prompt
    const fullMessages = [
      { role: 'system' as const, content: listing.configSnapshot.systemPrompt },
      ...messages.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    // BYO LLM or platform model — reuse owner tier from quota check above
    const config = listing.configSnapshot;
    const { client, model: resolvedModel } = copilotService.getClientForAgent(config as any);
    const modelToUse = byoLlm ? resolvedModel : enforceModelForTier(config.model, storeOwnerTier);

    // SSE streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const stream = await client.chat.completions.create({
        model: modelToUse,
        messages: fullMessages,
        temperature: config.temperature,
        max_tokens: Math.min(config.maxTokens, 1024),
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        const finishReason = chunk.choices?.[0]?.finish_reason;
        if (content) {
          res.write(`data: ${JSON.stringify({ content, done: false })}\n\n`);
        }
        if (finishReason) {
          res.write(`data: ${JSON.stringify({ content: '', done: true })}\n\n`);
        }
      }
    } catch (apiError: any) {
      res.write(`data: ${JSON.stringify({ content: `Erreur API: ${apiError.message}`, done: true })}\n\n`);
    }

    res.end();
  } catch (error: any) {
    console.error('Store chat error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ content: '\n\n[Erreur interne]', done: true })}\n\n`);
      res.end();
    }
  }
});

// ============================================================
// POST /api/store/:id/remix — Remix (clone) a store agent
// ============================================================
storeRouter.post('/:id/remix', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const listing = await storeModel.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Agent not found in store' });
    }

    // Create a new agent cloned from the store agent's config
    const user = (req as AuthenticatedRequest).user;
    const newAgent = await agentModel.create(userId, {
      name: `${listing.name} (Remix)`,
      description: listing.shortDescription,
      config: {
        model: listing.configSnapshot.model,
        systemPrompt: listing.configSnapshot.systemPrompt,
        welcomeMessage: listing.configSnapshot.welcomeMessage,
        temperature: listing.configSnapshot.temperature,
        maxTokens: listing.configSnapshot.maxTokens,
        tools: listing.configSnapshot.tools.map((t) => ({
          id: t.name,
          name: t.name,
          type: (t.type === 'api' ? 'http' : t.type === 'function' ? 'builtin' : t.type) as 'builtin' | 'http' | 'mcp',
          enabled: true,
        })),
      },
    }, user?.tier || 'free', user?.paidAgentSlots || 0);

    // Increment remix count on original
    await storeModel.incrementRemix(listing.id);

    res.status(201).json({ agent: agentModel.toResponse(newAgent) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /api/store/:id/regenerate-token — Regenerate access token
// ============================================================
storeRouter.post('/:id/regenerate-token', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const listing = await storeModel.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (listing.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (listing.visibility !== 'private') {
      return res.status(400).json({ error: 'Only private agents have access tokens' });
    }

    const newToken = await storeModel.regenerateToken(listing.id);
    res.json({ accessToken: newToken });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// DELETE /api/store/:id — Remove from store (owner only)
// ============================================================
storeRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const listing = await storeModel.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (listing.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await storeModel.delete(req.params.id);
    res.json({ message: 'Removed from store' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
