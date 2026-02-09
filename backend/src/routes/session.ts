import { Router, Request, Response } from 'express';
import { SessionManager } from '../services/sessionManager';
import { AuthenticatedRequest } from '../middleware/auth';

export const sessionRouter = Router();
const sessionManager = new SessionManager();

// Create new session — uses JWT userId, not body
sessionRouter.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { projectId } = req.body;
    const session = await sessionManager.createSession({ projectId, userId });
    res.json(session);
  } catch (error: any) {
    console.error('Error creating session:', error.message);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get session by ID — verify ownership
sessionRouter.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { sessionId } = req.params;
    const session = await sessionManager.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(session);
  } catch (error: any) {
    console.error('Error getting session:', error.message);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Delete session — verify ownership
sessionRouter.delete('/:sessionId', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { sessionId } = req.params;
    const session = await sessionManager.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await sessionManager.deleteSession(sessionId);
    res.json({ message: 'Session deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting session:', error.message);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});
