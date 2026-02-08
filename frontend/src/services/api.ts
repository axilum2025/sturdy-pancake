import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  // For demo: add user ID header
  const userId = localStorage.getItem('userId');
  if (userId) {
    config.headers['x-user-id'] = userId;
  }
  return config;
});

// ============ Auth ============

export interface User {
  id: string;
  email: string;
  tier: 'free' | 'pro' | 'team';
  quotas: {
    projectsMax: number;
    storageMax: number;
    deploymentsPerMonth: number;
  };
  usage: {
    projectsCount: number;
    storageUsed: number;
    deploymentsThisMonth: number;
  };
  subscription?: {
    status: string;
    stripeCustomerId?: string;
    subscriptionId?: string;
    currentPeriodEnd?: string;
  };
}

export const register = async (email: string, password: string): Promise<{ user: User; token: string }> => {
  const response = await api.post('/auth/register', { email, password });
  return response.data;
};

export const login = async (email: string, password: string): Promise<{ user: User; token: string }> => {
  const response = await api.post('/auth/login', { email, password });
  if (response.data.token) {
    localStorage.setItem('authToken', response.data.token);
    localStorage.setItem('userId', response.data.user.id);
  }
  return response.data;
};

export const logout = (): void => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userId');
};

export const getCurrentUser = async (): Promise<User> => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const upgradeToPro = async (stripeCustomerId?: string, subscriptionId?: string): Promise<User> => {
  const response = await api.post('/auth/upgrade', { stripeCustomerId, subscriptionId });
  return response.data;
};

// ============ Projects ============

export interface TechStack {
  frontend: string[];
  backend?: string[];
  database?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  tier: 'free' | 'pro';
  techStack: TechStack;
  deployment?: {
    provider: string;
    url?: string;
    status: string;
  };
  filesCount: number;
  storageUsed: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFile {
  path: string;
  content: string;
  size?: number;
}

export const listProjects = async (): Promise<{ projects: Project[]; total: number; userTier: string }> => {
  const response = await api.get('/projects');
  return response.data;
};

export const getProject = async (projectId: string): Promise<Project> => {
  const response = await api.get(`/projects/${projectId}`);
  return response.data;
};

export const createProject = async (name: string, description?: string, techStack?: TechStack): Promise<Project> => {
  const response = await api.post('/projects', { name, description, techStack });
  return response.data;
};

export const updateProject = async (projectId: string, data: Partial<Project>): Promise<Project> => {
  const response = await api.patch(`/projects/${projectId}`, data);
  return response.data;
};

export const deleteProject = async (projectId: string): Promise<void> => {
  await api.delete(`/projects/${projectId}`);
};

// ============ Files ============

export const listFiles = async (projectId: string): Promise<{ files: Record<string, string>; filesCount: number; storageUsed: number }> => {
  const response = await api.get(`/projects/${projectId}/files`);
  return response.data;
};

export const getFile = async (projectId: string, path: string): Promise<ProjectFile> => {
  const response = await api.get(`/projects/${projectId}/files/${path}`);
  return response.data;
};

export const saveFile = async (projectId: string, path: string, content: string): Promise<{ path: string; storageUsed: number }> => {
  const response = await api.put(`/projects/${projectId}/files/${path}`, { content });
  return response.data;
};

export const deleteFile = async (projectId: string, path: string): Promise<void> => {
  await api.delete(`/projects/${projectId}/files/${path}`);
};

// ============ Deployment ============

export interface Deployment {
  deploymentId: string;
  status: 'pending' | 'building' | 'deployed' | 'failed';
  url?: string;
  previewUrl?: string;
  deployedAt?: string;
  error?: string;
}

export const deployProject = async (projectId: string, provider?: string, customDomain?: string): Promise<{ message: string; deployment: { id: string; status: string; estimatedTime: string } }> => {
  const response = await api.post(`/deploy/${projectId}`, { provider, customDomain });
  return response.data;
};

export const getDeployment = async (deploymentId: string): Promise<Deployment> => {
  const response = await api.get(`/deploy/${deploymentId}`);
  return response.data;
};

export const getProjectDeployments = async (projectId: string): Promise<{ deployments: Deployment[]; total: number }> => {
  const response = await api.get(`/deploy/project/${projectId}`);
  return response.data;
};

export const deleteDeployment = async (deploymentId: string): Promise<void> => {
  await api.delete(`/deploy/${deploymentId}`);
};

// ============ Sessions (Legacy) ============

export interface Session {
  id: string;
  projectId: string;
  userId: string;
  createdAt: string;
  state: 'active' | 'idle' | 'closed';
}

export const createSession = async (params: {
  projectId: string;
  userId: string;
}): Promise<Session> => {
  const response = await api.post('/sessions', params);
  return response.data;
};

export const getSession = async (sessionId: string): Promise<Session> => {
  const response = await api.get(`/sessions/${sessionId}`);
  return response.data;
};

// ============ Agent (Legacy) ============

export interface TaskConstraints {
  stack?: string[];
  accessibility?: boolean;
  mobileFirst?: boolean;
  externalAPIs?: boolean;
}

export interface Task {
  id: string;
  sessionId: string;
  prompt: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export const sendAgentTask = async (params: {
  sessionId: string;
  prompt: string;
  constraints?: TaskConstraints;
}): Promise<Task> => {
  const response = await api.post('/agent/task', params);
  return response.data;
};

export const getTaskStatus = async (taskId: string): Promise<Task> => {
  const response = await api.get(`/agent/task/${taskId}`);
  return response.data;
};

// ============ MCP ============

export const getMCPServers = async () => {
  const response = await api.get('/mcp/servers');
  return response.data;
};

export const addMCPServer = async (server: any) => {
  const response = await api.post('/mcp/servers', server);
  return response.data;
};

export const deleteMCPServer = async (serverId: string) => {
  const response = await api.delete(`/mcp/servers/${serverId}`);
  return response.data;
};

// ============ Copilot (GitHub Copilot Integration) ============

export interface CopilotMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CopilotChatRequest {
  messages: CopilotMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  projectContext?: {
    projectId: string;
    techStack?: string[];
    files?: string[];
  };
}

export interface CopilotChatResponse {
  id: string;
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

export interface CopilotStatus {
  available: boolean;
  model: string;
  error?: string;
}

/** Non-streaming Copilot chat */
export const copilotChat = async (request: CopilotChatRequest): Promise<CopilotChatResponse> => {
  const response = await api.post('/copilot/chat', request);
  return response.data;
};

/**
 * Streaming Copilot chat – returns a ReadableStream via fetch (not axios).
 * The caller is responsible for reading SSE events from the stream.
 */
export const copilotChatStream = async (
  request: CopilotChatRequest,
): Promise<Response> => {
  const token = localStorage.getItem('authToken');
  const userId = localStorage.getItem('userId');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (userId) headers['x-user-id'] = userId;

  const response = await fetch('/api/copilot/stream', {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Copilot stream failed: ${response.statusText}`);
  }

  return response;
};

/** Generate code via Copilot */
export const copilotGenerateCode = async (params: {
  prompt: string;
  language?: string;
  projectContext?: CopilotChatRequest['projectContext'];
}): Promise<{ code: string }> => {
  const response = await api.post('/copilot/generate', params);
  return response.data;
};

/** Review / explain / refactor code via Copilot */
export const copilotReviewCode = async (params: {
  code: string;
  language?: string;
  action?: 'review' | 'explain' | 'refactor' | 'test';
}): Promise<{ result: string }> => {
  const response = await api.post('/copilot/review', params);
  return response.data;
};

/** Check Copilot availability */
export const getCopilotStatus = async (): Promise<CopilotStatus> => {
  const response = await api.get('/copilot/status');
  return response.data;
};

/** Get GitHub repo info */
export const getRepoInfo = async (owner: string, repo: string) => {
  const response = await api.post('/copilot/repo/info', { owner, repo });
  return response.data;
};

/** Get GitHub repo file tree */
export const getRepoTree = async (owner: string, repo: string, branch?: string) => {
  const response = await api.post('/copilot/repo/tree', { owner, repo, branch });
  return response.data;
};
