// ============================================================
// GiLo AI – Subdomain Agent Routes
// Handles requests routed via {slug}.gilo.dev
// ============================================================

import { Router, Request, Response } from 'express';
import { Agent, enforceModelForTier, isByoLlm } from '../models/agent';
import { checkMessageQuota } from '../middleware/messageQuota';
import { copilotService, CopilotMessage } from '../services/copilotService';
import { knowledgeService } from '../services/knowledgeService';
import { webhookModel } from '../models/webhook';
import { userModel } from '../models/user';
import { publicRateLimiter } from '../middleware/publicRateLimiter';
import { getDb } from '../db';
import { storeAgents } from '../db/schema';
import { eq } from 'drizzle-orm';
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
subdomainRouter.get('/', async (req: Request, res: Response) => {
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
      endpoint: `https://${agent.slug}.${process.env.GILO_DOMAIN}`,
    });
  }

  // Fetch icon from store_agents if published
  let icon = '';
  let iconColor = '#3b82f6';
  try {
    const db = getDb();
    const rows = await db.select({ icon: storeAgents.icon, iconColor: storeAgents.iconColor })
      .from(storeAgents)
      .where(eq(storeAgents.agentId, agent.id))
      .limit(1);
    if (rows.length > 0) {
      icon = rows[0].icon || '';
      iconColor = rows[0].iconColor || '#3b82f6';
    }
  } catch (e) {
    // Ignore — will fallback to letter avatar
  }

  // Serve HTML chat interface
  const lang = agent.config.language || 'fr';
  const agentJson = JSON.stringify({
    name: agent.name,
    description: agent.description || '',
    slug: agent.slug,
    language: lang,
    model: agent.config.model || '',
    icon,
    iconColor,
    appearance: agent.config.appearance || {},
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
// GET /manifest.json — Dynamic PWA manifest per agent
// ----------------------------------------------------------
subdomainRouter.get('/manifest.json', async (req: Request, res: Response) => {
  const agent = getSubdomainAgent(req);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const giloDomain = process.env.GILO_DOMAIN || 'gilo.dev';
  const startUrl = `https://${agent.slug}.${giloDomain}/`;

  // Fetch accent color from store
  let themeColor = '#0f172a';
  let bgColor = '#0f172a';
  try {
    const db = getDb();
    const rows = await db.select({ iconColor: storeAgents.iconColor })
      .from(storeAgents)
      .where(eq(storeAgents.agentId, agent.id))
      .limit(1);
    if (rows.length > 0 && rows[0].iconColor) {
      themeColor = rows[0].iconColor;
    }
  } catch (e) { /* ignore */ }

  if (agent.config.appearance?.accentColor) {
    themeColor = agent.config.appearance.accentColor;
  }

  const manifest = {
    name: agent.name,
    short_name: agent.name.substring(0, 12),
    description: agent.description || `Chat with ${agent.name}`,
    start_url: startUrl,
    scope: startUrl,
    display: 'standalone',
    orientation: 'portrait',
    theme_color: themeColor,
    background_color: bgColor,
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };

  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json(manifest);
});

// ----------------------------------------------------------
// GET /icon.png — Serve agent icon as PNG for PWA
// ----------------------------------------------------------
subdomainRouter.get('/icon.png', async (req: Request, res: Response) => {
  const agent = getSubdomainAgent(req);
  if (!agent) return res.status(404).send('Not found');

  // Fetch icon from store
  let iconData = '';
  let iconColor = '#3b82f6';
  try {
    const db = getDb();
    const rows = await db.select({ icon: storeAgents.icon, iconColor: storeAgents.iconColor })
      .from(storeAgents)
      .where(eq(storeAgents.agentId, agent.id))
      .limit(1);
    if (rows.length > 0) {
      iconData = rows[0].icon || '';
      iconColor = rows[0].iconColor || '#3b82f6';
    }
  } catch (e) { /* ignore */ }

  // If we have a base64 icon, serve it as image
  if (iconData && iconData.startsWith('data:image/')) {
    const matches = iconData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (matches) {
      const mimeType = matches[1] === 'svg+xml' ? 'image/svg+xml' : `image/${matches[1]}`;
      const buffer = Buffer.from(matches[2], 'base64');
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    }
  }

  // Fallback: generate an SVG with the agent's initial letter and color
  const initial = (agent.name || 'A').charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="108" fill="${iconColor}"/>
    <text x="256" y="340" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-weight="700" font-size="280" fill="white">${initial}</text>
  </svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svg);
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
    const byoLlm = isByoLlm(agent.config);
    const { client, model: resolvedModel } = copilotService.getClientForAgent(agent.config);

    // Look up the agent owner's current tier (not the stale tier stored on the agent row)
    let ownerTier = agent.tier || 'free';
    try {
      const owner = await userModel.findById(agent.userId);
      if (owner) ownerTier = owner.tier;
    } catch { /* fallback to agent.tier */ }

    // Daily message quota check
    const quota = await checkMessageQuota(agent.id, ownerTier, byoLlm);
    if (!quota.allowed) {
      return res.status(429).json({
        error: 'Daily message limit reached',
        message: `This agent has reached its daily limit of ${quota.limit} messages. Please try again tomorrow.`,
        limit: quota.limit,
        remaining: 0,
        resetAt: quota.resetAt,
      });
    }

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
        model: byoLlm ? resolvedModel : enforceModelForTier(agent.config.model, ownerTier),
        messages: openaiMessages,
        temperature: agent.config.temperature,
        max_tokens: Math.min(agent.config.maxTokens, 1024),
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
        model: byoLlm ? resolvedModel : enforceModelForTier(agent.config.model, ownerTier),
        messages: openaiMessages,
        temperature: agent.config.temperature,
        max_tokens: Math.min(agent.config.maxTokens, 1024),
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
