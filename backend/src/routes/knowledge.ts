// ============================================================
// GiLo AI – Knowledge Base Routes
// Upload, manage, and search knowledge documents for agents
// ============================================================

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { agentModel } from '../models/agent';
import { knowledgeService } from '../services/knowledgeService';
import { isSupportedMimeType } from '../services/documentParser';
import { AuthenticatedRequest } from '../middleware/auth';

export const knowledgeRouter = Router();

// Multer config: 20 MB max, memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (isSupportedMimeType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Accepted: PDF, DOCX, TXT, MD, CSV, JSON.`));
    }
  },
});

// Helper: verify agent ownership
async function verifyAgentOwnership(req: Request, res: Response): Promise<string | null> {
  const userId = (req as AuthenticatedRequest).userId;
  const agentId = req.params.id;
  const agent = await agentModel.findById(agentId);
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
// POST /api/agents/:id/knowledge — Upload a document
// ----------------------------------------------------------
knowledgeRouter.post('/:id/knowledge', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = await verifyAgentOwnership(req, res);
    if (!userId) return;

    const agentId = req.params.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded. Use multipart/form-data with field name "file".' });
    }

    const doc = await knowledgeService.processDocument(
      agentId,
      userId,
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // Auto-add document ID to agent's knowledgeBase config
    const agent = await agentModel.findById(agentId);
    if (agent) {
      const knowledgeBase = agent.config.knowledgeBase || [];
      if (!knowledgeBase.includes(doc.id)) {
        knowledgeBase.push(doc.id);
        await agentModel.updateConfig(agentId, { knowledgeBase });
      }
    }

    res.status(201).json({
      message: 'Document uploaded and processing started',
      document: doc,
    });
  } catch (error: any) {
    console.error('Knowledge upload error:', error);
    if (error.message?.includes('Unsupported file type')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to upload document', details: error.message });
  }
});

// ----------------------------------------------------------
// GET /api/agents/:id/knowledge — List documents
// ----------------------------------------------------------
knowledgeRouter.get('/:id/knowledge', async (req: Request, res: Response) => {
  try {
    const userId = await verifyAgentOwnership(req, res);
    if (!userId) return;

    const documents = await knowledgeService.listDocuments(req.params.id);
    res.json({
      documents,
      total: documents.length,
    });
  } catch (error: any) {
    console.error('Knowledge list error:', error);
    res.status(500).json({ error: 'Failed to list documents', details: error.message });
  }
});

// ----------------------------------------------------------
// GET /api/agents/:id/knowledge/stats — Get knowledge base stats
// ----------------------------------------------------------
knowledgeRouter.get('/:id/knowledge/stats', async (req: Request, res: Response) => {
  try {
    const userId = await verifyAgentOwnership(req, res);
    if (!userId) return;

    const stats = await knowledgeService.getStats(req.params.id);
    res.json(stats);
  } catch (error: any) {
    console.error('Knowledge stats error:', error);
    res.status(500).json({ error: 'Failed to get stats', details: error.message });
  }
});

// ----------------------------------------------------------
// POST /api/agents/:id/knowledge/search — Test semantic search
// ----------------------------------------------------------
knowledgeRouter.post('/:id/knowledge/search', async (req: Request, res: Response) => {
  try {
    const userId = await verifyAgentOwnership(req, res);
    if (!userId) return;

    const { query, topK } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const results = await knowledgeService.search(req.params.id, query.trim(), topK || 5);
    res.json({
      results,
      total: results.length,
      query: query.trim(),
    });
  } catch (error: any) {
    console.error('Knowledge search error:', error);
    res.status(500).json({ error: 'Failed to search knowledge base', details: error.message });
  }
});

// ----------------------------------------------------------
// DELETE /api/agents/:id/knowledge/:docId — Delete a document
// ----------------------------------------------------------
knowledgeRouter.delete('/:id/knowledge/:docId', async (req: Request, res: Response) => {
  try {
    const userId = await verifyAgentOwnership(req, res);
    if (!userId) return;

    const { docId, id: agentId } = req.params;

    const deleted = await knowledgeService.deleteDocument(docId, userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Remove document ID from agent's knowledgeBase config
    const agent = await agentModel.findById(agentId);
    if (agent) {
      const knowledgeBase = (agent.config.knowledgeBase || []).filter((id: string) => id !== docId);
      await agentModel.updateConfig(agentId, { knowledgeBase });
    }

    res.json({ message: 'Document deleted' });
  } catch (error: any) {
    console.error('Knowledge delete error:', error);
    res.status(500).json({ error: 'Failed to delete document', details: error.message });
  }
});
