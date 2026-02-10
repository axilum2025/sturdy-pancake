import { Router, Request, Response } from 'express';
import { agentModel, AgentCreateDTO } from '../models/agent';
import { storeModel } from '../models/storeAgent';
import { copilotService, CopilotMessage } from '../services/copilotService';
import { knowledgeService } from '../services/knowledgeService';
import { AuthenticatedRequest } from '../middleware/auth';
import OpenAI from 'openai';

export const agentsRouter = Router();

// Helper: verify agent ownership
async function verifyOwnership(req: Request, res: Response): Promise<string | null> {
  const userId = (req as AuthenticatedRequest).userId;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  const agent = await agentModel.findById(req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return null;
  }
  if (agent.userId !== userId) {
    res.status(403).json({ error: 'Access denied' });
    return null;
  }
  return userId;
}

// ----------------------------------------------------------
// GET /api/agents  –  List user's agents
// ----------------------------------------------------------
agentsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const agents = await agentModel.findByUserId(userId);
    res.json({
      agents: agents.map((a) => agentModel.toResponse(a)),
      total: agents.length,
    });
  } catch (error: any) {
    const pgErr = error?.cause || error;
    console.error('List agents error:', { message: error.message, cause: pgErr?.message, code: pgErr?.code });
    res.status(500).json({ error: 'Failed to list agents' });
  }
});

// ----------------------------------------------------------
// POST /api/agents  –  Create a new agent
// ----------------------------------------------------------
agentsRouter.post('/', async (req: Request, res: Response) => {
  console.log('[Agents] Create request received:', { body: req.body, userId: (req as AuthenticatedRequest).userId });
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const userTier = (req as AuthenticatedRequest).user?.tier || 'free';
    const { name, description, config } = req.body as AgentCreateDTO & { config?: any };

    console.log('[Agents] Processing creation:', { name, userTier });

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Agent name is required' });
    }

    const agent = await agentModel.create(userId, { name, description, config }, userTier);
    console.log('[Agents] Agent created successfully:', agent.id);
    res.status(201).json(agentModel.toResponse(agent));
  } catch (error: any) {
    const pgErr = error?.cause || error;
    console.error('Create agent error:', { message: error.message, cause: pgErr?.message, code: pgErr?.code });
    const message = error?.message || 'Failed to create agent';
    if (typeof message === 'string' && message.toLowerCase().includes('agent limit reached')) {
      return res.status(403).json({ error: message });
    }
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// ----------------------------------------------------------
// GET /api/agents/:id  –  Get agent details (owner only)
// ----------------------------------------------------------
agentsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = await verifyOwnership(req, res);
    if (!userId) return;

    const agent = await agentModel.findById(req.params.id);
    res.json(agentModel.toResponse(agent!));
  } catch (error: any) {
    console.error('Get agent error:', error.message);
    res.status(500).json({ error: 'Failed to get agent' });
  }
});

// ----------------------------------------------------------
// PATCH /api/agents/:id  –  Update agent metadata (owner only)
// ----------------------------------------------------------
agentsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = await verifyOwnership(req, res);
    if (!userId) return;

    const { name, description } = req.body;
    const agent = await agentModel.update(req.params.id, { name, description });
    res.json(agentModel.toResponse(agent));
  } catch (error: any) {
    console.error('Update agent error:', error.message);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// ----------------------------------------------------------
// PATCH /api/agents/:id/config  –  Update agent config (owner only)
// ----------------------------------------------------------
agentsRouter.patch('/:id/config', async (req: Request, res: Response) => {
  try {
    const userId = await verifyOwnership(req, res);
    if (!userId) return;

    const config = req.body;
    const agent = await agentModel.updateConfig(req.params.id, config);
    res.json(agentModel.toResponse(agent));
  } catch (error: any) {
    console.error('Update agent config error:', error.message);
    res.status(500).json({ error: 'Failed to update agent config' });
  }
});

// ----------------------------------------------------------
// POST /api/agents/:id/deploy  –  Deploy agent (owner only)
// ----------------------------------------------------------
agentsRouter.post('/:id/deploy', async (req: Request, res: Response) => {
  try {
    const userId = await verifyOwnership(req, res);
    if (!userId) return;

    const agent = await agentModel.deploy(req.params.id);
    res.json({
      message: 'Agent deployed successfully',
      agent: agentModel.toResponse(agent),
      endpoint: agent.endpoint,
    });
  } catch (error: any) {
    console.error('Deploy agent error:', error.message);
    res.status(500).json({ error: 'Failed to deploy agent' });
  }
});

// ----------------------------------------------------------
// DELETE /api/agents/:id  –  Delete agent (owner only)
// ----------------------------------------------------------
agentsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = await verifyOwnership(req, res);
    if (!userId) return;

    // Remove from store if published
    await storeModel.deleteByAgentId(req.params.id);
    await agentModel.delete(req.params.id);
    res.json({ message: 'Agent deleted' });
  } catch (error: any) {
    console.error('Delete agent error:', error.message);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

// ----------------------------------------------------------
// POST /api/agents/:id/chat  –  Chat with agent (owner only)
// ----------------------------------------------------------
agentsRouter.post('/:id/chat', async (req: Request, res: Response) => {
  try {
    const userId = await verifyOwnership(req, res);
    if (!userId) return;

    const agent = (await agentModel.findById(req.params.id))!;
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const { client } = copilotService.getClientInfo();

    // RAG: search knowledge base for relevant context
    let systemPrompt = agent.config.systemPrompt;
    let ragCitations: import('../services/knowledgeService').RagCitation[] = [];
    const ragEnabled = agent.config.knowledgeBase && agent.config.knowledgeBase.length > 0;
    if (ragEnabled) {
      const lastUserMsg = [...messages].reverse().find((m: CopilotMessage) => m.role === 'user');
      if (lastUserMsg) {
        try {
          const results = await knowledgeService.search(agent.id, lastUserMsg.content, 5);
          if (results.length > 0) {
            systemPrompt += '\n\n' + knowledgeService.buildRagContext(results);
            ragCitations = knowledgeService.buildCitations(results);
          }
        } catch {
          // RAG fallback: continue without context
        }
      }
    }

    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(messages as CopilotMessage[]).map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const stream = await client.chat.completions.create({
      model: agent.config.model,
      messages: openaiMessages,
      temperature: agent.config.temperature,
      max_tokens: agent.config.maxTokens,
      stream: true,
    });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Send RAG citations first so the frontend can display sources
    if (ragCitations.length > 0) {
      res.write(`data: ${JSON.stringify({ type: 'citations', citations: ragCitations })}\n\n`);
    }

    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      const finishReason = chunk.choices?.[0]?.finish_reason;
      if (content) {
        res.write(`data: ${JSON.stringify({ type: 'content', content })}\n\n`);
      }
      if (finishReason) {
        res.write(`data: ${JSON.stringify({ type: 'done', finishReason })}\n\n`);
      }
    }

    await agentModel.update(agent.id, {
      totalConversations: agent.totalConversations + 1,
      totalMessages: agent.totalMessages + messages.length + 1,
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Agent chat error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Agent chat failed' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Internal error' })}\n\n`);
      res.end();
    }
  }
});
