import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { randomUUID } from 'crypto';
import { storageService } from './storageService';

export interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  description?: string;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: any;
  serverId: string;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverId: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  serverId: string;
}

interface MCPConnection {
  config: MCPServerConfig;
  client: Client;
  transport: StdioClientTransport;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
}

export class MCPService {
  private connections: Map<string, MCPConnection>;
  private configs: Map<string, MCPServerConfig>;

  constructor() {
    this.connections = Map();
    this.configs = new Map();    this.loadConfigs();
  }

  /**
   * Charge les configurations depuis le stockage
   */
  private async loadConfigs(): Promise<void> {
    try {
      const servers = await storageService.loadMCPServers();
      for (const server of servers) {
        this.configs.set(server.id, server);
        if (server.enabled) {
          await this.connectServer(server.id).catch(err => {
            console.error(`Failed to auto-connect server ${server.name}:`, err.message);
          });
        }
      }
    } catch (error: any) {
      console.error('Error loading MCP configs:', error.message);
    }
  }

  /**
   * Sauvegarde les configurations dans le stockage
   */
  private async saveConfigs(): Promise<void> {
    const servers = Array.from(this.configs.values());
    await storageService.saveMCPServers(servers);  }

  /**
   * Ajoute une configuration de serveur MCP
   */
  async addServerConfig(config: Omit<MCPServerConfig, 'id'>): Promise<MCPServerConfig> {
    const fullConfig: MCPServerConfig = {
      ...config,
      id: randomUUID(),
    };

    this.configs.set(fullConfig.id, fullConfig);
    await this.saveConfigs();
    console.log(`✅ MCP Server config added: ${fullConfig.name} (${fullConfig.id})`);

    if (fullConfig.enabled) {
      await this.connectServer(fullConfig.id);
    }

    return fullConfig;
  }

  /**
   * Connecte à un serveur MCP
   */
  async connectServer(serverId: string): Promise<void> {
    const config = this.configs.get(serverId);
    if (!config) {
      throw new Error(`Server config not found: ${serverId}`);
    }

    if (this.connections.has(serverId)) {
      console.log(`⚠️  Server already connected: ${config.name}`);
      return;
    }

    try {
      // Créer le transport stdio
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env,
      });

      // Créer le client MCP
      const client = new Client({
        name: `lovable-builder-${serverId}`,
        version: '1.0.0',
      }, {
        capabilities: {
          tools: {},
          resources: { subscribe: true },
          prompts: {},
        },
      });

      // Connecter
      await client.connect(transport);

      // Récupérer les outils disponibles
      const toolsList = await client.listTools();
      const tools: MCPTool[] = toolsList.tools.map(tool => ({
        ...tool,
        serverId,
      }));

      // Récupérer les ressources disponibles
      const resourcesList = await client.listResources();
      const resources: MCPResource[] = resourcesList.resources.map(resource => ({
        ...resource,
        serverId,
      }));

      // Récupérer les prompts disponibles
      const promptsList = await client.listPrompts();
      const prompts: MCPPrompt[] = promptsList.prompts.map(prompt => ({
        ...prompt,
        serverId,
      }));

      // Stocker la connexion
      this.connections.set(serverId, {
        config,
        client,
        transport,
        tools,
        resources,
        prompts,
      });

      console.log(`✅ Connected to MCP server: ${config.name}`);
      console.log(`   Tools: ${tools.length}, Resources: ${resources.length}, Prompts: ${prompts.length}`);
    } catch (error: any) {
      console.error(`❌ Failed to connect to MCP server ${config.name}:`, error.message);
      throw error;
    }
  }

  /**
   * Déconnecte d'un serveur MCP
   */
  async disconnectServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return;
    }

    try {
      await connection.client.close();
      this.connections.delete(serverId);
      console.log(`🔌 Disconnected from MCP server: ${connection.config.name}`);
    } catch (error: any) {
      console.error(`Error disconnecting from server ${serverId}:`, error.message);
    }
  }

  /**
   * Liste tous les outils disponibles
   */
  getAllTools(): MCPTool[] {
    const allTools: MCPTool[] = [];
    for (const connection of this.connections.values()) {
      allTools.push(...connection.tools);
    }
    return allTools;
  }

  /**
   * Liste toutes les ressources disponibles
   */
  getAllResources(): MCPResource[] {
    const allResources: MCPResource[] = [];
    for (const connection of this.connections.values()) {
      allResources.push(...connection.resources);
    }
    return allResources;
  }

  /**
   * Liste tous les prompts disponibles
   */
  getAllPrompts(): MCPPrompt[] {
    const allPrompts: MCPPrompt[] = [];
    for (const connection of this.connections.values()) {
      allPrompts.push(...connection.prompts);
    }
    return allPrompts;
  }

  /**
   * Exécute un outil MCP
   */
  async executeTool(serverId: string, toolName: string, args: any): Promise<any> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`Server not connected: ${serverId}`);
    }

    try {
      console.log(`🔧 Executing tool: ${toolName} on server ${connection.config.name}`);
      const result = await connection.client.callTool({ name: toolName, arguments: args });
      return result;
    } catch (error: any) {
      console.error(`Error executing tool ${toolName}:`, error.message);
      throw error;
    }
  }

  /**
   * Lit une ressource MCP
   */
  async readResource(serverId: string, uri: string): Promise<any> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`Server not connected: ${serverId}`);
    }

    try {
      console.log(`📖 Reading resource: ${uri} from server ${connection.config.name}`);
      const result = await connection.client.readResource({ uri });
      return result;
    } catch (error: any) {
      console.error(`Error reading resource ${uri}:`, error.message);
      throw error;
    }
  }

  /**
   * Récupère un prompt MCP
   */
  async getPrompt(serverId: string, promptName: string, args?: Record<string, string>): Promise<any> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`Server not connected: ${serverId}`);
    }

    try {
      console.log(`💬 Getting prompt: ${promptName} from server ${connection.config.name}`);
      const result = await connection.client.getPrompt({ name: promptName, arguments: args });
      return result;
    } catch (error: any) {
      console.error(`Error getting prompt ${promptName}:`, error.message);
      throw error;
    }
  }

  /**
   * Liste toutes les configurations de serveurs
   */
  getAllConfigs(): MCPServerConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Met à jour une configuration de serveur
   */
  async updateServerConfig(serverId: string, updates: Partial<MCPServerConfig>): Promise<MCPServerConfig> {
    const config = this.configs.get(serverId);
    if (!config) {
      throw new Error(`Server config not found: ${serverId}`);
    }

    const wasEnabled = config.enabled;
    const updatedConfig = { ...config, ...upda
    await this.saveConfigs();tes, id: serverId };
    this.configs.set(serverId, updatedConfig);

    // Gérer la reconnexion si nécessaire
    if (wasEnabled && !updatedConfig.enabled) {
      await this.disconnectServer(serverId);
    } else if (!wasEnabled && updatedConfig.enabled) {
      await this.connectServer(serverId);
    } else if (updatedConfig.enabled) {
      // Reconnecter si les paramètres ont changé
      await this.disconnectServer(serverId);
      await this.connectServer(serverId);
    }

    return updatedConfig;
  }

  /**
   * Supprime une configuration de serveur
   */
  async deleteServerConfig(serverId: string): Promise<void> {
    await this.disconnectServer(serverId);
    await this.saveConfigs();
    this.configs.delete(serverId);
    console.log(`🗑️  Deleted server config: ${serverId}`);
  }

  /**
   * Initialise des serveurs MCP par défaut
   */
  async initializeDefaultServers(): Promise<void> {
    const defaultServers: Omit<MCPServerConfig, 'id'>[] = [
      {
        name: 'Filesystem',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp/mcp-workspace'],
        description: 'Accès sécurisé au système de fichiers',
        enabled: false,
      },
      {
        name: 'GitHub',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
          GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || '',
        },
        description: 'Intégration avec GitHub (repos, issues, PRs)',
        enabled: false,
      },
      {
        name: 'Memory',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
        description: 'Stockage en mémoire pour l\'agent',
        enabled: false,
      },
    ];

    for (const serverConfig of defaultServers) {
      await this.addServerConfig(serverConfig);
    }

    console.log(`✅ Initialized ${defaultServers.length} default MCP servers`);
  }
}
