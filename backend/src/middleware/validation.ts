// ============================================================
// GiLo AI – Zod Validation Schemas & Middleware
// Centralized request validation for all API routes
// ============================================================

import { z } from 'zod/v4';
import { Request, Response, NextFunction } from 'express';

// ----------------------------------------------------------
// Middleware factory: validates req.body against a Zod schema
// ----------------------------------------------------------
export function validate(schema: z.ZodType<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    req.body = result.data; // use parsed+coerced data
    next();
  };
}

// ----------------------------------------------------------
// Auth Schemas
// ----------------------------------------------------------
export const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  name: z.string().min(1).max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters').max(128),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(50).trim(),
});

// ----------------------------------------------------------
// Agent Schemas
// ----------------------------------------------------------
export const createAgentSchema = z.object({
  name: z.string().min(1, 'Agent name is required').max(200).trim(),
  description: z.string().max(2000).optional(),
  config: z.object({
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).max(128000).optional(),
    systemPrompt: z.string().max(50000).optional(),
    welcomeMessage: z.string().max(5000).optional(),
    language: z.enum(['fr', 'en']).optional(),
  }).optional(),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).optional(),
});

export const updateAgentConfigSchema = z.object({
  model: z.string().max(100).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
  topP: z.number().min(0).max(1).optional(),
  systemPrompt: z.string().max(50000).optional(),
  welcomeMessage: z.string().max(5000).optional(),
  language: z.enum(['fr', 'en']).optional(),
  tools: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['builtin', 'http', 'mcp']),
    description: z.string().optional(),
    enabled: z.boolean(),
    parameters: z.record(z.string(), z.unknown()).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  })).optional(),
  knowledgeBase: z.array(z.string()).optional(),
  appearance: z.object({
    theme: z.enum(['dark', 'light', 'auto']).optional(),
    accentColor: z.string().max(20).optional(),
    chatBackground: z.string().max(5_000_000).optional(),
  }).optional(),
}).passthrough(); // allow extra fields for forward compat

// ----------------------------------------------------------
// Chat Schemas
// ----------------------------------------------------------
const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(100000),
});

export const chatSchema = z.object({
  messages: z.array(messageSchema).min(1, 'At least one message is required').max(200),
  conversationId: z.string().uuid().optional(),
});

export const copilotStreamSchema = z.object({
  messages: z.array(messageSchema).min(1).max(200),
  model: z.string().max(100).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
  conversationId: z.string().uuid().optional(),
  projectContext: z.object({
    projectId: z.string(),
    techStack: z.array(z.string()).optional(),
    files: z.array(z.string()).optional(),
  }).optional(),
});

// ----------------------------------------------------------
// Webhook Schemas
// ----------------------------------------------------------
export const createWebhookSchema = z.object({
  url: z.string().url('Invalid webhook URL').max(2000),
  events: z.array(z.enum([
    'on_conversation_start',
    'on_message',
    'on_escalation',
    'on_error',
  ])).min(1, 'At least one event is required'),
  active: z.boolean().optional().default(true),
});

// ----------------------------------------------------------
// API Key Schemas
// ----------------------------------------------------------
export const createApiKeySchema = z.object({
  name: z.string().min(1, 'Key name is required').max(100).trim(),
  expiresIn: z.number().int().min(1).max(365).optional(), // days
});

// ----------------------------------------------------------
// Alert Schemas
// ----------------------------------------------------------
export const createAlertSchema = z.object({
  type: z.enum(['error_rate', 'cost_limit', 'inactivity', 'rate_limit']),
  config: z.object({
    threshold: z.number().min(0),
    window: z.string().max(20).optional(),
    notifyEmail: z.string().email().optional(),
    notifyWebhook: z.string().url().optional(),
  }),
});

// ----------------------------------------------------------
// Store / Publish Schemas
// ----------------------------------------------------------
export const publishAgentSchema = z.object({
  agentId: z.string().min(1, 'agentId is required'),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  shortDescription: z.string().max(500).optional(),
  icon: z.string().max(1_000_000).optional(),
  iconColor: z.string().max(50).optional(),
  color: z.string().max(50).optional(),
  category: z.string().min(1).max(50),
  features: z.array(z.string().max(200)).max(20).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  isPublic: z.boolean().optional().default(true),
  visibility: z.enum(['public', 'private', 'unlisted']).optional(),
}).passthrough();
