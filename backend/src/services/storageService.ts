import fs from 'fs/promises';
import path from 'path';
import { MCPServerConfig } from './mcpService';

const STORAGE_DIR = process.env.MCP_STORAGE_DIR || path.join(process.cwd(), 'data');
const SERVERS_FILE = path.join(STORAGE_DIR, 'mcp-servers.json');
const PROJECTS_DIR = path.join(STORAGE_DIR, 'projects');

export interface ProjectStorage {
  id: string;
  name: string;
  files: Record<string, string>; // filename -> content
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export class StorageService {
  constructor() {
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    try {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
      await fs.mkdir(PROJECTS_DIR, { recursive: true });
      
      // Créer le fichier de configurations si inexistant
      try {
        await fs.access(SERVERS_FILE);
      } catch {
        await fs.writeFile(SERVERS_FILE, JSON.stringify([], null, 2));
      }
      
      console.log(`✅ Storage initialized at ${STORAGE_DIR}`);
    } catch (error: any) {
      console.error('Failed to initialize storage:', error.message);
    }
  }

  // ===== MCP Server Configurations =====

  async saveMCPServers(servers: MCPServerConfig[]): Promise<void> {
    try {
      await fs.writeFile(SERVERS_FILE, JSON.stringify(servers, null, 2));
      console.log(`💾 Saved ${servers.length} MCP server configurations`);
    } catch (error: any) {
      console.error('Error saving MCP servers:', error.message);
      throw error;
    }
  }

  async loadMCPServers(): Promise<MCPServerConfig[]> {
    try {
      const data = await fs.readFile(SERVERS_FILE, 'utf-8');
      const servers = JSON.parse(data);
      console.log(`📂 Loaded ${servers.length} MCP server configurations`);
      return servers;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      console.error('Error loading MCP servers:', error.message);
      throw error;
    }
  }

  // ===== Project Storage =====

  async saveProject(project: ProjectStorage): Promise<void> {
    try {
      const projectPath = path.join(PROJECTS_DIR, `${project.id}.json`);
      await fs.writeFile(projectPath, JSON.stringify(project, null, 2));
      console.log(`💾 Saved project: ${project.name} (${project.id})`);
    } catch (error: any) {
      console.error('Error saving project:', error.message);
      throw error;
    }
  }

  async loadProject(projectId: string): Promise<ProjectStorage | null> {
    try {
      const projectPath = path.join(PROJECTS_DIR, `${projectId}.json`);
      const data = await fs.readFile(projectPath, 'utf-8');
      const project = JSON.parse(data);
      console.log(`📂 Loaded project: ${project.name} (${projectId})`);
      return project;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      console.error('Error loading project:', error.message);
      throw error;
    }
  }

  async listProjects(): Promise<ProjectStorage[]> {
    try {
      const files = await fs.readdir(PROJECTS_DIR);
      const projects: ProjectStorage[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const projectPath = path.join(PROJECTS_DIR, file);
          const data = await fs.readFile(projectPath, 'utf-8');
          projects.push(JSON.parse(data));
        }
      }

      console.log(`📂 Listed ${projects.length} projects`);
      return projects;
    } catch (error: any) {
      console.error('Error listing projects:', error.message);
      return [];
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    try {
      const projectPath = path.join(PROJECTS_DIR, `${projectId}.json`);
      await fs.unlink(projectPath);
      console.log(`🗑️  Deleted project: ${projectId}`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Error deleting project:', error.message);
        throw error;
      }
    }
  }

  // ===== File Operations for Projects =====

  async saveProjectFile(projectId: string, filename: string, content: string): Promise<void> {
    const project = await this.loadProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    project.files[filename] = content;
    project.updatedAt = new Date().toISOString();
    await this.saveProject(project);
    
    console.log(`📝 Saved file ${filename} to project ${projectId}`);
  }

  async getProjectFile(projectId: string, filename: string): Promise<string | null> {
    const project = await this.loadProject(projectId);
    if (!project) {
      return null;
    }

    return project.files[filename] || null;
  }

  async deleteProjectFile(projectId: string, filename: string): Promise<void> {
    const project = await this.loadProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    delete project.files[filename];
    project.updatedAt = new Date().toISOString();
    await this.saveProject(project);
    
    console.log(`🗑️  Deleted file ${filename} from project ${projectId}`);
  }

  // ===== Metadata Operations =====

  async updateProjectMetadata(projectId: string, metadata: Record<string, any>): Promise<void> {
    const project = await this.loadProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    project.metadata = { ...project.metadata, ...metadata };
    project.updatedAt = new Date().toISOString();
    await this.saveProject(project);
    
    console.log(`📝 Updated metadata for project ${projectId}`);
  }
}

export const storageService = new StorageService();
