import { Router, Request, Response } from 'express';
import { copilotService, CopilotMessage } from '../services/copilotService';
import { conversationService } from '../services/conversationService';
import { agentModel } from '../models/agent';
import { AuthenticatedRequest } from '../middleware/auth';
import { validate, chatSchema, copilotStreamSchema } from '../middleware/validation';
import { enforceModelForTier } from '../models/agent';
import { knowledgeService } from '../services/knowledgeService';
import { credentialService } from '../services/credentialService';
import OpenAI from 'openai';

export const copilotRouter = Router();

// ----------------------------------------------------------
// POST /api/copilot/chat  –  Non-streaming chat
// ----------------------------------------------------------
copilotRouter.post('/chat', validate(chatSchema), async (req: Request, res: Response) => {
  try {
    const { messages, model, temperature, maxTokens, projectContext } = req.body;

    const response = await copilotService.chat({
      messages: messages as CopilotMessage[],
      model,
      temperature,
      maxTokens,
      projectContext,
    });

    res.json(response);
  } catch (error: any) {
    console.error('Copilot chat error:', error);
    res.status(500).json({
      error: 'Copilot chat failed',
      details: error.message,
    });
  }
});

// ----------------------------------------------------------
// POST /api/copilot/stream  –  SSE streaming chat
// ----------------------------------------------------------
copilotRouter.post('/stream', async (req: Request, res: Response) => {
  try {
    const { messages, model, temperature, maxTokens, projectContext, conversationId: incomingConvId, uiLanguage } = req.body;

    const userId = (req as AuthenticatedRequest).userId;
    const agentId = projectContext?.projectId;

    // Helper: emit an SSE step event so the frontend can show granular progress
    const emitStep = (step: string, status: 'running' | 'done' | 'error' = 'running', detail?: string) => {
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: 'step', step, status, detail })}\n\n`);
      }
    };

    // --- Step: detect language ---
    // (happens inside getClientInfo, but we signal it before)

    // --- Step: load agent config ---
    let agentConfig: import('../models/agent').AgentConfig | undefined;
    let agentMeta: { name?: string; status?: string; totalConversations?: number; totalMessages?: number; deployedAt?: Date } = {};
    if (agentId && agentId !== 'new-project') {
      try {
        const agent = await agentModel.findById(agentId);
        if (agent) {
          agentConfig = agent.config;
          agentMeta = {
            name: agent.name,
            status: agent.status,
            totalConversations: agent.totalConversations,
            totalMessages: agent.totalMessages,
            deployedAt: agent.deployedAt,
          };
        }
      } catch { /* ignore — config enrichment is optional */ }
    }

    // --- Step: enrich context with knowledge, credentials, MCP ---
    let enrichedContext: {
      knowledgeStats?: { documents: number; chunks: number; totalTokens: number };
      credentialsCount?: number;
      mcpServers?: string[];
      agentMeta?: typeof agentMeta;
      configScore?: number;
    } = {};

    if (agentId && agentId !== 'new-project') {
      try {
        // Knowledge base stats
        const kbStats = await knowledgeService.getStats(agentId).catch(() => null);
        if (kbStats) enrichedContext.knowledgeStats = kbStats;

        // Credentials count
        if (userId) {
          const creds = await credentialService.listCredentials(agentId).catch(() => []);
          enrichedContext.credentialsCount = creds.length;
        }

        enrichedContext.agentMeta = agentMeta;

        // Calculate config completeness score
        if (agentConfig) {
          let score = 0;
          const defaultPrompt = 'Tu es un assistant IA utile et concis';
          if (agentConfig.systemPrompt && !agentConfig.systemPrompt.startsWith(defaultPrompt)) score += 20;
          if (agentConfig.welcomeMessage && agentConfig.welcomeMessage !== 'Bonjour ! Comment puis-je vous aider ?') score += 10;
          if (agentConfig.tools && agentConfig.tools.filter(t => t.enabled).length > 0) score += 20;
          if (enrichedContext.knowledgeStats && enrichedContext.knowledgeStats.documents > 0) score += 20;
          if (agentConfig.model && agentConfig.model !== 'openai/gpt-4.1-nano') score += 10;
          if (agentConfig.appearance?.accentColor || agentConfig.appearance?.theme) score += 10;
          if (agentMeta.status === 'deployed') score += 10;
          enrichedContext.configScore = score;
        }
      } catch { /* enrichment is best-effort */ }
    }

    // --- Step: build system prompt (includes language detection) ---
    const { client, systemPrompt, defaultModel } = copilotService.getClientInfo(projectContext, agentConfig, uiLanguage, messages as CopilotMessage[], enrichedContext);

    // Conversation persistence (when tied to an agent)
    let conversationId: string | undefined;
    if (agentId && agentId !== 'new-project') {
      conversationId = incomingConvId as string | undefined;
      if (conversationId) {
        const existing = await conversationService.findById(conversationId);
        if (!existing) conversationId = undefined;
      }
      if (!conversationId) {
        conversationId = await conversationService.create(agentId, userId);
      }
      // Save user message
      const lastUserMsg = [...messages].reverse().find((m: CopilotMessage) => m.role === 'user');
      if (lastUserMsg) {
        conversationService.addMessage(conversationId, 'user', lastUserMsg.content).catch(() => {});
      }
    }

    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(messages as CopilotMessage[]).map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const resolvedModel = enforceModelForTier(model || defaultModel, (req as AuthenticatedRequest).user?.tier || 'free');

    // --- Analyze user intent for thinking display ---
    const lastUserMsg = messages?.[messages.length - 1]?.content?.toLowerCase() || '';
    let thinkingDetail = '';
    if (lastUserMsg.startsWith('/review')) thinkingDetail = 'Analyzing agent configuration...';
    else if (lastUserMsg.startsWith('/optimize')) thinkingDetail = 'Optimizing system prompt...';
    else if (lastUserMsg.startsWith('/suggest-tools')) thinkingDetail = 'Matching tools to agent role...';
    else if (lastUserMsg.startsWith('/status')) thinkingDetail = 'Gathering agent status...';
    else if (lastUserMsg.startsWith('/help')) thinkingDetail = 'Loading available commands...';
    else if (/\b(outil|tool|api|endpoint|http|webhook)\b/i.test(lastUserMsg)) thinkingDetail = 'Analyzing tool requirements...';
    else if (/\b(prompt|instruction|role|personnalité|personality)\b/i.test(lastUserMsg)) thinkingDetail = 'Analyzing prompt requirements...';
    else if (/\b(deploy|déployer|publish|publier)\b/i.test(lastUserMsg)) thinkingDetail = 'Checking deployment readiness...';
    else if (/\b(knowledge|connaissance|document|rag|upload)\b/i.test(lastUserMsg)) thinkingDetail = 'Analyzing knowledge base needs...';
    else if (/\b(crée|créer|create|build|construire|nouveau|new)\b/i.test(lastUserMsg)) thinkingDetail = 'Planning agent configuration...';
    else thinkingDetail = 'Understanding request context...';

    const stream = await client.chat.completions.create({
      model: resolvedModel,
      messages: openaiMessages,
      temperature: temperature ?? 0.4,
      max_tokens: maxTokens ?? 4096,
      stream: true,
    });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send conversationId if we created/resumed one
    if (conversationId) {
      res.write(`data: ${JSON.stringify({ type: 'conversation', conversationId })}\n\n`);
    }

    // Step events for the frontend
    emitStep('language_detect', 'done');
    emitStep('load_context', 'done', agentConfig ? 'Agent config loaded' : undefined);
    emitStep('thinking', 'running', thinkingDetail);
    emitStep('build_prompt', 'done');
    emitStep('thinking', 'done', thinkingDetail);
    emitStep('call_llm', 'running', resolvedModel);

    // Emit enriched context info
    if (enrichedContext.configScore !== undefined) {
      res.write(`data: ${JSON.stringify({ type: 'config_score', score: enrichedContext.configScore })}\n\n`);
    }

    let fullAssistantContent = '';
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      const finishReason = chunk.choices?.[0]?.finish_reason;

      if (content) {
        fullAssistantContent += content;
        res.write(`data: ${JSON.stringify({ type: 'content', content })}\n\n`);
      }

      if (finishReason) {
        res.write(`data: ${JSON.stringify({ type: 'done', finishReason })}\n\n`);
      }
    }

    emitStep('call_llm', 'done');

    // Save assistant response
    if (conversationId && fullAssistantContent) {
      emitStep('save_conversation', 'running');
      conversationService.addMessage(conversationId, 'assistant', fullAssistantContent).catch(() => {});
      emitStep('save_conversation', 'done');
    }

    // Detect and apply GILO_APPLY_CONFIG block
    const configMatch = fullAssistantContent.match(/<!--\s*GILO_APPLY_CONFIG\s*:([\s\S]*?)-->/);
    if (configMatch) {
      emitStep('extract_config', 'running');
    }
    if (configMatch && agentId && agentId !== 'new-project') {
      try {
        // Sanitise common LLM JSON mistakes before parsing
        let rawJson = configMatch[1].trim();
        // Remove trailing commas before } or ]
        rawJson = rawJson.replace(/,\s*([\]}])/g, '$1');
        // Remove markdown code-fence wrappers if the LLM wrapped the JSON
        rawJson = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

        const configData = JSON.parse(rawJson);
        const updates: Record<string, any> = {};
        if (configData.systemPrompt) updates.systemPrompt = configData.systemPrompt;
        if (configData.temperature !== undefined) updates.temperature = configData.temperature;
        if (configData.maxTokens !== undefined) updates.maxTokens = configData.maxTokens;
        if (configData.welcomeMessage) updates.welcomeMessage = configData.welcomeMessage;
        if (configData.language) updates.language = configData.language;
        if (Array.isArray(configData.tools)) {
          // Ensure every tool has enabled:true if not explicitly set
          updates.tools = configData.tools.map((t: any) => ({
            ...t,
            enabled: t.enabled !== false, // default to true
            id: t.id || `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          }));
        }

        if (Object.keys(updates).length > 0) {
          emitStep('extract_config', 'done');
          emitStep('apply_config', 'running', Object.keys(updates).join(', '));
          await agentModel.updateConfig(agentId, updates);
          console.log('[Copilot] Auto-applied config to agent', agentId, Object.keys(updates));
          emitStep('apply_config', 'done', Object.keys(updates).join(', '));
          res.write(`data: ${JSON.stringify({ type: 'config_applied', fields: Object.keys(updates) })}\n\n`);
        }
      } catch (e: any) {
        console.error('[Copilot] Failed to auto-apply config:', e.message);
        emitStep('extract_config', 'error', e.message);
        // Try a lenient fallback: extract just the tools array
        try {
          const toolsMatch = configMatch[1].match(/"tools"\s*:\s*(\[[\s\S]*?\])/);
          if (toolsMatch) {
            let toolsJson = toolsMatch[1].replace(/,\s*([\]}])/g, '$1');
            const tools = JSON.parse(toolsJson).map((t: any) => ({
              ...t,
              enabled: t.enabled !== false,
              id: t.id || `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            }));
            await agentModel.updateConfig(agentId, { tools });
            console.log('[Copilot] Fallback: applied tools to agent', agentId, tools.length);
            res.write(`data: ${JSON.stringify({ type: 'config_applied', fields: ['tools'] })}\n\n`);
          }
        } catch (fallbackErr: any) {
          console.error('[Copilot] Fallback tools parse also failed:', fallbackErr.message);
        }
      }
    }

    // Detect and handle GILO_SAVE_CREDENTIALS block
    const credMatch = fullAssistantContent.match(/<!--GILO_SAVE_CREDENTIALS:([\s\S]*?)-->/);
    if (credMatch && agentId && agentId !== 'new-project' && userId) {
      try {
        emitStep('save_credentials', 'running');
        const credData = JSON.parse(credMatch[1].trim());
        if (Array.isArray(credData.credentials)) {
          const { credentialService } = await import('../services/credentialService');
          for (const cred of credData.credentials) {
            if (cred.service && cred.key && cred.value && cred.value !== 'MASKED') {
              await credentialService.saveCredential(agentId, userId, cred.service, cred.key, cred.value);
            }
          }
          console.log('[Copilot] Saved credentials for agent', agentId, credData.credentials.length);
          emitStep('save_credentials', 'done', `${credData.credentials.length} credentials`);
          res.write(`data: ${JSON.stringify({ type: 'credentials_saved', count: credData.credentials.length })}\n\n`);
        }
      } catch (e: any) {
        console.error('[Copilot] Failed to save credentials:', e.message);
      }
    }

    // Detect if the LLM is asking the user to provide API keys (no GILO_SAVE_CREDENTIALS block)
    if (!credMatch) {
      const keyRequestPatterns = [
        /(?:besoin|need|require|fournir|provide|entrer|enter)[\s\S]{0,60}(?:cl[ée]\s*(?:api|d'api)|api\s*key|secret|token|credential)/i,
        /(?:cl[ée]\s*(?:api|d'api)|api\s*key|secret\s*key|access\s*token)[\s\S]{0,60}(?:requis|required|manquant|missing|nécessaire|needed)/i,
        /veuillez\s+(?:fournir|ajouter|configurer|entrer)[\s\S]{0,40}(?:cl[ée]|key|token|secret)/i,
        /please\s+(?:provide|add|configure|enter)[\s\S]{0,40}(?:key|token|secret|credential)/i,
      ];
      const detectedKeys: string[] = [];
      // Extract specific key names mentioned
      const keyNameMatches = fullAssistantContent.matchAll(/(?:cl[ée]\s*(?:api|d'api)|api\s*key|secret\s*key|access\s*token|token)\s*(?:pour|for|de|:)?\s*[«"']?(\w[\w\s.-]{0,30}\w)[»"']?/gi);
      for (const m of keyNameMatches) {
        if (m[1] && m[1].length > 2 && m[1].length < 32) {
          detectedKeys.push(m[1].trim());
        }
      }
      const needsKeys = keyRequestPatterns.some(p => p.test(fullAssistantContent));
      if (needsKeys || detectedKeys.length > 0) {
        const uniqueKeys = [...new Set(detectedKeys)].slice(0, 5);
        res.write(`data: ${JSON.stringify({ type: 'credential_request', keys: uniqueKeys })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Copilot stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Copilot stream failed',
        details: error.message,
      });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
});

// ----------------------------------------------------------
// POST /api/copilot/generate  –  Code generation
// ----------------------------------------------------------
copilotRouter.post('/generate', async (req: Request, res: Response) => {
  try {
    const { prompt, language, projectContext } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const code = await copilotService.generateCode({
      prompt,
      language,
      projectContext,
    });

    res.json({ code });
  } catch (error: any) {
    console.error('Copilot generate error:', error);
    res.status(500).json({
      error: 'Code generation failed',
      details: error.message,
    });
  }
});

// ----------------------------------------------------------
// POST /api/copilot/review  –  Code review / explain / refactor
// ----------------------------------------------------------
copilotRouter.post('/review', async (req: Request, res: Response) => {
  try {
    const { code, language, action } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'code is required' });
    }

    const result = await copilotService.reviewCode({
      code,
      language,
      action,
    });

    res.json({ result });
  } catch (error: any) {
    console.error('Copilot review error:', error);
    res.status(500).json({
      error: 'Code review failed',
      details: error.message,
    });
  }
});

// ----------------------------------------------------------
// GET /api/copilot/status  –  Check Copilot availability
// ----------------------------------------------------------
copilotRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await copilotService.checkAvailability();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({
      available: false,
      error: error.message,
    });
  }
});

// ----------------------------------------------------------
// POST /api/copilot/repo/info  –  Get GitHub repo info
// ----------------------------------------------------------
copilotRouter.post('/repo/info', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.body;
    if (!owner || !repo) {
      return res.status(400).json({ error: 'owner and repo are required' });
    }
    const info = await copilotService.getRepoInfo(owner, repo);
    res.json(info);
  } catch (error: any) {
    console.error('Repo info error:', error);
    res.status(500).json({ error: 'Failed to fetch repo info', details: error.message });
  }
});

// ----------------------------------------------------------
// POST /api/copilot/repo/tree  –  Get GitHub repo file tree
// ----------------------------------------------------------
copilotRouter.post('/repo/tree', async (req: Request, res: Response) => {
  try {
    const { owner, repo, branch } = req.body;
    if (!owner || !repo) {
      return res.status(400).json({ error: 'owner and repo are required' });
    }
    const tree = await copilotService.getRepoTree(owner, repo, branch);
    res.json({ files: tree });
  } catch (error: any) {
    console.error('Repo tree error:', error);
    res.status(500).json({ error: 'Failed to fetch repo tree', details: error.message });
  }
});
