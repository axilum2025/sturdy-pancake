import { Router, Request, Response } from 'express';
import { AgentService } from '../services/agentService';
import { AuthenticatedRequest } from '../middleware/auth';

export const agentRouter = Router();
const agentService = new AgentService();

// Send task to agent — userId from JWT, not body
agentRouter.post('/task', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { sessionId, prompt, constraints } = req.body;
    
    if (!sessionId || !prompt) {
      return res.status(400).json({ error: 'sessionId and prompt are required' });
    }
    
    const result = await agentService.executeTask({
      sessionId,
      prompt,
      constraints
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('Error executing task:', error.message);
    res.status(500).json({ error: 'Failed to execute task' });
  }
});

// Get task status
agentRouter.get('/task/:taskId', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { taskId } = req.params;
    const status = await agentService.getTaskStatus(taskId);
    
    if (!status) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json(status);
  } catch (error: any) {
    console.error('Error getting task status:', error.message);
    res.status(500).json({ error: 'Failed to get task status' });
  }
});

// Stream agent output
agentRouter.get('/stream/:sessionId', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { sessionId } = req.params;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  agentService.streamOutput(sessionId, (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
  
  req.on('close', () => {
    res.end();
  });
});
