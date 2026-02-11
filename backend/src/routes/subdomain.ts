// ============================================================
// GiLo AI – Subdomain Agent Routes
// Handles requests routed via {slug}.gilo.dev
// ============================================================

import { Router, Request, Response } from 'express';
import { Agent } from '../models/agent';
import { copilotService, CopilotMessage } from '../services/copilotService';
import { knowledgeService } from '../services/knowledgeService';
import { webhookModel } from '../models/webhook';
import { publicRateLimiter } from '../middleware/publicRateLimiter';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs';

export const subdomainRouter = Router();

// Load chat template once at startup
const chatTemplatePath = path.join(__dirname, '..', '..', 'public', 'chat.html');
let chatTemplate = '';
try {
  chatTemplate = fs.readFileSync(chatTemplatePath, 'utf-8');
} catch {
  console.warn('⚠️ Chat template not found at', chatTemplatePath);
}

/**
 * Helper: extract agent from subdomain middleware
 */
function getSubdomainAgent(req: Request): Agent | undefined {
  return (req as any).agentBySubdomain;
}

// ----------------------------------------------------------
// GET / — Agent chat interface (HTML)
// ----------------------------------------------------------
subdomainRouter.get('/', (req: Request, res: Response) => {
  const agent = getSubdomainAgent(req);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  // If client wants JSON (API call), return JSON
  if (req.headers.accept?.includes('application/json') && !req.headers.accept?.includes('text/html')) {
    return res.json({
      name: agent.name,
      description: agent.description,
      slug: agent.slug,
      model: agent.config.model,
      welcomeMessage: agent.config.welcomeMessage,
      status: agent.status,
      endpoint: `https://${agent.slug}.${process.env.GILO_DOMAIN}/chat`,
    });
  }

  // Serve HTML chat interface
  const lang = agent.config.language || 'fr';
  const agentJson = JSON.stringify({
    name: agent.name,
    description: agent.description || '',
    slug: agent.slug,
    language: lang,
    model: agent.config.model || '',
    welcomeMessage: agent.config.welcomeMessage || (lang === 'en' ? 'Hello! How can I help you?' : 'Bonjour ! Comment puis-je vous aider ?'),
  });

  const html = chatTemplate
    .replace(/\{\{AGENT_NAME\}\}/g, agent.name)
    .replace(/\{\{AGENT_DESCRIPTION\}\}/g, agent.description || '')
    .replace(/\{\{AGENT_LANG\}\}/g, lang)
    .replace('{{AGENT_JSON}}', agentJson);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ----------------------------------------------------------
// POST /chat — Chat with the agent (public, rate-limited)
// Supports SSE streaming and JSON mode
// ----------------------------------------------------------
subdomainRouter.post('/chat', publicRateLimiter, async (req: Request, res: Response) => {
  const agent = getSubdomainAgent(req);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  try {
    const { messages, stream: streamParam } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const streamMode = streamParam !== false;
    const { client } = copilotService.getClientInfo();

    // Fire webhook on first message
    if (messages.length === 1) {
      webhookModel.fire(agent.id, 'on_conversation_start', {
        source: 'subdomain',
        slug: agent.slug,
        messageCount: messages.length,
      }).catch(err => console.error('Webhook fire error:', err));
    }

    // Fire webhook: on_message
    webhookModel.fire(agent.id, 'on_message', {
      role: 'user',
      source: 'subdomain',
      content: messages[messages.length - 1]?.content?.substring(0, 200),
    }).catch(err => console.error('Webhook fire error:', err));

    // RAG: search knowledge base
    let systemPrompt = agent.config.systemPrompt;
    const ragEnabled = agent.config.knowledgeBase && agent.config.knowledgeBase.length > 0;
    if (ragEnabled) {
      const lastUserMsg = [...messages].reverse().find((m: CopilotMessage) => m.role === 'user');
      if (lastUserMsg) {
        try {
          const results = await knowledgeService.search(agent.id, lastUserMsg.content, 5);
          if (results.length > 0) {
            systemPrompt += '\n\n' + knowledgeService.buildRagContext(results);
          }
        } catch (ragErr) {
          console.warn('RAG search failed:', ragErr);
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

    if (streamMode) {
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

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const completion = await client.chat.completions.create({
        model: agent.config.model,
        messages: openaiMessages,
        temperature: agent.config.temperature,
        max_tokens: agent.config.maxTokens,
      });

      res.json({
        message: {
          role: 'assistant',
          content: completion.choices?.[0]?.message?.content || '',
        },
        usage: completion.usage,
      });
    }
  } catch (error: any) {
    console.error('Subdomain chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Chat failed', details: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
});
