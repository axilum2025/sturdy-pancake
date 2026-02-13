// ============================================================
// GiLo AI – Analytics & Logs Routes
// GET /api/analytics – global user analytics
// GET /api/agents/:id/analytics – per-agent analytics
// GET /api/agents/:id/logs – per-agent logs
// GET /api/agents/:id/logs/export – CSV export
// ============================================================

import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { agentModel } from '../models/agent';
import {
  getAgentAnalytics,
  getUserAnalytics,
  getAgentLogs,
} from '../services/analyticsService';
import { cacheGet, cacheSet } from '../services/redisService';

export const analyticsRouter = Router();

// ----------------------------------------------------------
// Helper: default date range = last 30 days
// ----------------------------------------------------------
function defaultRange(req: Request): { startDate: string; endDate: string } {
  const endDate = (req.query.endDate as string) || new Date().toISOString().slice(0, 10);
  const startDate =
    (req.query.startDate as string) ||
    new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  return { startDate, endDate };
}

// ----------------------------------------------------------
// GET /api/analytics – Global dashboard for user
// ----------------------------------------------------------
analyticsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { startDate, endDate } = defaultRange(req);

    // Cache analytics for 30s to avoid repeated heavy queries
    const cacheKey = `cache:analytics:user:${userId}:${startDate}:${endDate}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const summary = await getUserAnalytics(userId, startDate, endDate);
    const result = { ...summary, startDate, endDate };
    await cacheSet(cacheKey, result, 30);
    res.json(result);
  } catch (error: any) {
    console.error('Global analytics error:', error.message);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// ----------------------------------------------------------
// GET /api/agents/:id/analytics – Per-agent analytics
// ----------------------------------------------------------
analyticsRouter.get('/agents/:id/analytics', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const agent = await agentModel.findById(req.params.id);
    if (!agent || agent.userId !== userId) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const { startDate, endDate } = defaultRange(req);
    const summary = await getAgentAnalytics(agent.id, startDate, endDate);
    res.json({ agentId: agent.id, agentName: agent.name, ...summary, startDate, endDate });
  } catch (error: any) {
    console.error('Agent analytics error:', error.message);
    res.status(500).json({ error: 'Failed to load agent analytics' });
  }
});

// ----------------------------------------------------------
// GET /api/agents/:id/logs – Per-agent logs (paginated)
// ----------------------------------------------------------
analyticsRouter.get('/agents/:id/logs', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const agent = await agentModel.findById(req.params.id);
    if (!agent || agent.userId !== userId) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const { logs, total } = await getAgentLogs(agent.id, {
      level: req.query.level as string,
      event: req.query.event as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
    });

    res.json({ logs, total, agentId: agent.id });
  } catch (error: any) {
    console.error('Agent logs error:', error.message);
    res.status(500).json({ error: 'Failed to load agent logs' });
  }
});

// ----------------------------------------------------------
// GET /api/agents/:id/logs/export – CSV export
// ----------------------------------------------------------
analyticsRouter.get('/agents/:id/logs/export', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const agent = await agentModel.findById(req.params.id);
    if (!agent || agent.userId !== userId) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const { logs } = await getAgentLogs(agent.id, {
      level: req.query.level as string,
      event: req.query.event as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      limit: 5000,
      offset: 0,
    });

    // Build CSV
    const header = 'timestamp,level,event,message,tokens_prompt,tokens_completion,response_ms,tool_name\n';
    const rows = logs.map((log) => {
      const meta = (log.metadata || {}) as Record<string, any>;
      return [
        log.createdAt?.toISOString() || '',
        log.level,
        log.event,
        `"${(log.message || '').replace(/"/g, '""')}"`,
        meta.tokensPrompt || '',
        meta.tokensCompletion || '',
        meta.responseMs || '',
        meta.toolName || '',
      ].join(',');
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="agent-${agent.id}-logs.csv"`);
    res.send(header + rows.join('\n'));
  } catch (error: any) {
    console.error('Export logs error:', error.message);
    res.status(500).json({ error: 'Failed to export logs' });
  }
});
