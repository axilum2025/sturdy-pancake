import { Router, Request, Response } from 'express';
import { MCPService } from '../services/mcpService';

export const mcpRouter = Router();
const mcpService = new MCPService();

// Initialiser les serveurs par défaut au démarrage
mcpService.initializeDefaultServers().catch(console.error);

// Liste toutes les configurations de serveurs MCP
mcpRouter.get('/servers', (req: Request, res: Response) => {
  try {
    const configs = mcpService.getAllConfigs();
    res.json(configs);
  } catch (error: any) {
    console.error('Error listing MCP servers:', error);
    res.status(500).json({ error: 'Failed to list MCP servers' });
  }
});

// Ajoute une nouvelle configuration de serveur MCP
mcpRouter.post('/servers', async (req: Request, res: Response) => {
  try {
    const { name, command, args, env, enabled, description } = req.body;

    if (!name || !command || !args) {
      return res.status(400).json({ 
        error: 'name, command, and args are required' 
      });
    }

    const config = await mcpService.addServerConfig({
      name,
      command,
      args,
      env,
      enabled: enabled ?? false,
      description,
    });

    res.status(201).json(config);
  } catch (error: any) {
    console.error('Error adding MCP server:', error);
    res.status(500).json({ error: error.message });
  }
});

// Met à jour une configuration de serveur MCP
mcpRouter.patch('/servers/:serverId', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    const updates = req.body;

    const config = await mcpService.updateServerConfig(serverId, updates);
    res.json(config);
  } catch (error: any) {
    console.error('Error updating MCP server:', error);
    res.status(500).json({ error: error.message });
  }
});

// Supprime une configuration de serveur MCP
mcpRouter.delete('/servers/:serverId', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    await mcpService.deleteServerConfig(serverId);
    res.json({ message: 'Server deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting MCP server:', error);
    res.status(500).json({ error: error.message });
  }
});

// Connecte à un serveur MCP
mcpRouter.post('/servers/:serverId/connect', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    await mcpService.connectServer(serverId);
    res.json({ message: 'Server connected successfully' });
  } catch (error: any) {
    console.error('Error connecting to MCP server:', error);
    res.status(500).json({ error: error.message });
  }
});

// Déconnecte d'un serveur MCP
mcpRouter.post('/servers/:serverId/disconnect', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    await mcpService.disconnectServer(serverId);
    res.json({ message: 'Server disconnected successfully' });
  } catch (error: any) {
    console.error('Error disconnecting from MCP server:', error);
    res.status(500).json({ error: error.message });
  }
});

// Liste tous les outils disponibles
mcpRouter.get('/tools', (req: Request, res: Response) => {
  try {
    const tools = mcpService.getAllTools();
    res.json(tools);
  } catch (error: any) {
    console.error('Error listing tools:', error);
    res.status(500).json({ error: 'Failed to list tools' });
  }
});

// Exécute un outil MCP
mcpRouter.post('/tools/execute', async (req: Request, res: Response) => {
  try {
    const { serverId, toolName, args } = req.body;

    if (!serverId || !toolName) {
      return res.status(400).json({ 
        error: 'serverId and toolName are required' 
      });
    }

    const result = await mcpService.executeTool(serverId, toolName, args || {});
    res.json(result);
  } catch (error: any) {
    console.error('Error executing tool:', error);
    res.status(500).json({ error: error.message });
  }
});

// Liste toutes les ressources disponibles
mcpRouter.get('/resources', (req: Request, res: Response) => {
  try {
    const resources = mcpService.getAllResources();
    res.json(resources);
  } catch (error: any) {
    console.error('Error listing resources:', error);
    res.status(500).json({ error: 'Failed to list resources' });
  }
});

// Lit une ressource MCP
mcpRouter.post('/resources/read', async (req: Request, res: Response) => {
  try {
    const { serverId, uri } = req.body;

    if (!serverId || !uri) {
      return res.status(400).json({ 
        error: 'serverId and uri are required' 
      });
    }

    const result = await mcpService.readResource(serverId, uri);
    res.json(result);
  } catch (error: any) {
    console.error('Error reading resource:', error);
    res.status(500).json({ error: error.message });
  }
});

// Liste tous les prompts disponibles
mcpRouter.get('/prompts', (req: Request, res: Response) => {
  try {
    const prompts = mcpService.getAllPrompts();
    res.json(prompts);
  } catch (error: any) {
    console.error('Error listing prompts:', error);
    res.status(500).json({ error: 'Failed to list prompts' });
  }
});

// Récupère un prompt MCP
mcpRouter.post('/prompts/get', async (req: Request, res: Response) => {
  try {
    const { serverId, promptName, args } = req.body;

    if (!serverId || !promptName) {
      return res.status(400).json({ 
        error: 'serverId and promptName are required' 
      });
    }

    const result = await mcpService.getPrompt(serverId, promptName, args);
    res.json(result);
  } catch (error: any) {
    console.error('Error getting prompt:', error);
    res.status(500).json({ error: error.message });
  }
});

export { mcpService };
