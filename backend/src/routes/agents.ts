import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { agentModel, AgentCreateDTO, enforceModelForTier, enforceMaxTokensForTier, isByoLlm } from '../models/agent';
import { checkMessageQuota } from '../middleware/messageQuota';
import { storeModel } from '../models/storeAgent';
import { copilotService, CopilotMessage } from '../services/copilotService';
import { knowledgeService } from '../services/knowledgeService';
import { conversationService } from '../services/conversationService';
import {
  toOpenAITools,
  executeToolCalls,
  AgentToolDefinition,
} from '../services/toolExecutor';
import { logChat, logToolCall, logError, recordConversation } from '../services/analyticsService';
import { AuthenticatedRequest } from '../middleware/auth';
import { validate, createAgentSchema, updateAgentSchema, updateAgentConfigSchema, chatSchema } from '../middleware/validation';
import OpenAI from 'openai';

export const agentsRouter = Router();

// Load agent templates
let agentTemplates: any[] = [];
try {
  const raw = readFileSync(join(process.cwd(), 'data', 'agent-templates.json'), 'utf-8');
  agentTemplates = JSON.parse(raw);
} catch { /* templates file not found — ok */ }

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
// GET /api/agents/templates  –  List agent templates
// ----------------------------------------------------------
agentsRouter.get('/templates', (_req: Request, res: Response) => {
  res.json({ templates: agentTemplates });
});

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
// POST /api/agents/quick-create  –  AI-powered agent creation
// User describes the agent in natural language → GPT generates config → agent created
// ----------------------------------------------------------
agentsRouter.post('/quick-create', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { description, language } = req.body as { description: string; language?: 'fr' | 'en' };
    if (!description?.trim() || description.trim().length < 10) {
      return res.status(400).json({ error: 'Description must be at least 10 characters' });
    }

    const userTier = (req as AuthenticatedRequest).user?.tier || 'free';
    const paidAgentSlots = (req as AuthenticatedRequest).user?.paidAgentSlots || 0;
    const byoAgentSlots = (req as AuthenticatedRequest).user?.byoAgentSlots || 0;
    const lang = language || 'fr';

    // Available built-in tools the AI can choose from
    const availableTools = [
      { id: 'builtin_get_current_time', name: 'get_current_time', desc: 'Get current date/time' },
      { id: 'builtin_calculator', name: 'calculator', desc: 'Math calculations' },
      { id: 'builtin_http_get', name: 'http_get', desc: 'Fetch data from URLs' },
      { id: 'builtin_http_post', name: 'http_post', desc: 'Send data to APIs' },
      { id: 'builtin_json_extract', name: 'json_extract', desc: 'Parse/extract JSON data' },
      { id: 'builtin_string_utils', name: 'string_utils', desc: 'Text manipulation' },
      { id: 'builtin_send_email', name: 'send_email', desc: 'Send emails' },
      { id: 'builtin_webhook_trigger', name: 'webhook_trigger', desc: 'Trigger webhooks' },
    ];

    const systemPrompt = `You are an AI agent configuration generator for GiLo AI platform.
Given a user's description of the agent they want, generate a complete agent configuration.

Available built-in tools: ${JSON.stringify(availableTools)}

Respond ONLY with a valid JSON object (no markdown, no explanation) with this exact schema:
{
  "name": "short agent name (2-5 words)",
  "description": "one sentence description",
  "config": {
    "model": "openai/gpt-4.1",
    "temperature": 0.3 to 0.9 (lower for factual, higher for creative),
    "maxTokens": 2048 or 4096,
    "systemPrompt": "comprehensive system prompt for the agent, detailed instructions",
    "welcomeMessage": "a friendly welcome message the agent will show first",
    "language": "${lang}",
    "tools": [
      { "id": "builtin_xxx", "name": "xxx", "type": "builtin", "enabled": true, "config": { "builtinId": "xxx" } }
    ]
  }
}

Rules:
- The systemPrompt should be thorough (100-300 words), with numbered instructions
- Only include tools that are relevant to the agent's purpose
- If no tools are needed, return an empty tools array
- The welcomeMessage should match the agent's personality
- Write in ${lang === 'fr' ? 'French' : 'English'}`;

    const { client, defaultModel } = copilotService.getClientInfo();

    const completion = await client.chat.completions.create({
      model: defaultModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: description.trim() },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '';
    
    // Parse JSON from response (strip markdown fences if present)
    let parsed: any;
    try {
      const jsonStr = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error('[QuickCreate] Failed to parse AI response:', raw.substring(0, 500));
      return res.status(500).json({ error: 'AI generated invalid configuration. Please try again.' });
    }

    // Validate & sanitize
    const name = (parsed.name || 'My Agent').substring(0, 100);
    const agentDesc = (parsed.description || description.trim()).substring(0, 500);
    const config = {
      model: parsed.config?.model || 'openai/gpt-4.1-nano',
      temperature: Math.min(1, Math.max(0, parsed.config?.temperature ?? 0.7)),
      maxTokens: Math.min(4096, Math.max(256, parsed.config?.maxTokens ?? 2048)),
      systemPrompt: (parsed.config?.systemPrompt || '').substring(0, 10000),
      welcomeMessage: (parsed.config?.welcomeMessage || '').substring(0, 500),
      language: lang,
      tools: Array.isArray(parsed.config?.tools) ? parsed.config.tools.slice(0, 10) : [],
    };

    // Create the agent
    const agent = await agentModel.create(userId, { name, description: agentDesc, config }, userTier, paidAgentSlots, byoAgentSlots);
    console.log('[QuickCreate] Agent created:', agent.id, name);

    res.status(201).json(agentModel.toResponse(agent));
  } catch (error: any) {
    console.error('Quick-create error:', error.message);
    const message = error?.message || 'Failed to create agent';
    if (typeof message === 'string' && message.toLowerCase().includes('agent limit reached')) {
      return res.status(403).json({ error: message });
    }
    res.status(500).json({ error: 'Failed to quick-create agent' });
  }
});

// ----------------------------------------------------------
// POST /api/agents  –  Create a new agent
// ----------------------------------------------------------
agentsRouter.post('/', validate(createAgentSchema), async (req: Request, res: Response) => {
  console.log('[Agents] Create request received:', { body: req.body, userId: (req as AuthenticatedRequest).userId });
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const userTier = (req as AuthenticatedRequest).user?.tier || 'free';
    const paidAgentSlots = (req as AuthenticatedRequest).user?.paidAgentSlots || 0;
    const byoAgentSlots = (req as AuthenticatedRequest).user?.byoAgentSlots || 0;
    const { name, description, config } = req.body as AgentCreateDTO & { config?: any };

    console.log('[Agents] Processing creation:', { name, userTier, paidAgentSlots, byoAgentSlots });

    const agent = await agentModel.create(userId, { name, description, config }, userTier, paidAgentSlots, byoAgentSlots);
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
agentsRouter.patch('/:id', validate(updateAgentSchema), async (req: Request, res: Response) => {
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
agentsRouter.patch('/:id/config', validate(updateAgentConfigSchema), async (req: Request, res: Response) => {
  try {
    const userId = await verifyOwnership(req, res);
    if (!userId) return;

    const config = req.body;
    // Enforce tier-based model restriction
    const user = (req as AuthenticatedRequest).user;
    // For BYO tier, check if agent actually has a custom API key configured
    const existingAgent = await agentModel.findById(req.params.id);
    const agentConfig = existingAgent ? { ...existingAgent.config, ...config } : config;
    const byoActive = isByoLlm(agentConfig);
    if (config.model && !byoActive) {
      config.model = enforceModelForTier(config.model, user?.tier || 'free');
    }
    // hideBranding is BYO-only feature
    if (config.hideBranding && (!user || user.tier !== 'byo')) {
      config.hideBranding = false;
    }
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
    const giloDomain = process.env.GILO_DOMAIN || '';
    const subdomainUrl = agent.slug && giloDomain ? `https://${agent.slug}.${giloDomain}` : undefined;
    res.json({
      message: 'Agent deployed successfully',
      agent: agentModel.toResponse(agent),
      endpoint: agent.endpoint,
      subdomainUrl,
      chatUrl: subdomainUrl ? `${subdomainUrl}/chat` : `${agent.endpoint}/chat`,
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
agentsRouter.post('/:id/chat', validate(chatSchema), async (req: Request, res: Response) => {
  try {
    const userId = await verifyOwnership(req, res);
    if (!userId) return;

    const agent = (await agentModel.findById(req.params.id))!;
    const { messages, conversationId: incomingConvId } = req.body;

    // Daily message quota check
    const chatStartTime = Date.now();
    const byoLlm = isByoLlm(agent.config);
    const userTierForQuota = (req as AuthenticatedRequest).user?.tier || 'free';
    const quota = await checkMessageQuota(agent.id, userTierForQuota, byoLlm);
    if (!quota.allowed) {
      return res.status(429).json({
        error: 'Daily message limit reached',
        message: `This agent has reached its daily limit of ${quota.limit} messages. Resets at midnight UTC.`,
        limit: quota.limit,
        remaining: 0,
        resetAt: quota.resetAt,
      });
    }

    // BYO LLM or platform model
    const { client, model: resolvedModel } = copilotService.getClientForAgent(agent.config);
    if (!byoLlm) {
      const userTier = (req as AuthenticatedRequest).user?.tier || 'free';
      agent.config.model = enforceModelForTier(agent.config.model, userTier);
      agent.config.maxTokens = enforceMaxTokensForTier(agent.config.maxTokens, userTier, false);
    } else {
      agent.config.model = resolvedModel;
    }

    // Conversation persistence: get or create
    let conversationId = incomingConvId as string | undefined;
    if (conversationId) {
      const existing = await conversationService.findById(conversationId);
      if (!existing) conversationId = undefined;
    }
    if (!conversationId) {
      conversationId = await conversationService.create(agent.id, userId);
    }
    // Save user message
    const lastUserMsg = [...messages].reverse().find((m: CopilotMessage) => m.role === 'user');
    if (lastUserMsg) {
      await conversationService.addMessage(conversationId, 'user', lastUserMsg.content);
    }

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

    // Build OpenAI messages
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(messages as CopilotMessage[]).map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // Prepare OpenAI tools from agent config
    const agentTools = (agent.config.tools || []) as AgentToolDefinition[];
    const enabledTools = agentTools.filter((t) => t.enabled);
    const openaiTools = enabledTools.length > 0 ? toOpenAITools(agentTools) : undefined;

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Send conversation ID so the frontend can track the conversation
    res.write(`data: ${JSON.stringify({ type: 'conversation', conversationId })}\n\n`);

    // Send RAG citations first so the frontend can display sources
    if (ragCitations.length > 0) {
      res.write(`data: ${JSON.stringify({ type: 'citations', citations: ragCitations })}\n\n`);
    }

    // ================================================================
    // Function calling loop
    // The LLM may request tool calls instead of generating text.
    // We execute them, feed results back, and repeat until the LLM
    // produces a final text response (max 10 iterations as safety).
    // ================================================================
    const MAX_TOOL_ROUNDS = 10;
    let round = 0;

    while (round < MAX_TOOL_ROUNDS) {
      round++;

      // Non-streaming call first to detect tool_calls
      // (streaming + tool_calls is complex — we do non-streaming for tool rounds,
      //  then stream the final text response)
      if (enabledTools.length > 0) {
        const response = await client.chat.completions.create({
          model: agent.config.model,
          messages: openaiMessages,
          temperature: agent.config.temperature,
          max_tokens: agent.config.maxTokens,
          tools: openaiTools,
          stream: false,
        });

        const choice = response.choices[0];

        if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
          // Filter for function tool calls only
          const fnToolCalls = choice.message.tool_calls.filter(
            (tc): tc is import('openai/resources/chat/completions').ChatCompletionMessageFunctionToolCall =>
              tc.type === 'function'
          );

          if (fnToolCalls.length > 0) {
            // Notify frontend about tool execution
            res.write(`data: ${JSON.stringify({
              type: 'tool_calls',
              tools: fnToolCalls.map((tc) => ({
                id: tc.id,
                name: tc.function.name,
                arguments: tc.function.arguments,
              })),
            })}\n\n`);

            // Execute all tool calls in parallel
            const results = await executeToolCalls(fnToolCalls, agentTools);

            // Add assistant message with tool_calls
            openaiMessages.push({
              role: 'assistant',
              content: choice.message.content || null,
              tool_calls: choice.message.tool_calls,
            } as OpenAI.ChatCompletionMessageParam);

            // Add tool results
            for (const tc of fnToolCalls) {
              const result = results.get(tc.id);
              const toolContent = result?.success
                ? result.result
                : `Error: ${result?.error || 'Unknown error'}`;

              openaiMessages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: toolContent,
              } as OpenAI.ChatCompletionMessageParam);

              // Notify frontend about tool result
              res.write(`data: ${JSON.stringify({
                type: 'tool_result',
                toolCallId: tc.id,
                name: tc.function.name,
                success: result?.success ?? false,
                result: toolContent,
                durationMs: result?.durationMs,
              })}\n\n`);

              // Log the tool call for analytics
              logToolCall({
                agentId: agent.id,
                toolName: tc.function.name,
                toolArgs: JSON.parse(tc.function.arguments || '{}'),
                toolResult: toolContent.slice(0, 500),
                success: result?.success ?? false,
              }).catch(() => {});
            }

            // Continue the loop — LLM will process tool results
            continue;
          }
        }

        // No tool calls — LLM produced text. Stream the final response for better UX.
        if (choice.message.content) {
          // We already have the full response, send it as a single chunk
          res.write(`data: ${JSON.stringify({ type: 'content', content: choice.message.content })}\n\n`);
          res.write(`data: ${JSON.stringify({ type: 'done', finishReason: choice.finish_reason })}\n\n`);
          break;
        }

        // Edge case: empty content
        res.write(`data: ${JSON.stringify({ type: 'done', finishReason: choice.finish_reason })}\n\n`);
        break;
      }

      // No tools configured — use streaming for best UX
      const stream = await client.chat.completions.create({
        model: agent.config.model,
        messages: openaiMessages,
        temperature: agent.config.temperature,
        max_tokens: agent.config.maxTokens,
        stream: true,
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
      break; // streaming mode always finishes in one pass
    }

    if (round >= MAX_TOOL_ROUNDS) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Tool call loop limit reached' })}\n\n`);
    }

    // Save assistant response to conversation
    // Collect final assistant text from the messages we pushed during the loop
    const finalAssistantContent = (openaiMessages
      .filter(m => m.role === 'assistant')
      .pop() as any)?.content || '(streamed)';
    conversationService.addMessage(conversationId!, 'assistant', typeof finalAssistantContent === 'string' ? finalAssistantContent : '(streamed)').catch(() => {});

    // Track analytics (fire-and-forget)
    const chatEndTime = Date.now();
    const chatDuration = chatEndTime - chatStartTime;
    const lastUserMessage = [...messages].reverse().find((m: CopilotMessage) => m.role === 'user')?.content || '';
    recordConversation(agent.id).catch(() => {});
    logChat({
      agentId: agent.id,
      userMessage: lastUserMessage,
      assistantResponse: '(streamed)',
      tokensPrompt: 0, // Not available in streaming mode
      tokensCompletion: 0,
      responseMs: chatDuration,
      model: agent.config.model,
      ragChunks: ragCitations.length,
      toolCalls: round - 1,
      userId,
    }).catch(() => {});

    await agentModel.update(agent.id, {
      totalConversations: agent.totalConversations + 1,
      totalMessages: agent.totalMessages + messages.length + 1,
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Agent chat error:', error.message);
    // Log error for analytics
    if (req.params.id) {
      logError({
        agentId: req.params.id,
        message: error.message || 'Agent chat failed',
        errorStack: error.stack,
      }).catch(() => {});
    }
    if (!res.headersSent) {
      res.status(500).json({ error: 'Agent chat failed' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Internal error' })}\n\n`);
      res.end();
    }
  }
});

// ----------------------------------------------------------
// GET /api/agents/:id/conversations  –  List conversations
// ----------------------------------------------------------
agentsRouter.get('/:id/conversations', async (req: Request, res: Response) => {
  try {
    const userId = await verifyOwnership(req, res);
    if (!userId) return;

    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    // Tier-based chat history retention: free = 7 days, paid = 90 days
    const userTier = (req as AuthenticatedRequest).user?.tier || 'free';
    const retentionDays = userTier === 'free' ? 7 : 90;
    const since = new Date(Date.now() - retentionDays * 86_400_000);

    const convs = await conversationService.listByAgent(req.params.id, limit, offset, since);
    res.json({ conversations: convs, total: convs.length, retentionDays });
  } catch (error: any) {
    console.error('List conversations error:', error.message);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// ----------------------------------------------------------
// GET /api/agents/:id/conversations/:convId/messages
// ----------------------------------------------------------
agentsRouter.get('/:id/conversations/:convId/messages', async (req: Request, res: Response) => {
  try {
    const userId = await verifyOwnership(req, res);
    if (!userId) return;

    const conv = await conversationService.findById(req.params.convId);
    if (!conv || conv.agentId !== req.params.id) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    const msgs = await conversationService.getMessages(req.params.convId);
    res.json({ messages: msgs });
  } catch (error: any) {
    console.error('Get messages error:', error.message);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// ----------------------------------------------------------
// DELETE /api/agents/:id/conversations/:convId
// ----------------------------------------------------------
agentsRouter.delete('/:id/conversations/:convId', async (req: Request, res: Response) => {
  try {
    const userId = await verifyOwnership(req, res);
    if (!userId) return;

    const conv = await conversationService.findById(req.params.convId);
    if (!conv || conv.agentId !== req.params.id) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    await conversationService.deleteConversation(req.params.convId);
    res.json({ message: 'Conversation deleted' });
  } catch (error: any) {
    console.error('Delete conversation error:', error.message);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});
