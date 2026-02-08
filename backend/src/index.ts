import dotenv from 'dotenv';
// Load .env BEFORE any service imports so env vars are available at construction time
dotenv.config();

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { sessionRouter } from './routes/session';
import { agentRouter } from './routes/agent';
import { mcpRouter } from './routes/mcp';
import { storageRouter } from './routes/storage';
import { authRouter } from './routes/auth';
import { projectsRouter } from './routes/projects';
import { deploymentRouter } from './routes/deploy';
import { copilotRouter } from './routes/copilot';

const app: Express = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/sessions', sessionRouter);
app.use('/api/agent', agentRouter);
app.use('/api/mcp', mcpRouter);
app.use('/api/storage', storageRouter);
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/deploy', deploymentRouter);
app.use('/api/copilot', copilotRouter);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// API documentation endpoint
app.get('/api', (req: Request, res: Response) => {
  res.json({
    name: 'GiLo AI API',
    version: '2.0.0',
    endpoints: {
      auth: '/api/auth',
      projects: '/api/projects',
      deploy: '/api/deploy',
      copilot: '/api/copilot',
      sessions: '/api/sessions',
      agent: '/api/agent',
      mcp: '/api/mcp',
      storage: '/api/storage',
    }
  });
});

app.listen(port, () => {
  console.log('Server running on port ' + port);
});
