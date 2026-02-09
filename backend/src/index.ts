import dotenv from 'dotenv';
// Load .env BEFORE any service imports so env vars are available at construction time
dotenv.config();

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { initDb, closeDb } from './db';
import { sessionRouter } from './routes/session';
import { agentRouter } from './routes/agent';
import { mcpRouter } from './routes/mcp';
import { storageRouter } from './routes/storage';
import { authRouter } from './routes/auth';
import { projectsRouter } from './routes/projects';
import { deploymentRouter } from './routes/deploy';
import { copilotRouter } from './routes/copilot';
import { agentsRouter } from './routes/agents';
import { storeRouter } from './routes/store';
import { apiKeysRouter } from './routes/apiKeys';
import { webhooksRouter } from './routes/webhooks';
import { publicApiRouter } from './routes/publicApi';
import { knowledgeRouter } from './routes/knowledge';
import { authMiddleware, optionalAuth } from './middleware/auth';
import { apiKeyAuth } from './middleware/apiKeyAuth';
import { rateLimiter } from './middleware/rateLimiter';

const port = process.env.PORT || 3001;

async function main() {
  // ---- Initialize database ----
  await initDb();
  console.log('✅ Database ready');

  const app: Express = express();

  // Middleware
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:5173',
    credentials: true
  }));
  app.use(express.json());

  // Public routes (no auth required)
  app.use('/api/auth', authRouter);
  app.use('/api/store', optionalAuth, storeRouter);

  // Public API v1 (API key auth + rate limiting)
  app.use('/api/v1', apiKeyAuth, rateLimiter, publicApiRouter);

  // Protected routes (JWT required)
  app.use('/api/sessions', authMiddleware, sessionRouter);
  app.use('/api/agent', authMiddleware, agentRouter);
  app.use('/api/mcp', authMiddleware, mcpRouter);
  app.use('/api/storage', authMiddleware, storageRouter);
  app.use('/api/projects', authMiddleware, projectsRouter);
  app.use('/api/deploy', authMiddleware, deploymentRouter);
  app.use('/api/copilot', authMiddleware, copilotRouter);
  app.use('/api/agents', authMiddleware, agentsRouter);
  app.use('/api/agents', authMiddleware, apiKeysRouter);
  app.use('/api/agents', authMiddleware, webhooksRouter);
  app.use('/api/agents', authMiddleware, knowledgeRouter);

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '3.0.0'
    });
  });
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '3.0.0'
    });
  });

  // API documentation endpoint
  app.get('/api', (req: Request, res: Response) => {
    res.json({
      name: 'GiLo AI — Agent Builder API',
      version: '5.0.0',
      endpoints: {
        auth: '/api/auth',
        projects: '/api/projects',
        deploy: '/api/deploy',
        copilot: '/api/copilot',
        agents: '/api/agents',
        apiKeys: '/api/agents/:id/api-keys',
        webhooks: '/api/agents/:id/webhooks',
        knowledge: '/api/agents/:id/knowledge',
        publicApi: '/api/v1/agents/:id/chat',
        store: '/api/store',
        sessions: '/api/sessions',
        agent: '/api/agent',
        mcp: '/api/mcp',
        storage: '/api/storage',
      }
    });
  });

  app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down...');
    await closeDb();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
