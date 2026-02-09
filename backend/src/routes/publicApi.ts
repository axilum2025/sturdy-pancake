// ============================================================
// GiLo AI – Public API v1 Routes
// Public endpoints authenticated by API keys (not JWT)
// ============================================================

import { Router, Request, Response } from 'express';
import { agentModel } from '../models/agent';
import { webhookModel } from '../models/webhook';
import { copilotService, CopilotMessage } from '../services/copilotService';
import { ApiKeyRequest } from '../middleware/apiKeyAuth';
import OpenAI from 'openai';

export const publicApiRouter = Router();

// ----------------------------------------------------------
// POST /api/v1/agents/:id/chat — Chat with a deployed agent
// Authenticated via API key (not JWT)
// Supports both SSE streaming and JSON response
// ----------------------------------------------------------
publicApiRouter.post('/agents/:id/chat', async (req: Request, res: Response) => {
  try {
    const apiReq = req as ApiKeyRequest;
    const agentId = req.params.id;

    // Verify this key is for this specific agent
    if (apiReq.agentId !== agentId) {
      return res.status(403).json({ error: 'API key is not authorized for this agent' });
    }

    const agent = await agentModel.findById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const { messages, stream: wantStream } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'messages array is required',
        example: { messages: [{ role: 'user', content: 'Hello' }] },
      });
    }

    const { client } = copilotService.getClientInfo();

    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: agent.config.systemPrompt },
      ...(messages as CopilotMessage[]).map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // Fire webhook: on_conversation_start
    webhookModel.fire(agentId, 'on_conversation_start', {
      messagesCount: messages.length,
      firstMessage: messages[0]?.content?.substring(0, 200),
    }).catch(err => console.error('Webhook fire error:', err));

    // --- Streaming mode (default) ---
    if (wantStream !== false) {
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

      // Fire webhook: on_message
      webhookModel.fire(agentId, 'on_message', {
        role: 'assistant',
        contentPreview: fullContent.substring(0, 500),
        contentLength: fullContent.length,
      }).catch(err => console.error('Webhook fire error:', err));

      // Update agent stats
      await agentModel.update(agent.id, {
        totalConversations: agent.totalConversations + 1,
        totalMessages: agent.totalMessages + messages.length + 1,
      });

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // --- Non-streaming (JSON) mode ---
      const completion = await client.chat.completions.create({
        model: agent.config.model,
        messages: openaiMessages,
        temperature: agent.config.temperature,
        max_tokens: agent.config.maxTokens,
        stream: false,
      });

      const content = completion.choices[0]?.message?.content || '';

      // Fire webhook: on_message
      webhookModel.fire(agentId, 'on_message', {
        role: 'assistant',
        contentPreview: content.substring(0, 500),
        contentLength: content.length,
      }).catch(err => console.error('Webhook fire error:', err));

      // Update agent stats
      await agentModel.update(agent.id, {
        totalConversations: agent.totalConversations + 1,
        totalMessages: agent.totalMessages + messages.length + 1,
      });

      res.json({
        id: completion.id,
        model: completion.model,
        message: {
          role: 'assistant',
          content,
        },
        usage: completion.usage,
        finishReason: completion.choices[0]?.finish_reason,
      });
    }
  } catch (error: any) {
    console.error('Public API chat error:', error);

    // Fire webhook: on_error
    const apiReq = req as ApiKeyRequest;
    webhookModel.fire(apiReq.agentId, 'on_error', {
      error: error.message,
    }).catch(err => console.error('Webhook fire error:', err));

    if (!res.headersSent) {
      res.status(500).json({ error: 'Chat request failed', details: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
});

// ----------------------------------------------------------
// GET /api/v1/agents/:id — Get public agent info
// ----------------------------------------------------------
publicApiRouter.get('/agents/:id', async (req: Request, res: Response) => {
  try {
    const apiReq = req as ApiKeyRequest;
    const agentId = req.params.id;

    if (apiReq.agentId !== agentId) {
      return res.status(403).json({ error: 'API key is not authorized for this agent' });
    }

    const agent = await agentModel.findById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      status: agent.status,
      model: agent.config.model,
      welcomeMessage: agent.config.welcomeMessage,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get agent info' });
  }
});
