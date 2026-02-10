// ============================================================
// GiLo AI – Tools Management Routes
// CRUD for agent tools + tool catalogue + OpenAPI import
// ============================================================

import { Router, Request, Response } from 'express';
import { agentModel } from '../models/agent';
import { AuthenticatedRequest } from '../middleware/auth';
import { getCatalogueTools, getCatalogueCategories, getCatalogueTool } from '../services/toolCatalogue';
import { parseOpenAPISpec, testHttpAction, HttpActionConfig } from '../services/httpActionService';
import type { AgentToolDefinition } from '../services/toolExecutor';
import { randomUUID } from 'crypto';

export const toolsRouter = Router();

// Helper: verify agent ownership & return agent
async function getOwnedAgent(req: Request, res: Response) {
  const userId = (req as AuthenticatedRequest).userId;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  const agent = await agentModel.findById(req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return null;
  }
  if (agent.userId !== userId) {
    res.status(403).json({ error: 'Access denied' });
    return null;
  }
  return agent;
}

// ----------------------------------------------------------
// GET /api/agents/:id/tools  –  List agent's tools
// ----------------------------------------------------------
toolsRouter.get('/:id/tools', async (req: Request, res: Response) => {
  try {
    const agent = await getOwnedAgent(req, res);
    if (!agent) return;
    res.json({ tools: agent.config.tools || [] });
  } catch (error: any) {
    console.error('List tools error:', error.message);
    res.status(500).json({ error: 'Failed to list tools' });
  }
});

// ----------------------------------------------------------
// POST /api/agents/:id/tools  –  Add a tool to agent
// ----------------------------------------------------------
toolsRouter.post('/:id/tools', async (req: Request, res: Response) => {
  try {
    const agent = await getOwnedAgent(req, res);
    if (!agent) return;

    const tool: AgentToolDefinition = {
      id: req.body.id || randomUUID(),
      name: req.body.name,
      type: req.body.type || 'builtin',
      description: req.body.description || '',
      enabled: req.body.enabled !== false,
      parameters: req.body.parameters || { type: 'object', properties: {} },
      config: req.body.config || {},
    };

    if (!tool.name) {
      return res.status(400).json({ error: 'Tool name is required' });
    }

    const tools = [...(agent.config.tools || []), tool] as typeof agent.config.tools;
    const updated = await agentModel.updateConfig(agent.id, { ...agent.config, tools });
    res.status(201).json({ tool, agent: agentModel.toResponse(updated) });
  } catch (error: any) {
    console.error('Add tool error:', error.message);
    res.status(500).json({ error: 'Failed to add tool' });
  }
});

// ----------------------------------------------------------
// PATCH /api/agents/:id/tools/:toolId  –  Update a tool
// ----------------------------------------------------------
toolsRouter.patch('/:id/tools/:toolId', async (req: Request, res: Response) => {
  try {
    const agent = await getOwnedAgent(req, res);
    if (!agent) return;

    const tools = [...(agent.config.tools || [])];
    const idx = tools.findIndex((t: any) => t.id === req.params.toolId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    tools[idx] = { ...tools[idx], ...req.body, id: req.params.toolId };
    const updated = await agentModel.updateConfig(agent.id, { ...agent.config, tools });
    res.json({ tool: tools[idx], agent: agentModel.toResponse(updated) });
  } catch (error: any) {
    console.error('Update tool error:', error.message);
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

// ----------------------------------------------------------
// DELETE /api/agents/:id/tools/:toolId  –  Remove a tool
// ----------------------------------------------------------
toolsRouter.delete('/:id/tools/:toolId', async (req: Request, res: Response) => {
  try {
    const agent = await getOwnedAgent(req, res);
    if (!agent) return;

    const tools = (agent.config.tools || []).filter((t: any) => t.id !== req.params.toolId);
    const updated = await agentModel.updateConfig(agent.id, { ...agent.config, tools });
    res.json({ message: 'Tool removed', agent: agentModel.toResponse(updated) });
  } catch (error: any) {
    console.error('Delete tool error:', error.message);
    res.status(500).json({ error: 'Failed to delete tool' });
  }
});

// ----------------------------------------------------------
// POST /api/agents/:id/tools/add-builtin  –  Add a catalogue tool
// ----------------------------------------------------------
toolsRouter.post('/:id/tools/add-builtin', async (req: Request, res: Response) => {
  try {
    const agent = await getOwnedAgent(req, res);
    if (!agent) return;

    const { toolId } = req.body;
    if (!toolId) {
      return res.status(400).json({ error: 'toolId is required' });
    }

    const definition = getCatalogueTool(toolId);
    if (!definition) {
      return res.status(404).json({ error: 'Tool not found in catalogue' });
    }

    // Check if already added
    if ((agent.config.tools || []).some((t: any) => t.id === toolId)) {
      return res.status(409).json({ error: 'Tool already added to this agent' });
    }

    const tool = { ...definition, id: toolId };
    const tools = [...(agent.config.tools || []), tool] as typeof agent.config.tools;
    const updated = await agentModel.updateConfig(agent.id, { ...agent.config, tools });
    res.status(201).json({ tool, agent: agentModel.toResponse(updated) });
  } catch (error: any) {
    console.error('Add builtin tool error:', error.message);
    res.status(500).json({ error: 'Failed to add tool' });
  }
});

// ----------------------------------------------------------
// POST /api/agents/:id/tools/import-openapi  –  Import from OpenAPI spec
// ----------------------------------------------------------
toolsRouter.post('/:id/tools/import-openapi', async (req: Request, res: Response) => {
  try {
    const agent = await getOwnedAgent(req, res);
    if (!agent) return;

    const { spec } = req.body;
    if (!spec || typeof spec !== 'object') {
      return res.status(400).json({ error: 'OpenAPI spec object is required' });
    }

    const imported = parseOpenAPISpec(spec);
    if (imported.length === 0) {
      return res.status(400).json({ error: 'No operations found in OpenAPI spec' });
    }

    const tools = [...(agent.config.tools || []), ...imported] as typeof agent.config.tools;
    const updated = await agentModel.updateConfig(agent.id, { ...agent.config, tools });
    res.json({
      message: `Imported ${imported.length} tools from OpenAPI spec`,
      imported: imported.map((t) => ({ id: t.id, name: t.name, description: t.description })),
      agent: agentModel.toResponse(updated),
    });
  } catch (error: any) {
    console.error('Import OpenAPI error:', error.message);
    res.status(500).json({ error: 'Failed to import OpenAPI spec' });
  }
});

// ----------------------------------------------------------
// POST /api/tools/test-http  –  Test an HTTP action
// ----------------------------------------------------------
toolsRouter.post('/test-http', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { config, args } = req.body as {
      config: HttpActionConfig;
      args: Record<string, unknown>;
    };

    if (!config?.url || !config?.method) {
      return res.status(400).json({ error: 'config.url and config.method are required' });
    }

    const result = await testHttpAction(config, args || {});
    res.json(result);
  } catch (error: any) {
    console.error('Test HTTP action error:', error.message);
    res.status(500).json({ error: 'Failed to test HTTP action' });
  }
});

// ----------------------------------------------------------
// GET /api/tools/catalogue  –  Browse tool catalogue
// ----------------------------------------------------------
toolsRouter.get('/catalogue', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const category = req.query.category as string | undefined;
    const tools = getCatalogueTools(category);
    const categories = getCatalogueCategories();

    res.json({
      tools: tools.map((t) => ({
        ...t.definition,
        category: t.category,
        icon: t.icon,
        premium: t.premium,
      })),
      categories,
      total: tools.length,
    });
  } catch (error: any) {
    console.error('Catalogue error:', error.message);
    res.status(500).json({ error: 'Failed to load tool catalogue' });
  }
});
