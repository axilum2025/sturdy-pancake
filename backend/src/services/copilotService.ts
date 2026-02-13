import OpenAI from 'openai';
import { Octokit } from '@octokit/rest';
import type { AgentConfig } from '../models/agent';

// ============================================================
// GiLo AI – GitHub Copilot Integration Service
// Uses the official GitHub Models endpoint (compatible OpenAI SDK)
// and the Octokit REST SDK for repository operations.
// ============================================================

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
  /** Optional project context injected as system prompt */
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

export interface CopilotStreamChunk {
  type: 'content' | 'done' | 'error';
  content?: string;
  finishReason?: string;
  error?: string;
}

// ============================================================
// Copilot Service
// ============================================================

export class CopilotService {
  private openai: OpenAI;
  private octokit: Octokit;
  private defaultModel: string;

  private initialized = false;

  constructor() {
    // Defer actual init – env vars may not be loaded yet at import time
    this.openai = null as any;
    this.octokit = null as any;
    this.defaultModel = 'openai/gpt-4.1-nano';
  }

  /** Lazy-initialize clients so env vars from dotenv are available */
  private ensureInit() {
    if (this.initialized) return;
    this.initialized = true;

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.warn('⚠️  GITHUB_TOKEN not set – Copilot features will be unavailable');
    }

    this.openai = new OpenAI({
      baseURL: process.env.COPILOT_API_URL || 'https://models.github.ai/inference',
      apiKey: githubToken || 'dummy',
    });

    this.octokit = new Octokit({ auth: githubToken });
    this.defaultModel = process.env.COPILOT_MODEL || 'openai/gpt-4.1-nano';
  }

  // ----------------------------------------------------------
  // Expose client info for direct route usage
  // ----------------------------------------------------------
  getClientInfo(projectContext?: CopilotChatRequest['projectContext'], agentConfig?: import('../models/agent').AgentConfig): {
    client: OpenAI;
    systemPrompt: string;
    defaultModel: string;
  } {
    this.ensureInit();
    return {
      client: this.openai,
      systemPrompt: this.buildSystemPrompt(projectContext, agentConfig),
      defaultModel: this.defaultModel,
    };
  }

  // ----------------------------------------------------------
  // Get an OpenAI client for a specific agent.
  // If the agent has BYO LLM configured, creates a new client
  // with the user's key & URL.  Otherwise returns our default.
  // ----------------------------------------------------------
  getClientForAgent(agentConfig: AgentConfig): {
    client: OpenAI;
    model: string;
    isByo: boolean;
  } {
    if (agentConfig.customLlmKey?.trim()) {
      const client = new OpenAI({
        apiKey: agentConfig.customLlmKey.trim(),
        baseURL: agentConfig.customLlmUrl?.trim() || 'https://api.openai.com/v1',
      });
      return {
        client,
        model: agentConfig.customLlmModel?.trim() || 'gpt-4o-mini',
        isByo: true,
      };
    }

    this.ensureInit();
    return {
      client: this.openai,
      model: agentConfig.model || this.defaultModel,
      isByo: false,
    };
  }

  // ----------------------------------------------------------
  // Build the GiLo AI system prompt
  // ----------------------------------------------------------
  private buildSystemPrompt(projectContext?: CopilotChatRequest['projectContext'], agentConfig?: import('../models/agent').AgentConfig): string {
    let system = `Tu es GiLo AI, un assistant expert en création d'agents IA, intégré dans la plateforme GiLo AI Agent Builder.
Tu aides les utilisateurs à concevoir, configurer et déployer des agents IA conversationnels.
Quand un utilisateur décrit un agent, tu génères :
1. Un system prompt optimisé pour l'agent
2. La liste des outils/intégrations recommandés (MCP servers)
3. Les paramètres de configuration (modèle, température, max tokens)
4. Des exemples de conversations pour tester l'agent
Réponds toujours en français sauf si l'utilisateur écrit dans une autre langue.
Quand tu génères du code ou des configurations, entoure-les de blocs \`\`\` avec le langage approprié.
Sois concis et direct dans tes réponses.
Utilise le format JSON pour les configurations d'agent.`;

    if (projectContext) {
      system += `\n\nContexte de l'agent en cours de création:`;
      system += `\n- ID: ${projectContext.projectId}`;
      if (projectContext.techStack?.length) {
        system += `\n- Outils connectés: ${projectContext.techStack.join(', ')}`;
      }
      if (projectContext.files?.length) {
        system += `\n- Fichiers de configuration: ${projectContext.files.join(', ')}`;
      }
    }

    // Check if the agent is new/unconfigured and enable guided creation mode
    const isNewAgent = agentConfig && (
      agentConfig.systemPrompt === 'Tu es un assistant IA utile et concis. Réponds toujours de manière professionnelle.' ||
      !agentConfig.systemPrompt?.trim()
    );

    if (isNewAgent) {
      system += `

=== MODE CRÉATION GUIDÉE ===
L'utilisateur vient de créer un nouvel agent qui n'est pas encore configuré.
Tu dois le guider de manière conversationnelle pour configurer son agent.

COMPORTEMENT :
1. Commence par accueillir l'utilisateur et lui demander de décrire à quoi servira son agent (quel rôle, quel public cible, quel ton).
2. Pose des questions de suivi si nécessaire (2-3 questions max, pas plus).
3. Quand tu as assez d'informations, génère la configuration complète et applique-la.

QUAND TU GÉNÈRES LA CONFIGURATION, tu DOIS inclure un bloc spécial dans ta réponse :
<!--GILO_APPLY_CONFIG:{"systemPrompt":"...", "temperature": 0.7, "maxTokens": 2048, "welcomeMessage": "...", "tools": [...]}-->

Ce bloc sera automatiquement détecté et appliqué à l'agent. L'utilisateur verra que la config a été appliquée.

OUTILS DISPONIBLES (inclure seulement les pertinents) :
- {"id":"builtin_get_current_time","name":"get_current_time","type":"builtin","enabled":true,"config":{"builtinId":"get_current_time"}} — heure actuelle
- {"id":"builtin_calculator","name":"calculator","type":"builtin","enabled":true,"config":{"builtinId":"calculator"}} — calculs math
- {"id":"builtin_http_get","name":"http_get","type":"builtin","enabled":true,"config":{"builtinId":"http_get"}} — requêtes HTTP GET
- {"id":"builtin_http_post","name":"http_post","type":"builtin","enabled":true,"config":{"builtinId":"http_post"}} — requêtes HTTP POST
- {"id":"builtin_json_extract","name":"json_extract","type":"builtin","enabled":true,"config":{"builtinId":"json_extract"}} — extraction JSON
- {"id":"builtin_send_email","name":"send_email","type":"builtin","enabled":true,"config":{"builtinId":"send_email"}} — envoi d'emails
- {"id":"builtin_webhook_trigger","name":"webhook_trigger","type":"builtin","enabled":true,"config":{"builtinId":"webhook_trigger"}} — déclenchement webhooks

RÈGLES pour le systemPrompt généré :
- 100 à 300 mots, avec des instructions numérotées
- Adapté au ton et au contexte décrits par l'utilisateur
- En français sauf si l'utilisateur écrit en anglais

RÈGLES pour le welcomeMessage :
- Court (1-2 phrases), accueillant, en rapport avec le rôle de l'agent

Après avoir appliqué la config, dis à l'utilisateur que son agent est configuré et qu'il peut :
- Tester dans le Playground (icône 👁️ dans la barre latérale)
- Ajuster la configuration (icône ⚙️)
- Déployer (icône 🚀)
=== FIN MODE CRÉATION GUIDÉE ===`;
    } else if (agentConfig) {
      system += `\n\nConfiguration actuelle de l'agent:`;
      system += `\n- Modèle: ${agentConfig.model}`;
      system += `\n- Température: ${agentConfig.temperature}`;
      system += `\n- System Prompt: ${agentConfig.systemPrompt?.substring(0, 200)}...`;
      system += `\n- Outils: ${agentConfig.tools?.map(t => t.name).join(', ') || 'aucun'}`;
      system += `\n\nSi l'utilisateur demande des modifications de config, tu peux générer un bloc:
<!--GILO_APPLY_CONFIG:{"systemPrompt":"...", ...}-->
pour appliquer automatiquement les changements.`;
    }

    return system;
  }

  // ----------------------------------------------------------
  // Non-streaming chat completion
  // ----------------------------------------------------------
  async chat(request: CopilotChatRequest): Promise<CopilotChatResponse> {
    this.ensureInit();

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: this.buildSystemPrompt(request.projectContext) },
      ...request.messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const completion = await this.openai.chat.completions.create({
      model: request.model || this.defaultModel,
      messages,
      temperature: request.temperature ?? 0.4,
      max_tokens: request.maxTokens ?? 4096,
    });

    const choice = completion.choices[0];

    return {
      id: completion.id,
      content: choice.message?.content || '',
      model: completion.model,
      usage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined,
      finishReason: choice.finish_reason || 'stop',
    };
  }

  // ----------------------------------------------------------
  // Streaming chat completion (callback-based for Express compatibility)
  // ----------------------------------------------------------
  async chatStream(
    request: CopilotChatRequest,
    onChunk: (chunk: CopilotStreamChunk) => void,
  ): Promise<void> {
    this.ensureInit();

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: this.buildSystemPrompt(request.projectContext) },
      ...request.messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
    ];

    console.log('[chatStream] Starting with model:', this.defaultModel, 'messages:', messages.length);

    try {
      const stream = await this.openai.chat.completions.create({
        model: request.model || this.defaultModel,
        messages,
        temperature: request.temperature ?? 0.4,
        max_tokens: request.maxTokens ?? 4096,
        stream: true,
      });

      console.log('[chatStream] OpenAI stream created, type:', typeof stream, 'Symbol.asyncIterator:', Symbol.asyncIterator in Object(stream));

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta;
        const finishReason = chunk.choices?.[0]?.finish_reason;

        if (delta?.content) {
          console.log('[chatStream] content chunk:', delta.content.substring(0, 50));
          onChunk({ type: 'content' as const, content: delta.content });
        }

        if (finishReason) {
          console.log('[chatStream] finish:', finishReason);
          onChunk({ type: 'done' as const, finishReason });
        }
      }

      console.log('[chatStream] Stream complete');
    } catch (error: any) {
      console.error('[chatStream] ERROR:', error.message, error.stack?.substring(0, 300));
      onChunk({ type: 'error' as const, error: error.message || 'Unknown Copilot error' });
    }
  }

  // ----------------------------------------------------------
  // Code generation helper
  // ----------------------------------------------------------
  async generateCode(params: {
    prompt: string;
    language?: string;
    projectContext?: CopilotChatRequest['projectContext'];
  }): Promise<string> {
    const codePrompt = params.language
      ? `Génère du code ${params.language} pour: ${params.prompt}`
      : `Génère le code pour: ${params.prompt}`;

    const response = await this.chat({
      messages: [{ role: 'user', content: codePrompt }],
      projectContext: params.projectContext,
      temperature: 0.2,
    });

    return response.content;
  }

  // ----------------------------------------------------------
  // Code review / explanation helper
  // ----------------------------------------------------------
  async reviewCode(params: {
    code: string;
    language?: string;
    action?: 'review' | 'explain' | 'refactor' | 'test';
  }): Promise<string> {
    const actions: Record<string, string> = {
      review: 'Fais une revue de code détaillée et suggère des améliorations',
      explain: 'Explique ce code de manière claire et détaillée',
      refactor: 'Refactorise ce code pour le rendre plus propre et performant',
      test: 'Génère des tests unitaires complets pour ce code',
    };

    const action = actions[params.action || 'review'];
    const lang = params.language ? ` (${params.language})` : '';

    const response = await this.chat({
      messages: [
        {
          role: 'user',
          content: `${action} pour le code suivant${lang}:\n\n\`\`\`\n${params.code}\n\`\`\``,
        },
      ],
      temperature: 0.3,
    });

    return response.content;
  }

  // ----------------------------------------------------------
  // GitHub repository helpers (via Octokit)
  // ----------------------------------------------------------
  async getRepoInfo(owner: string, repo: string) {
    this.ensureInit();
    const { data } = await this.octokit.repos.get({ owner, repo });
    return {
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      language: data.language,
      defaultBranch: data.default_branch,
      stars: data.stargazers_count,
      url: data.html_url,
    };
  }

  async getRepoTree(owner: string, repo: string, branch?: string) {
    this.ensureInit();
    const ref = branch || 'main';
    const { data } = await this.octokit.git.getTree({
      owner,
      repo,
      tree_sha: ref,
      recursive: 'true',
    });
    return data.tree
      .filter((item) => item.type === 'blob')
      .map((item) => item.path);
  }

  async getFileContent(owner: string, repo: string, path: string) {
    this.ensureInit();
    const { data } = await this.octokit.repos.getContent({ owner, repo, path });
    if ('content' in data) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return null;
  }

  // ----------------------------------------------------------
  // GitHub Copilot availability check
  // ----------------------------------------------------------
  async checkAvailability(): Promise<{
    available: boolean;
    model: string;
    error?: string;
  }> {
    try {
      this.ensureInit();
      const response = await this.chat({
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 10,
      });
      return { available: true, model: response.model };
    } catch (error: any) {
      return {
        available: false,
        model: this.defaultModel,
        error: error.message,
      };
    }
  }
}

// Singleton
export const copilotService = new CopilotService();
