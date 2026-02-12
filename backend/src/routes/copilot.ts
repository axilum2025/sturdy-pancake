import { Router, Request, Response } from 'express';
import { copilotService, CopilotMessage } from '../services/copilotService';
import { conversationService } from '../services/conversationService';
import { AuthenticatedRequest } from '../middleware/auth';
import { validate, chatSchema, copilotStreamSchema } from '../middleware/validation';
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
    const { messages, model, temperature, maxTokens, projectContext, conversationId: incomingConvId } = req.body;


    const { client, systemPrompt, defaultModel } = copilotService.getClientInfo(projectContext);
    const userId = (req as AuthenticatedRequest).userId;
    const agentId = projectContext?.projectId;

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

    const stream = await client.chat.completions.create({
      model: model || defaultModel,
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

    // Save assistant response
    if (conversationId && fullAssistantContent) {
      conversationService.addMessage(conversationId, 'assistant', fullAssistantContent).catch(() => {});
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
