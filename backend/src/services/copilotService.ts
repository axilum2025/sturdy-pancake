import OpenAI from 'openai';
import { Octokit } from '@octokit/rest';

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

  constructor() {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.warn('⚠️  GITHUB_TOKEN not set – Copilot features will be unavailable');
    }

    // GitHub Copilot / GitHub Models use an OpenAI-compatible endpoint
    this.openai = new OpenAI({
      baseURL: process.env.COPILOT_API_URL || 'https://models.github.ai/inference',
      apiKey: githubToken || 'dummy',
    });

    this.octokit = new Octokit({ auth: githubToken });

    this.defaultModel = process.env.COPILOT_MODEL || 'openai/gpt-4.1';
  }

  // ----------------------------------------------------------
  // Build the GiLo AI system prompt
  // ----------------------------------------------------------
  private buildSystemPrompt(projectContext?: CopilotChatRequest['projectContext']): string {
    let system = `Tu es GiLo AI, un assistant de développement intelligent intégré dans AI Builder Hub.
Tu aides les utilisateurs à construire des applications web modernes.
Tu génères du code propre, accessible et responsive.
Tu utilises React, Tailwind CSS et Vite par défaut.
Réponds toujours en français sauf si l'utilisateur écrit dans une autre langue.
Quand tu génères du code, entoure-le de blocs \`\`\` avec le langage approprié.
Sois concis et direct dans tes réponses.`;

    if (projectContext) {
      system += `\n\nContexte du projet actuel:`;
      system += `\n- ID: ${projectContext.projectId}`;
      if (projectContext.techStack?.length) {
        system += `\n- Stack technique: ${projectContext.techStack.join(', ')}`;
      }
      if (projectContext.files?.length) {
        system += `\n- Fichiers existants: ${projectContext.files.join(', ')}`;
      }
    }

    return system;
  }

  // ----------------------------------------------------------
  // Non-streaming chat completion
  // ----------------------------------------------------------
  async chat(request: CopilotChatRequest): Promise<CopilotChatResponse> {
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
  // Streaming chat completion (returns an async generator)
  // ----------------------------------------------------------
  async *chatStream(
    request: CopilotChatRequest,
  ): AsyncGenerator<CopilotStreamChunk> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: this.buildSystemPrompt(request.projectContext) },
      ...request.messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
    ];

    try {
      const stream = await this.openai.chat.completions.create({
        model: request.model || this.defaultModel,
        messages,
        temperature: request.temperature ?? 0.4,
        max_tokens: request.maxTokens ?? 4096,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const finishReason = chunk.choices[0]?.finish_reason;

        if (delta?.content) {
          yield { type: 'content', content: delta.content };
        }

        if (finishReason) {
          yield { type: 'done', finishReason };
        }
      }
    } catch (error: any) {
      yield { type: 'error', error: error.message || 'Unknown Copilot error' };
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
