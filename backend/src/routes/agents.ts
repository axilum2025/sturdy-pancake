import { Router, Request, Response } from 'express';
import { agentModel, AgentCreateDTO } from '../models/agent';
import { copilotService, CopilotMessage } from '../services/copilotService';
import OpenAI from 'openai';

export const agentsRouter = Router();

// ----------------------------------------------------------
// GET /api/agents  –  List user's agents
// ----------------------------------------------------------
agentsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'demo-user-id';
    const agents = await agentModel.findByUserId(userId);
    res.json({
      agents: agents.map((a) => agentModel.toResponse(a)),
      total: agents.length,
    });
  } catch (error: any) {
    console.error('List agents error:', error);
    res.status(500).json({ error: 'Failed to list agents', details: error.message });
  }
});

// ----------------------------------------------------------
// POST /api/agents  –  Create a new agent
// ----------------------------------------------------------
agentsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'demo-user-id';
    const userTier = (req as any).userTier || 'free';
    const { name, description, config } = req.body as AgentCreateDTO & { config?: any };

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Agent name is required' });
    }

    const agent = await agentModel.create(userId, { name, description, config }, userTier);
    res.status(201).json(agentModel.toResponse(agent));
  } catch (error: any) {
    console.error('Create agent error:', error);
    res.status(500).json({ error: 'Failed to create agent', details: error.message });
  }
});

// ----------------------------------------------------------
// GET /api/agents/:id  –  Get agent details
// ----------------------------------------------------------
agentsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const agent = await agentModel.findById(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agentModel.toResponse(agent));
  } catch (error: any) {
    console.error('Get agent error:', error);
    res.status(500).json({ error: 'Failed to get agent', details: error.message });
  }
});

// ----------------------------------------------------------
// PATCH /api/agents/:id  –  Update agent metadata
// ----------------------------------------------------------
agentsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const agent = await agentModel.update(req.params.id, { name, description });
    res.json(agentModel.toResponse(agent));
  } catch (error: any) {
    console.error('Update agent error:', error);
    res.status(500).json({ error: 'Failed to update agent', details: error.message });
  }
});

// ----------------------------------------------------------
// PATCH /api/agents/:id/config  –  Update agent configuration
// ----------------------------------------------------------
agentsRouter.patch('/:id/config', async (req: Request, res: Response) => {
  try {
    const config = req.body;
    const agent = await agentModel.updateConfig(req.params.id, config);
    res.json(agentModel.toResponse(agent));
  } catch (error: any) {
    console.error('Update agent config error:', error);
    res.status(500).json({ error: 'Failed to update agent config', details: error.message });
  }
});

// ----------------------------------------------------------
// POST /api/agents/:id/deploy  –  Deploy agent
// ----------------------------------------------------------
agentsRouter.post('/:id/deploy', async (req: Request, res: Response) => {
  try {
    const agent = await agentModel.deploy(req.params.id);
    res.json({
      message: 'Agent deployed successfully',
      agent: agentModel.toResponse(agent),
      endpoint: agent.endpoint,
    });
  } catch (error: any) {
    console.error('Deploy agent error:', error);
    res.status(500).json({ error: 'Failed to deploy agent', details: error.message });
  }
});

// ----------------------------------------------------------
// DELETE /api/agents/:id  –  Delete agent
// ----------------------------------------------------------
agentsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await agentModel.delete(req.params.id);
    res.json({ message: 'Agent deleted' });
  } catch (error: any) {
    console.error('Delete agent error:', error);
    res.status(500).json({ error: 'Failed to delete agent', details: error.message });
  }
});

// ----------------------------------------------------------
// POST /api/agents/:id/chat  –  Chat with a deployed agent (Playground / Public)
// Streaming SSE
// ----------------------------------------------------------
agentsRouter.post('/:id/chat', async (req: Request, res: Response) => {
  try {
    const agent = await agentModel.findById(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const { client } = copilotService.getClientInfo();

    // Build messages: agent's system prompt + conversation history
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: agent.config.systemPrompt },
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

    // Increment stats
    agent.totalConversations += 1;
    agent.totalMessages += messages.length + 1;
    await agentModel.update(agent.id, {
      totalConversations: agent.totalConversations,
      totalMessages: agent.totalMessages,
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Agent chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Agent chat failed', details: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
});
