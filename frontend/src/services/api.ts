import axios from 'axios';

// In production, VITE_API_URL points to the Container Apps backend URL
// In dev, it's empty and requests go through the Vite proxy (localhost:3001)
function resolveApiBase(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;

  // Production fallback: if served from gilo.dev (SWA), route API to the backend
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('gilo.dev')) {
    return 'https://api.gilo.dev';
  }

  // Dev: empty string → Vite proxy handles /api
  return '';
}

export const API_BASE = resolveApiBase();

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Handle responses globally — extract server error messages + handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    // Replace Axios generic message with server error message when available
    const serverMessage = error.response?.data?.error;
    if (serverMessage) {
      error.message = serverMessage;
    }
    return Promise.reject(error);
  }
);

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
  if (response.data.token) {
    localStorage.setItem('authToken', response.data.token);
  }
  return response.data;
};

export const login = async (email: string, password: string): Promise<{ user: User; token: string }> => {
  const response = await api.post('/auth/login', { email, password });
  if (response.data.token) {
    localStorage.setItem('authToken', response.data.token);
  }
  return response.data;
};

export const logout = (): void => {
  localStorage.removeItem('authToken');
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

// ============ Agents ============

export interface AgentTool {
  id: string;
  name: string;
  type: 'mcp' | 'api' | 'function';
  description?: string;
  enabled: boolean;
}

export interface AgentConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  welcomeMessage?: string;
  tools: AgentTool[];
  knowledgeBase?: string[];
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  tier: 'free' | 'pro';
  config: AgentConfig;
  status: 'draft' | 'active' | 'deployed';
  slug?: string;
  endpoint?: string;
  totalConversations: number;
  totalMessages: number;
  createdAt: string;
  updatedAt: string;
}

export const listAgents = async (): Promise<{ agents: Agent[]; total: number }> => {
  const response = await api.get('/agents');
  return response.data;
};

export const getAgent = async (agentId: string): Promise<Agent> => {
  const response = await api.get(`/agents/${agentId}`);
  return response.data;
};

export const createAgent = async (name: string, description?: string): Promise<Agent> => {
  const response = await api.post('/agents', { name, description });
  return response.data;
};

export const updateAgent = async (agentId: string, data: Partial<Agent>): Promise<Agent> => {
  const response = await api.patch(`/agents/${agentId}`, data);
  return response.data;
};

export const updateAgentConfig = async (agentId: string, config: Partial<AgentConfig>): Promise<Agent> => {
  const response = await api.patch(`/agents/${agentId}/config`, config);
  return response.data;
};

export const deployAgent = async (agentId: string): Promise<{ message: string; agent: Agent; endpoint: string; subdomainUrl?: string; chatUrl?: string }> => {
  const response = await api.post(`/agents/${agentId}/deploy`);
  return response.data;
};

export const deleteAgent = async (agentId: string): Promise<void> => {
  await api.delete(`/agents/${agentId}`);
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/api/copilot/stream`, {
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

// ============ API Keys ============

export interface ApiKeyResponse {
  id: string;
  agentId: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  requestCount: number;
  createdAt: string;
  revoked: boolean;
}

export const createApiKey = async (agentId: string, name: string): Promise<{ key: string; apiKey: ApiKeyResponse }> => {
  const response = await api.post(`/agents/${agentId}/api-keys`, { name });
  return response.data;
};

export const listApiKeys = async (agentId: string): Promise<{ apiKeys: ApiKeyResponse[]; total: number }> => {
  const response = await api.get(`/agents/${agentId}/api-keys`);
  return response.data;
};

export const revokeApiKey = async (agentId: string, keyId: string): Promise<void> => {
  await api.delete(`/agents/${agentId}/api-keys/${keyId}`);
};

// ============ Webhooks ============

export interface WebhookResponse {
  id: string;
  agentId: string;
  url: string;
  events: string[];
  active: boolean;
  lastTriggeredAt: string | null;
  failureCount: number;
  createdAt: string;
}

export const createWebhook = async (agentId: string, url: string, events: string[]): Promise<{ webhook: WebhookResponse; secret: string }> => {
  const response = await api.post(`/agents/${agentId}/webhooks`, { url, events });
  return response.data;
};

export const listWebhooks = async (agentId: string): Promise<{ webhooks: WebhookResponse[]; total: number }> => {
  const response = await api.get(`/agents/${agentId}/webhooks`);
  return response.data;
};

export const updateWebhook = async (agentId: string, webhookId: string, data: Partial<{ url: string; events: string[]; active: boolean }>): Promise<{ webhook: WebhookResponse }> => {
  const response = await api.patch(`/agents/${agentId}/webhooks/${webhookId}`, data);
  return response.data;
};

export const deleteWebhook = async (agentId: string, webhookId: string): Promise<void> => {
  await api.delete(`/agents/${agentId}/webhooks/${webhookId}`);
};

// ============ Knowledge Base ============

export interface KnowledgeDocument {
  id: string;
  agentId: string;
  userId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  chunkCount: number;
  status: 'processing' | 'ready' | 'error';
  errorMessage: string | null;
  createdAt: string;
}

export interface KnowledgeSearchResult {
  chunkId: string;
  content: string;
  score: number;
  documentId: string;
  filename: string;
  metadata: { page?: number; section?: string; source?: string } | null;
}

export interface KnowledgeStats {
  documents: number;
  chunks: number;
  totalTokens: number;
}

export const uploadKnowledgeDocument = async (agentId: string, file: File): Promise<{ document: KnowledgeDocument }> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post(`/agents/${agentId}/knowledge`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const listKnowledgeDocuments = async (agentId: string): Promise<{ documents: KnowledgeDocument[]; total: number }> => {
  const response = await api.get(`/agents/${agentId}/knowledge`);
  return response.data;
};

export const getKnowledgeStats = async (agentId: string): Promise<KnowledgeStats> => {
  const response = await api.get(`/agents/${agentId}/knowledge/stats`);
  return response.data;
};

export const searchKnowledge = async (agentId: string, query: string, topK?: number): Promise<{ results: KnowledgeSearchResult[]; total: number }> => {
  const response = await api.post(`/agents/${agentId}/knowledge/search`, { query, topK });
  return response.data;
};

export const deleteKnowledgeDocument = async (agentId: string, docId: string): Promise<void> => {
  await api.delete(`/agents/${agentId}/knowledge/${docId}`);
};

export const scrapeKnowledgeUrl = async (agentId: string, url: string): Promise<{ document: KnowledgeDocument }> => {
  const response = await api.post(`/agents/${agentId}/knowledge/url`, { url });
  return response.data;
};

// ============ Tools & Marketplace ============

export interface CatalogueTool {
  id: string;
  name: string;
  type: 'builtin' | 'http' | 'mcp';
  description?: string;
  enabled: boolean;
  parameters?: Record<string, unknown>;
  config?: Record<string, unknown>;
  category: string;
  icon: string;
  premium: boolean;
}

export interface CatalogueCategory {
  name: string;
  count: number;
}

export const getToolCatalogue = async (category?: string): Promise<{
  tools: CatalogueTool[];
  categories: CatalogueCategory[];
  total: number;
}> => {
  const params = category ? `?category=${category}` : '';
  const response = await api.get(`/tools/catalogue${params}`);
  return response.data;
};

export const addToolToAgent = async (
  agentId: string,
  tool: Record<string, unknown>
): Promise<{ tool: Record<string, unknown>; agent: Agent }> => {
  const response = await api.post(`/agents/${agentId}/tools`, tool);
  return response.data;
};

export const addBuiltinTool = async (
  agentId: string,
  toolId: string
): Promise<{ tool: Record<string, unknown>; agent: Agent }> => {
  const response = await api.post(`/agents/${agentId}/tools/add-builtin`, { toolId });
  return response.data;
};

export const removeToolFromAgent = async (agentId: string, toolId: string): Promise<void> => {
  await api.delete(`/agents/${agentId}/tools/${toolId}`);
};

export const updateAgentTool = async (
  agentId: string,
  toolId: string,
  updates: Record<string, unknown>
): Promise<{ tool: Record<string, unknown>; agent: Agent }> => {
  const response = await api.patch(`/agents/${agentId}/tools/${toolId}`, updates);
  return response.data;
};

export const importOpenAPISpec = async (
  agentId: string,
  spec: Record<string, unknown>
): Promise<{
  message: string;
  imported: Array<{ id: string; name: string; description: string }>;
  agent: Agent;
}> => {
  const response = await api.post(`/agents/${agentId}/tools/import-openapi`, { spec });
  return response.data;
};

export const testHttpAction = async (
  config: { url: string; method: string; headers?: Record<string, string>; bodyTemplate?: string; auth?: Record<string, unknown> },
  args: Record<string, unknown>
): Promise<{
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
}> => {
  const response = await api.post('/tools/test-http', { config, args });
  return response.data;
};

// ============ Analytics ============

export interface DailyMetric {
  date: string;
  conversations: number;
  messages: number;
  tokensUsed: number;
  toolCalls: number;
  errorCount: number;
  avgResponseMs: number;
  estimatedCost: number;
}

export interface AnalyticsSummary {
  totalConversations: number;
  totalMessages: number;
  totalTokens: number;
  totalToolCalls: number;
  totalErrors: number;
  avgResponseMs: number;
  estimatedCost: number;
  dailyMetrics: DailyMetric[];
  startDate: string;
  endDate: string;
}

export interface UserAnalytics extends AnalyticsSummary {
  agentBreakdown: Array<{
    agentId: string;
    agentName: string;
    messages: number;
    tokens: number;
    cost: number;
  }>;
}

export interface LogEntry {
  id: string;
  agentId: string;
  level: string;
  event: string;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export const getGlobalAnalytics = async (startDate?: string, endDate?: string): Promise<UserAnalytics> => {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const response = await api.get(`/analytics?${params}`);
  return response.data;
};

export const getAgentAnalytics = async (agentId: string, startDate?: string, endDate?: string): Promise<AnalyticsSummary & { agentId: string; agentName: string }> => {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const response = await api.get(`/agents/${agentId}/analytics?${params}`);
  return response.data;
};

export const getAgentLogs = async (
  agentId: string,
  options?: { level?: string; event?: string; startDate?: string; endDate?: string; limit?: number; offset?: number }
): Promise<{ logs: LogEntry[]; total: number }> => {
  const params = new URLSearchParams();
  if (options?.level) params.set('level', options.level);
  if (options?.event) params.set('event', options.event);
  if (options?.startDate) params.set('startDate', options.startDate);
  if (options?.endDate) params.set('endDate', options.endDate);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  const response = await api.get(`/agents/${agentId}/logs?${params}`);
  return response.data;
};

export const exportAgentLogs = async (agentId: string, options?: { level?: string; startDate?: string; endDate?: string }): Promise<Blob> => {
  const params = new URLSearchParams();
  if (options?.level) params.set('level', options.level);
  if (options?.startDate) params.set('startDate', options.startDate);
  if (options?.endDate) params.set('endDate', options.endDate);
  const response = await api.get(`/agents/${agentId}/logs/export?${params}`, { responseType: 'blob' });
  return response.data;
};

// ============ Community Tools ============

export interface CommunityTool {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  icon: string;
  creatorName: string;
  installCount: number;
  rating: number;
  ratingCount: number;
  definition: Record<string, unknown>;
  publishedAt: string;
}

export const getCommunityTools = async (category?: string, search?: string): Promise<{ tools: CommunityTool[]; total: number }> => {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (search) params.set('search', search);
  const response = await api.get(`/tools/community?${params}`);
  return response.data;
};

export const publishTool = async (data: {
  name: string;
  description: string;
  category?: string;
  tags?: string[];
  icon?: string;
  creatorName?: string;
  definition: Record<string, unknown>;
}): Promise<{ tool: CommunityTool }> => {
  const response = await api.post('/tools/publish', data);
  return response.data;
};

export const installCommunityTool = async (toolId: string, agentId: string): Promise<{ tool: Record<string, unknown>; agent: Agent }> => {
  const response = await api.post(`/tools/community/${toolId}/install`, { agentId });
  return response.data;
};
