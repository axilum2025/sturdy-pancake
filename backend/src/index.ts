import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { sessionRouter } from './routes/session';
import { agentRouter } from './routes/agent';
import { mcpRouter } from './routes/mcp';
import { storageRouter } from './routes/storage';

dotenv.config();

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

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
