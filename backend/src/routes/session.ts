import { Router, Request, Response } from 'express';
import { SessionManager } from '../services/sessionManager';

export const sessionRouter = Router();
const sessionManager = new SessionManager();

// Create new session
sessionRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { projectId, userId } = req.body;
    const session = await sessionManager.createSession({ projectId, userId });
    res.json(session);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get session by ID
sessionRouter.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await sessionManager.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(session);
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Delete session
sessionRouter.delete('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    await sessionManager.deleteSession(sessionId);
    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});
