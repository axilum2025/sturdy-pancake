import { Router, Request, Response } from 'express';
import { copilotService, CopilotMessage } from '../services/copilotService';

export const copilotRouter = Router();

// ----------------------------------------------------------
// POST /api/copilot/chat  –  Non-streaming chat
// ----------------------------------------------------------
copilotRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages, model, temperature, maxTokens, projectContext } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

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
// POST /api/copilot/chat/stream  –  SSE streaming chat
// ----------------------------------------------------------
copilotRouter.post('/chat/stream', async (req: Request, res: Response) => {
  try {
    const { messages, model, temperature, maxTokens, projectContext } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const generator = copilotService.chatStream({
      messages: messages as CopilotMessage[],
      model,
      temperature,
      maxTokens,
      projectContext,
    });

    for await (const chunk of generator) {
      if (req.destroyed) break;
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
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
