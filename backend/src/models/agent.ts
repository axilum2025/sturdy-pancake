import { randomUUID } from 'crypto';

// ============================================================
// GiLo AI – Agent Model
// Represents an AI agent created by users on the platform.
// ============================================================

export type AgentStatus = 'draft' | 'active' | 'deployed';
export type AgentTier = 'free' | 'pro';

export interface AgentTool {
  id: string;
  name: string;
  type: 'mcp' | 'api' | 'function';
  description?: string;
  config?: Record<string, unknown>;
  enabled: boolean;
}

export interface AgentConfig {
  model: string;               // e.g. "openai/gpt-4.1", "openai/gpt-4.1-nano"
  temperature: number;         // 0.0 - 1.0
  maxTokens: number;           // max response tokens
  topP?: number;               // nucleus sampling
  systemPrompt: string;        // the agent's system instructions
  welcomeMessage?: string;     // first message shown to users
  tools: AgentTool[];          // connected tools/integrations
  knowledgeBase?: string[];    // file paths or URLs for RAG
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  description?: string;
  tier: AgentTier;
  config: AgentConfig;
  status: AgentStatus;
  
  // Deployment info
  endpoint?: string;           // e.g. /api/agents/{id}/chat
  deployedAt?: Date;
  
  // Stats
  totalConversations: number;
  totalMessages: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentCreateDTO {
  name: string;
  description?: string;
  config?: Partial<AgentConfig>;
}

export interface AgentResponse {
  id: string;
  name: string;
  description?: string;
  tier: AgentTier;
  config: AgentConfig;
  status: AgentStatus;
  endpoint?: string;
  totalConversations: number;
  totalMessages: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Default agent configuration
// ============================================================

const DEFAULT_CONFIG: AgentConfig = {
  model: 'openai/gpt-4.1',
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: 'Tu es un assistant IA utile et concis. Réponds toujours de manière professionnelle.',
  welcomeMessage: 'Bonjour ! Comment puis-je vous aider ?',
  tools: [],
};

// ============================================================
// Agent Model (in-memory store)
// ============================================================

export class AgentModel {
  private agents: Map<string, Agent>;
  private userAgents: Map<string, Set<string>>; // userId → Agent IDs

  constructor() {
    this.agents = new Map();
    this.userAgents = new Map();
    this.initializeSampleAgent();
  }

  private initializeSampleAgent(): void {
    const sample: Agent = {
      id: 'sample-agent-id',
      userId: 'demo-user-id',
      name: 'Agent Support Client',
      description: 'Un agent de support qui répond aux questions fréquentes et aide les utilisateurs.',
      tier: 'free',
      config: {
        model: 'openai/gpt-4.1',
        temperature: 0.5,
        maxTokens: 2048,
        systemPrompt: `Tu es un agent de support client professionnel pour une entreprise SaaS.
Tu réponds aux questions fréquentes, tu guides les utilisateurs et tu escalades vers un humain quand nécessaire.
Sois toujours poli, concis et utile.
Si tu ne connais pas la réponse, dis-le honnêtement et propose d'escalader.`,
        welcomeMessage: 'Bonjour ! Je suis votre assistant support. Comment puis-je vous aider aujourd\'hui ?',
        tools: [
          {
            id: 'tool-faq',
            name: 'FAQ Lookup',
            type: 'function',
            description: 'Rechercher dans la base de connaissances FAQ',
            enabled: true,
          },
          {
            id: 'tool-ticket',
            name: 'Create Ticket',
            type: 'api',
            description: 'Créer un ticket de support pour escalade humaine',
            enabled: true,
          },
        ],
      },
      status: 'active',
      endpoint: '/api/agents/sample-agent-id/chat',
      totalConversations: 42,
      totalMessages: 318,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.agents.set(sample.id, sample);
    if (!this.userAgents.has(sample.userId)) {
      this.userAgents.set(sample.userId, new Set());
    }
    this.userAgents.get(sample.userId)!.add(sample.id);
  }

  async create(userId: string, data: AgentCreateDTO, userTier: AgentTier): Promise<Agent> {
    const userAgentIds = this.userAgents.get(userId) || new Set();
    const maxAgents = userTier === 'pro' ? 20 : 5;

    if (userAgentIds.size >= maxAgents) {
      throw new Error(`Agent limit reached. Maximum ${maxAgents} agents for ${userTier} tier.`);
    }

    const agent: Agent = {
      id: randomUUID(),
      userId,
      name: data.name,
      description: data.description,
      tier: userTier,
      config: {
        ...DEFAULT_CONFIG,
        ...data.config,
        tools: data.config?.tools || [],
      },
      status: 'draft',
      totalConversations: 0,
      totalMessages: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.agents.set(agent.id, agent);

    if (!this.userAgents.has(userId)) {
      this.userAgents.set(userId, new Set());
    }
    this.userAgents.get(userId)!.add(agent.id);

    return agent;
  }

  async findById(id: string): Promise<Agent | undefined> {
    return this.agents.get(id);
  }

  async findByUserId(userId: string): Promise<Agent[]> {
    const agentIds = this.userAgents.get(userId) || new Set();
    return Array.from(agentIds)
      .map((id) => this.agents.get(id))
      .filter((a): a is Agent => a !== undefined);
  }

  async update(id: string, data: Partial<Agent>): Promise<Agent> {
    const agent = this.agents.get(id);
    if (!agent) throw new Error('Agent not found');
    const updated = { ...agent, ...data, updatedAt: new Date() };
    this.agents.set(id, updated);
    return updated;
  }

  async updateConfig(id: string, config: Partial<AgentConfig>): Promise<Agent> {
    const agent = this.agents.get(id);
    if (!agent) throw new Error('Agent not found');
    agent.config = { ...agent.config, ...config };
    agent.updatedAt = new Date();
    this.agents.set(id, agent);
    return agent;
  }

  async delete(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (!agent) throw new Error('Agent not found');
    this.agents.delete(id);
    this.userAgents.get(agent.userId)?.delete(id);
  }

  async deploy(id: string): Promise<Agent> {
    const agent = this.agents.get(id);
    if (!agent) throw new Error('Agent not found');
    agent.status = 'deployed';
    agent.endpoint = `/api/agents/${id}/chat`;
    agent.deployedAt = new Date();
    agent.updatedAt = new Date();
    this.agents.set(id, agent);
    return agent;
  }

  toResponse(agent: Agent): AgentResponse {
    return {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      tier: agent.tier,
      config: agent.config,
      status: agent.status,
      endpoint: agent.endpoint,
      totalConversations: agent.totalConversations,
      totalMessages: agent.totalMessages,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
    };
  }
}

export const agentModel = new AgentModel();
