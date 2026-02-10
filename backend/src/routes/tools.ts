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
import { getDb } from '../db';
import { communityTools } from '../db/schema';
import { eq, desc, ilike, or } from 'drizzle-orm';

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

// ==============================================================
// Community Tool Publishing
// ==============================================================

// ----------------------------------------------------------
// GET /api/tools/community  –  Browse community tools
// ----------------------------------------------------------
toolsRouter.get('/community', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { category, search } = req.query;

    const all = await db
      .select()
      .from(communityTools)
      .where(eq(communityTools.status, 'active'))
      .orderBy(desc(communityTools.installCount));

    let results = all;
    if (category && category !== 'all') {
      results = results.filter((t) => t.category === category);
    }
    if (search) {
      const s = (search as string).toLowerCase();
      results = results.filter(
        (t) => t.name.toLowerCase().includes(s) || t.description.toLowerCase().includes(s)
      );
    }

    res.json({
      tools: results.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        tags: t.tags,
        icon: t.icon,
        creatorName: t.creatorName,
        installCount: t.installCount,
        rating: t.rating,
        ratingCount: t.ratingCount,
        definition: t.definition,
        publishedAt: t.publishedAt,
      })),
      total: results.length,
    });
  } catch (error: any) {
    console.error('Community tools error:', error.message);
    res.status(500).json({ error: 'Failed to load community tools' });
  }
});

// ----------------------------------------------------------
// POST /api/tools/publish  –  Publish a tool to community
// ----------------------------------------------------------
toolsRouter.post('/publish', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { name, description, category, tags, icon, definition } = req.body;
    if (!name || !description || !definition) {
      return res.status(400).json({ error: 'name, description, and definition are required' });
    }

    const creatorName = req.body.creatorName || 'Anonymous';
    const db = getDb();

    const [tool] = await db
      .insert(communityTools)
      .values({
        userId,
        creatorName,
        name,
        description,
        category: category || 'other',
        tags: tags || [],
        icon: icon || 'Wrench',
        definition: {
          name: definition.name || name,
          type: definition.type || 'http',
          description: definition.description || description,
          parameters: definition.parameters || { type: 'object', properties: {} },
          config: definition.config || {},
        },
      })
      .returning();

    res.status(201).json({ tool });
  } catch (error: any) {
    console.error('Publish tool error:', error.message);
    res.status(500).json({ error: 'Failed to publish tool' });
  }
});

// ----------------------------------------------------------
// POST /api/tools/community/:toolId/install  –  Install community tool to agent
// ----------------------------------------------------------
toolsRouter.post('/community/:toolId/install', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { agentId } = req.body;
    if (!agentId) return res.status(400).json({ error: 'agentId is required' });

    const agent = await agentModel.findById(agentId);
    if (!agent || agent.userId !== userId) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const db = getDb();
    const [communityTool] = await db
      .select()
      .from(communityTools)
      .where(eq(communityTools.id, req.params.toolId));

    if (!communityTool || communityTool.status !== 'active') {
      return res.status(404).json({ error: 'Community tool not found' });
    }

    const toolDef: AgentToolDefinition = {
      id: `community_${communityTool.id}`,
      name: communityTool.definition.name,
      type: communityTool.definition.type as 'builtin' | 'http' | 'mcp',
      description: communityTool.definition.description,
      enabled: true,
      parameters: communityTool.definition.parameters,
      config: communityTool.definition.config,
    };

    if ((agent.config.tools || []).some((t: any) => t.id === toolDef.id)) {
      return res.status(409).json({ error: 'Tool already installed' });
    }

    const tools = [...(agent.config.tools || []), toolDef] as typeof agent.config.tools;
    const updated = await agentModel.updateConfig(agent.id, { ...agent.config, tools });

    // Increment install count
    await db
      .update(communityTools)
      .set({ installCount: communityTool.installCount + 1 })
      .where(eq(communityTools.id, communityTool.id));

    res.status(201).json({ tool: toolDef, agent: agentModel.toResponse(updated) });
  } catch (error: any) {
    console.error('Install community tool error:', error.message);
    res.status(500).json({ error: 'Failed to install community tool' });
  }
});

// ----------------------------------------------------------
// DELETE /api/tools/community/:toolId  –  Unpublish own tool
// ----------------------------------------------------------
toolsRouter.delete('/community/:toolId', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const db = getDb();
    const [tool] = await db.select().from(communityTools).where(eq(communityTools.id, req.params.toolId));
    if (!tool) return res.status(404).json({ error: 'Tool not found' });
    if (tool.userId !== userId) return res.status(403).json({ error: 'Access denied' });

    await db.update(communityTools).set({ status: 'removed' }).where(eq(communityTools.id, tool.id));
    res.json({ message: 'Tool unpublished' });
  } catch (error: any) {
    console.error('Delete community tool error:', error.message);
    res.status(500).json({ error: 'Failed to unpublish tool' });
  }
});
