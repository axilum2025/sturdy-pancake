import { randomUUID } from 'crypto';

export type ProjectTier = 'free' | 'pro';
export type DeploymentStatus = 'idle' | 'building' | 'deployed' | 'failed';
export type DeploymentProvider = 'azure-static' | 'azure-webapp' | 'github';

export interface ProjectFile {
  path: string;
  content: string;
  size: number;
}

export interface TechStack {
  frontend: string[];      // ["react", "tailwind", "vite"]
  backend?: string[];       // ["node", "express"]
  database?: string;        // "postgresql", "mongodb"
}

export interface Deployment {
  provider: DeploymentProvider;
  url?: string;
  repoUrl?: string;
  status: DeploymentStatus;
  deployedAt?: Date;
  error?: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  tier: ProjectTier;
  
  // Fichiers stockés comme strings JSON
  files: Record<string, string>;  // "src/App.tsx" → contenu
  
  // Metadata
  techStack: TechStack;
  
  // Déploiement
  deployment?: Deployment;
  
  // Statistiques
  storageUsed: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectCreateDTO {
  name: string;
  description?: string;
  techStack?: TechStack;
}

export interface ProjectResponse {
  id: string;
  name: string;
  description?: string;
  tier: ProjectTier;
  techStack: TechStack;
  deployment?: Deployment;
  filesCount: number;
  storageUsed: number;
  createdAt: string;
  updatedAt: string;
}

export class ProjectModel {
  private projects: Map<string, Project>;
  private userProjects: Map<string, Set<string>>; // userId → Project IDs

  constructor() {
    this.projects = new Map();
    this.userProjects = new Map();
    this.initializeSampleProject();
  }

  private initializeSampleProject(): void {
    const sampleProject: Project = {
      id: 'sample-project-id',
      userId: 'demo-user-id',
      name: 'Sample Landing Page',
      description: 'A beautiful landing page built with React and Tailwind',
      tier: 'free',
      files: {
        'src/App.tsx': `import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="p-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">My App</h1>
        <nav className="space-x-4">
          <a href="#features" className="hover:text-blue-400">Features</a>
          <a href="#pricing" className="hover:text-blue-400">Pricing</a>
          <a href="#contact" className="hover:text-blue-400">Contact</a>
        </nav>
      </header>
      
      <main>
        <section className="hero text-center py-20">
          <h2 className="text-5xl font-bold mb-4">Build Amazing Apps</h2>
          <p className="text-xl text-gray-400 mb-8">
            Create full-stack applications with AI-powered assistance
          </p>
          <button className="bg-blue-600 px-8 py-3 rounded-lg font-bold hover:bg-blue-700">
            Get Started
          </button>
        </section>
      </main>
    </div>
  );
}
`,
        'package.json': `{
  "name": "sample-app",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.3.5",
    "typescript": "^5.2.2",
    "vite": "^5.0.0"
  }
}`,
      },
      techStack: {
        frontend: ['react', 'tailwind', 'vite'],
      },
      deployment: {
        provider: 'azure-static',
        status: 'idle',
      },
      storageUsed: 2048,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.projects.set(sampleProject.id, sampleProject);
    
    if (!this.userProjects.has(sampleProject.userId)) {
      this.userProjects.set(sampleProject.userId, new Set());
    }
    this.userProjects.get(sampleProject.userId)!.add(sampleProject.id);
  }

  async create(userId: string, data: ProjectCreateDTO, userTier: ProjectTier): Promise<Project> {
    // Check project limit
    const userProjectIds = this.userProjects.get(userId) || new Set();
    const maxProjects = userTier === 'pro' ? 10 : 3;
    
    if (userProjectIds.size >= maxProjects) {
      throw new Error(`Project limit reached. Maximum ${maxProjects} projects for ${userTier} tier.`);
    }

    const project: Project = {
      id: randomUUID(),
      userId,
      name: data.name,
      description: data.description,
      tier: userTier,
      files: data.techStack ? this.generateTemplateFiles(data.techStack) : {},
      techStack: data.techStack || { frontend: ['react', 'tailwind', 'vite'] },
      deployment: {
        provider: userTier === 'pro' ? 'azure-webapp' : 'azure-static',
        status: 'idle',
      },
      storageUsed: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.projects.set(project.id, project);
    
    if (!this.userProjects.has(userId)) {
      this.userProjects.set(userId, new Set());
    }
    this.userProjects.get(userId)!.add(project.id);

    return project;
  }

  private generateTemplateFiles(stack: TechStack): Record<string, string> {
    const files: Record<string, string> = {};
    
    // Generate package.json based on stack
    const deps: Record<string, string> = {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
    };
    
    const devDeps: Record<string, string> = {
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      '@vitejs/plugin-react': '^4.2.0',
      autoprefixer: '^10.4.16',
      postcss: '^8.4.31',
      tailwindcss: '^3.3.5',
      typescript: '^5.2.2',
      vite: '^5.0.0',
    };

    if (stack.backend?.includes('express')) {
      deps['express'] = '^4.18.2';
      deps['cors'] = '^2.8.5';
      devDeps['@types/express'] = '^4.17.20';
      devDeps['@types/cors'] = '^2.8.15';
      devDeps['nodemon'] = '^3.0.1';
    }

    files['package.json'] = JSON.stringify({
      name: 'ai-generated-app',
      version: '1.0.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
        ...(stack.backend?.includes('express') && {
          server: 'nodemon server/index.ts',
        }),
      },
      dependencies: deps,
      devDependencies: devDeps,
    }, null, 2);

    // Generate basic structure
    files['src/App.tsx'] = this.generateAppTemplate(stack);
    files['index.html'] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Generated App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

    return files;
  }

  private generateAppTemplate(stack: TechStack): string {
    const hasBackend = stack.backend?.includes('express');
    
    return `import React from 'react';
${hasBackend ? `import { BrowserRouter, Routes, Route } from 'react-router-dom';` : ''}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="p-6">
        <h1 className="text-2xl font-bold">AI Generated App</h1>
      </header>
      <main className="p-6">
        <p className="text-gray-400">
          Your ${stack.frontend.join(' + ')} app${hasBackend ? ' with ' + stack.backend?.join(' + ') : ''} is ready!
        </p>
      </main>
    </div>
  );
}
`;
  }

  async findById(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async findByUserId(userId: string): Promise<Project[]> {
    const projectIds = this.userProjects.get(userId) || new Set();
    return Array.from(projectIds)
      .map(id => this.projects.get(id))
      .filter((p): p is Project => p !== undefined);
  }

  async update(id: string, data: Partial<Project>): Promise<Project> {
    const project = this.projects.get(id);
    if (!project) {
      throw new Error('Project not found');
    }
    const updated = { ...project, ...data, updatedAt: new Date() };
    this.projects.set(id, updated);
    return updated;
  }

  async updateFile(projectId: string, path: string, content: string): Promise<Project> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Calculate size difference
    const oldSize = project.files[path]?.length || 0;
    const newSize = content.length;
    project.storageUsed = project.storageUsed - oldSize + newSize;
    project.files[path] = content;
    project.updatedAt = new Date();

    this.projects.set(projectId, project);
    return project;
  }

  async deleteFile(projectId: string, path: string): Promise<Project> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    if (!project.files[path]) {
      throw new Error('File not found');
    }

    project.storageUsed -= project.files[path].length;
    delete project.files[path];
    project.updatedAt = new Date();

    this.projects.set(projectId, project);
    return project;
  }

  async delete(id: string): Promise<void> {
    const project = this.projects.get(id);
    if (!project) {
      throw new Error('Project not found');
    }

    this.projects.delete(id);
    this.userProjects.get(project.userId)?.delete(id);
  }

  async updateDeployment(id: string, deployment: Partial<Deployment>): Promise<Project> {
    const project = this.projects.get(id);
    if (!project) {
      throw new Error('Project not found');
    }

    project.deployment = { ...project.deployment, ...deployment } as Deployment;
    project.updatedAt = new Date();
    this.projects.set(id, project);
    return project;
  }

  toResponse(project: Project): ProjectResponse {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      tier: project.tier,
      techStack: project.techStack,
      deployment: project.deployment,
      filesCount: Object.keys(project.files).length,
      storageUsed: project.storageUsed,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }
}

export const projectModel = new ProjectModel();
