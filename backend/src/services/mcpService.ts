// ============================================================
// GiLo AI – MCP Service (Model Context Protocol)
// Real implementation using JSON-RPC over stdio to communicate
// with MCP-compliant tool servers.
// ============================================================

import { randomUUID } from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import { storageService } from './storageService';

// ----------------------------------------------------------
// Public interfaces
// ----------------------------------------------------------

export interface MCPServerConfig {
  id: string;
  name: string;
  /** "stdio" command or "http" URL */
  transport: 'stdio' | 'http';
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  description?: string;
  /** For HTTP transport */
  url?: string;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
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

// ----------------------------------------------------------
// JSON-RPC helpers (MCP uses JSON-RPC 2.0 over stdio)
// ----------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ----------------------------------------------------------
// MCP Connection (wraps a child process with JSON-RPC I/O)
// ----------------------------------------------------------

interface MCPConnection {
  config: MCPServerConfig;
  process: ChildProcess | null;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  /** pending JSON-RPC request resolvers */
  pending: Map<number, { resolve: (v: JsonRpcResponse) => void; reject: (e: Error) => void }>;
  nextId: number;
  /** accumulated stdout buffer for line-based parsing */
  buffer: string;
}

// ----------------------------------------------------------
// MCP Service
// ----------------------------------------------------------

export class MCPService {
  private connections: Map<string, MCPConnection> = new Map();
  private configs: Map<string, MCPServerConfig> = new Map();

  constructor() {
    this.loadConfigs();
  }

  // ==================== Config persistence ====================

  private async loadConfigs(): Promise<void> {
    try {
      const servers = await storageService.loadMCPServers();
      for (const server of servers) {
        // Backwards compat: ensure transport field exists
        if (!(server as any).transport) {
          (server as any).transport = 'stdio';
        }
        this.configs.set(server.id, server as MCPServerConfig);
      }
    } catch (error: any) {
      console.error('Error loading MCP configs:', error.message);
    }
  }

  private async saveConfigs(): Promise<void> {
    const servers = Array.from(this.configs.values());
    await storageService.saveMCPServers(servers as any);
  }

  // ==================== Server config CRUD ====================

  async addServerConfig(config: Omit<MCPServerConfig, 'id'>): Promise<MCPServerConfig> {
    const fullConfig: MCPServerConfig = {
      ...config,
      id: randomUUID(),
      transport: config.transport || 'stdio',
    };
    this.configs.set(fullConfig.id, fullConfig);
    await this.saveConfigs();
    return fullConfig;
  }

  getAllConfigs(): MCPServerConfig[] {
    return Array.from(this.configs.values());
  }

  async updateServerConfig(
    serverId: string,
    updates: Partial<MCPServerConfig>
  ): Promise<MCPServerConfig> {
    const config = this.configs.get(serverId);
    if (!config) throw new Error(`Server config not found: ${serverId}`);

    const wasEnabled = config.enabled;
    const updatedConfig = { ...config, ...updates, id: serverId };
    this.configs.set(serverId, updatedConfig);
    await this.saveConfigs();

    // Reconnect if needed
    if (wasEnabled && !updatedConfig.enabled) {
      await this.disconnectServer(serverId);
    } else if (!wasEnabled && updatedConfig.enabled) {
      await this.connectServer(serverId);
    } else if (updatedConfig.enabled && this.connections.has(serverId)) {
      await this.disconnectServer(serverId);
      await this.connectServer(serverId);
    }

    return updatedConfig;
  }

  async deleteServerConfig(serverId: string): Promise<void> {
    await this.disconnectServer(serverId);
    this.configs.delete(serverId);
    await this.saveConfigs();
  }

  // ==================== Connection lifecycle ====================

  async connectServer(serverId: string): Promise<void> {
    const config = this.configs.get(serverId);
    if (!config) throw new Error(`Server config not found: ${serverId}`);
    if (this.connections.has(serverId)) return; // already connected

    if (config.transport === 'http') {
      // HTTP transport: use fetch-based JSON-RPC (no child process)
      const conn: MCPConnection = {
        config,
        process: null,
        tools: [],
        resources: [],
        prompts: [],
        pending: new Map(),
        nextId: 1,
        buffer: '',
      };
      this.connections.set(serverId, conn);
      await this.discoverCapabilities(serverId);
      console.log(`🔌 MCP server "${config.name}" connected (HTTP)`);
      return;
    }

    // Stdio transport: spawn child process
    const child = spawn(config.command, config.args, {
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const conn: MCPConnection = {
      config,
      process: child,
      tools: [],
      resources: [],
      prompts: [],
      pending: new Map(),
      nextId: 1,
      buffer: '',
    };

    // Handle stdout: accumulate and parse JSON-RPC lines
    child.stdout?.on('data', (data: Buffer) => {
      conn.buffer += data.toString();
      this.processBuffer(conn);
    });

    child.stderr?.on('data', (data: Buffer) => {
      console.error(`[MCP:${config.name}] stderr: ${data.toString().trim()}`);
    });

    child.on('error', (err) => {
      console.error(`[MCP:${config.name}] process error:`, err.message);
      this.connections.delete(serverId);
    });

    child.on('exit', (code) => {
      console.log(`[MCP:${config.name}] process exited (code ${code})`);
      this.connections.delete(serverId);
    });

    this.connections.set(serverId, conn);

    // Initialize: send initialize + discover capabilities
    try {
      await this.sendRpc(serverId, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'gilo-ai', version: '1.0.0' },
      });
      // Notify initialized
      this.sendNotification(serverId, 'notifications/initialized', {});
      await this.discoverCapabilities(serverId);
      console.log(`🔌 MCP server "${config.name}" connected (stdio, PID ${child.pid})`);
    } catch (err: any) {
      console.error(`[MCP:${config.name}] initialization failed:`, err.message);
      await this.disconnectServer(serverId);
    }
  }

  async disconnectServer(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId);
    if (!conn) return;

    if (conn.process) {
      conn.process.kill('SIGTERM');
    }
    // Reject pending requests
    for (const [, pending] of conn.pending) {
      pending.reject(new Error('Server disconnected'));
    }
    this.connections.delete(serverId);
  }

  isConnected(serverId: string): boolean {
    return this.connections.has(serverId);
  }

  // ==================== JSON-RPC I/O ====================

  private processBuffer(conn: MCPConnection): void {
    // MCP uses newline-delimited JSON
    const lines = conn.buffer.split('\n');
    conn.buffer = lines.pop() || ''; // Keep incomplete last line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as JsonRpcResponse;
        if (msg.id != null && conn.pending.has(msg.id)) {
          const p = conn.pending.get(msg.id)!;
          conn.pending.delete(msg.id);
          p.resolve(msg);
        }
        // Notifications from server (no id) are logged but not processed
      } catch {
        // Not valid JSON — ignore
      }
    }
  }

  private sendRpc(
    serverId: string,
    method: string,
    params?: Record<string, unknown>,
    timeoutMs = 30_000
  ): Promise<JsonRpcResponse> {
    const conn = this.connections.get(serverId);
    if (!conn) throw new Error(`Server not connected: ${serverId}`);

    const id = conn.nextId++;
    const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };

    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        conn.pending.delete(id);
        reject(new Error(`MCP RPC timeout for "${method}" on ${conn.config.name}`));
      }, timeoutMs);

      conn.pending.set(id, {
        resolve: (resp) => {
          clearTimeout(timer);
          resolve(resp);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      if (conn.config.transport === 'http' && conn.config.url) {
        // HTTP transport
        fetch(conn.config.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(timeoutMs),
        })
          .then((r) => r.json())
          .then((resp) => {
            conn.pending.delete(id);
            clearTimeout(timer);
            resolve(resp as JsonRpcResponse);
          })
          .catch((err) => {
            conn.pending.delete(id);
            clearTimeout(timer);
            reject(err);
          });
      } else if (conn.process?.stdin?.writable) {
        // Stdio transport
        conn.process.stdin.write(JSON.stringify(request) + '\n');
      } else {
        conn.pending.delete(id);
        clearTimeout(timer);
        reject(new Error(`Cannot write to MCP server "${conn.config.name}"`));
      }
    });
  }

  private sendNotification(
    serverId: string,
    method: string,
    params?: Record<string, unknown>
  ): void {
    const conn = this.connections.get(serverId);
    if (!conn) return;
    const msg = { jsonrpc: '2.0', method, params };
    if (conn.process?.stdin?.writable) {
      conn.process.stdin.write(JSON.stringify(msg) + '\n');
    }
  }

  // ==================== Capability discovery ====================

  private async discoverCapabilities(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId);
    if (!conn) return;

    // Discover tools
    try {
      const resp = await this.sendRpc(serverId, 'tools/list', {});
      if (resp.result && (resp.result as any).tools) {
        conn.tools = ((resp.result as any).tools as any[]).map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema || {},
          serverId,
        }));
      }
    } catch {
      // Server may not support tools
    }

    // Discover resources
    try {
      const resp = await this.sendRpc(serverId, 'resources/list', {});
      if (resp.result && (resp.result as any).resources) {
        conn.resources = ((resp.result as any).resources as any[]).map((r) => ({
          uri: r.uri,
          name: r.name,
          description: r.description,
          mimeType: r.mimeType,
          serverId,
        }));
      }
    } catch {
      // Server may not support resources
    }

    // Discover prompts
    try {
      const resp = await this.sendRpc(serverId, 'prompts/list', {});
      if (resp.result && (resp.result as any).prompts) {
        conn.prompts = ((resp.result as any).prompts as any[]).map((p) => ({
          name: p.name,
          description: p.description,
          arguments: p.arguments,
          serverId,
        }));
      }
    } catch {
      // Server may not support prompts
    }
  }

  // ==================== Aggregated queries ====================

  getAllTools(): MCPTool[] {
    const allTools: MCPTool[] = [];
    for (const conn of this.connections.values()) {
      allTools.push(...conn.tools);
    }
    return allTools;
  }

  getAllResources(): MCPResource[] {
    const allResources: MCPResource[] = [];
    for (const conn of this.connections.values()) {
      allResources.push(...conn.resources);
    }
    return allResources;
  }

  getAllPrompts(): MCPPrompt[] {
    const allPrompts: MCPPrompt[] = [];
    for (const conn of this.connections.values()) {
      allPrompts.push(...conn.prompts);
    }
    return allPrompts;
  }

  getServerTools(serverId: string): MCPTool[] {
    return this.connections.get(serverId)?.tools || [];
  }

  // ==================== Tool / Resource / Prompt execution ====================

  async executeTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    if (!this.connections.has(serverId)) {
      throw new Error(`Server not connected: ${serverId}`);
    }

    const resp = await this.sendRpc(serverId, 'tools/call', {
      name: toolName,
      arguments: args,
    });

    if (resp.error) {
      throw new Error(`MCP tool error: ${resp.error.message}`);
    }

    // MCP tools/call returns { content: [...] } — flatten text content
    const result = resp.result as any;
    if (result?.content && Array.isArray(result.content)) {
      return result.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n');
    }
    return result;
  }

  async readResource(serverId: string, uri: string): Promise<unknown> {
    if (!this.connections.has(serverId)) {
      throw new Error(`Server not connected: ${serverId}`);
    }

    const resp = await this.sendRpc(serverId, 'resources/read', { uri });
    if (resp.error) {
      throw new Error(`MCP resource error: ${resp.error.message}`);
    }

    const result = resp.result as any;
    if (result?.contents && Array.isArray(result.contents)) {
      return result.contents
        .map((c: any) => c.text || c.blob || '')
        .join('\n');
    }
    return result;
  }

  async getPrompt(
    serverId: string,
    promptName: string,
    args?: Record<string, string>
  ): Promise<unknown> {
    if (!this.connections.has(serverId)) {
      throw new Error(`Server not connected: ${serverId}`);
    }

    const resp = await this.sendRpc(serverId, 'prompts/get', {
      name: promptName,
      arguments: args,
    });

    if (resp.error) {
      throw new Error(`MCP prompt error: ${resp.error.message}`);
    }
    return resp.result;
  }

  // ==================== Initialization ====================

  async initializeDefaultServers(): Promise<void> {
    const enabledServers = Array.from(this.configs.values()).filter((s) => s.enabled);
    if (enabledServers.length === 0) {
      console.log('MCP Service: No servers configured');
      return;
    }

    console.log(`MCP Service: Connecting ${enabledServers.length} server(s)…`);
    for (const server of enabledServers) {
      try {
        await this.connectServer(server.id);
      } catch (err: any) {
        console.error(`MCP Service: Failed to connect "${server.name}":`, err.message);
      }
    }
  }

  /** Clean shutdown — kill all child processes */
  async shutdown(): Promise<void> {
    const ids = Array.from(this.connections.keys());
    for (const id of ids) {
      await this.disconnectServer(id);
    }
  }
}

export const mcpService = new MCPService();
