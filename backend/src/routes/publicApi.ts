// ============================================================
// GiLo AI – Public API Routes (v1)
// API-key authenticated endpoints for deployed agents
// ============================================================

import { Router, Request, Response } from 'express';
import { agentModel } from '../models/agent';
import { webhookModel } from '../models/webhook';
import { knowledgeService } from '../services/knowledgeService';
import { conversationService } from '../services/conversationService';
import { copilotService, CopilotMessage } from '../services/copilotService';
import { ApiKeyRequest } from '../middleware/apiKeyAuth';
import { validate, chatSchema } from '../middleware/validation';
import OpenAI from 'openai';

export const publicApiRouter = Router();

// ----------------------------------------------------------
// GET /api/v1/agents/:id — Get public agent info
// ----------------------------------------------------------
publicApiRouter.get('/agents/:id', async (req: Request, res: Response) => {
  try {
    const apiReq = req as ApiKeyRequest;
    const agentId = req.params.id;

    // Verify the API key matches this agent
    if (apiReq.agentId !== agentId) {
      return res.status(403).json({ error: 'API key does not match this agent' });
    }

    const agent = await agentModel.findById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      model: agent.config.model,
      welcomeMessage: agent.config.welcomeMessage,
      status: agent.status,
    });
  } catch (error: any) {
    console.error('Public API get agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ----------------------------------------------------------
// POST /api/v1/agents/:id/chat — Chat with deployed agent
// Supports SSE streaming (default) and JSON mode (?stream=false)
// ----------------------------------------------------------
publicApiRouter.post('/agents/:id/chat', validate(chatSchema), async (req: Request, res: Response) => {
  try {
    const apiReq = req as ApiKeyRequest;
    const agentId = req.params.id;

    // Verify the API key matches this agent
    if (apiReq.agentId !== agentId) {
      return res.status(403).json({ error: 'API key does not match this agent' });
    }

    const agent = await agentModel.findById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const { messages, conversationId: incomingConvId } = req.body;

    const streamMode = req.query.stream !== 'false';
    const { client } = copilotService.getClientInfo();

    // Conversation persistence
    let conversationId = incomingConvId as string | undefined;
    if (conversationId) {
      const existing = await conversationService.findById(conversationId);
      if (!existing) conversationId = undefined;
    }
    if (!conversationId) {
      conversationId = await conversationService.create(agentId);
    }
    // Save user message
    const lastUserContent = messages[messages.length - 1]?.content || '';
    if (lastUserContent) {
      conversationService.addMessage(conversationId, 'user', lastUserContent).catch(() => {});
    }

    // Fire webhook: on_conversation_start (if first message)
    if (messages.length === 1) {
      webhookModel.fire(agentId, 'on_conversation_start', {
        messageCount: messages.length,
      }).catch(err => console.error('Webhook fire error:', err));
    }

    // Fire webhook: on_message
    webhookModel.fire(agentId, 'on_message', {
      role: 'user',
      content: messages[messages.length - 1]?.content?.substring(0, 200),
    }).catch(err => console.error('Webhook fire error:', err));

    // RAG: search knowledge base for relevant context
    let systemPrompt = agent.config.systemPrompt;
    const ragEnabled = agent.config.knowledgeBase && agent.config.knowledgeBase.length > 0;
    if (ragEnabled) {
      const lastUserMsg = [...messages].reverse().find((m: CopilotMessage) => m.role === 'user');
      if (lastUserMsg) {
        try {
          const results = await knowledgeService.search(agent.id, lastUserMsg.content, 5);
          if (results.length > 0) {
            const ragContext = knowledgeService.buildRagContext(results);
            systemPrompt += '\n\n' + ragContext;
          }
        } catch (ragErr) {
          console.warn('RAG search failed, continuing without context:', ragErr);
        }
      }
    }

    // Build messages
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(messages as CopilotMessage[]).map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
    ];

    if (streamMode) {
      // --- SSE Streaming ---
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

      let fullContent = '';
      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        const finishReason = chunk.choices?.[0]?.finish_reason;

        if (content) {
          fullContent += content;
          res.write(`data: ${JSON.stringify({ type: 'content', content })}\n\n`);
        }
        if (finishReason) {
          res.write(`data: ${JSON.stringify({ type: 'done', finishReason })}\n\n`);
        }
      }

      // Save assistant response
      if (fullContent) {
        conversationService.addMessage(conversationId!, 'assistant', fullContent).catch(() => {});
      }

      // Increment stats
      await agentModel.update(agent.id, {
        totalConversations: agent.totalConversations + 1,
        totalMessages: agent.totalMessages + messages.length + 1,
      });

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // --- JSON mode ---
      const completion = await client.chat.completions.create({
        model: agent.config.model,
        messages: openaiMessages,
        temperature: agent.config.temperature,
        max_tokens: agent.config.maxTokens,
      });

      const assistantMessage = completion.choices?.[0]?.message?.content || '';

      // Save assistant response
      if (assistantMessage) {
        conversationService.addMessage(conversationId!, 'assistant', assistantMessage).catch(() => {});
      }

      // Increment stats
      await agentModel.update(agent.id, {
        totalConversations: agent.totalConversations + 1,
        totalMessages: agent.totalMessages + messages.length + 1,
      });

      res.json({
        message: {
          role: 'assistant',
          content: assistantMessage,
        },
        usage: completion.usage,
      });
    }
  } catch (error: any) {
    console.error('Public API chat error:', error);

    // Fire webhook: on_error
    webhookModel.fire(req.params.id, 'on_error', {
      error: error.message,
    }).catch(() => {});

    if (!res.headersSent) {
      res.status(500).json({ error: 'Chat failed', details: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
});
