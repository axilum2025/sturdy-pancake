import { Router, Request, Response } from 'express';
import { credentialService } from '../services/credentialService';
import { AuthenticatedRequest } from '../middleware/auth';

export const credentialsRouter = Router();

// ----------------------------------------------------------
// GET /api/agents/:agentId/credentials  –  List credentials (masked)
// ----------------------------------------------------------
credentialsRouter.get('/:agentId/credentials', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const credentials = await credentialService.listCredentials(agentId);
    res.json({ credentials });
  } catch (error: any) {
    console.error('List credentials error:', error);
    res.status(500).json({ error: 'Failed to list credentials', details: error.message });
  }
});

// ----------------------------------------------------------
// POST /api/agents/:agentId/credentials  –  Save a credential
// ----------------------------------------------------------
credentialsRouter.post('/:agentId/credentials', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const userId = (req as AuthenticatedRequest).userId;
    const { service, key, value } = req.body;

    if (!service || !key || !value) {
      return res.status(400).json({ error: 'service, key, and value are required' });
    }

    const result = await credentialService.saveCredential(agentId, userId!, service, key, value);
    res.json(result);
  } catch (error: any) {
    console.error('Save credential error:', error);
    res.status(500).json({ error: 'Failed to save credential', details: error.message });
  }
});

// ----------------------------------------------------------
// DELETE /api/agents/:agentId/credentials/:credentialId  –  Delete credential
// ----------------------------------------------------------
credentialsRouter.delete('/:agentId/credentials/:credentialId', async (req: Request, res: Response) => {
  try {
    const { agentId, credentialId } = req.params;
    const deleted = await credentialService.deleteCredential(credentialId, agentId);
    if (!deleted) {
      return res.status(404).json({ error: 'Credential not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete credential error:', error);
    res.status(500).json({ error: 'Failed to delete credential', details: error.message });
  }
});
