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
  /** Detected UI language from the frontend (i18n) */
  uiLanguage?: string;
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
  getClientInfo(projectContext?: CopilotChatRequest['projectContext'], agentConfig?: import('../models/agent').AgentConfig, uiLanguage?: string, messages?: CopilotMessage[], enrichedContext?: Record<string, any>): {
    client: OpenAI;
    systemPrompt: string;
    defaultModel: string;
  } {
    this.ensureInit();
    return {
      client: this.openai,
      systemPrompt: this.buildSystemPrompt(projectContext, agentConfig, uiLanguage, messages, enrichedContext),
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
  // Detect user language from messages
  // ----------------------------------------------------------
  private detectLanguage(messages: CopilotMessage[], uiLanguage?: string): string {
    // Priority 1: explicit UI language from frontend
    if (uiLanguage && ['fr', 'en', 'es', 'de', 'pt', 'it', 'ar', 'zh', 'ja', 'ko'].includes(uiLanguage)) {
      return uiLanguage;
    }
    // Priority 2: detect from last user message
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg?.content) {
      const text = lastUserMsg.content.toLowerCase();
      // Simple heuristic patterns for language detection
      const patterns: Record<string, RegExp[]> = {
        fr: [/\b(bonjour|salut|merci|comment|je|nous|vous|pour|avec|dans|les|des|est|une|mon|que|créer|ajouter|configurer|outils)\b/i],
        en: [/\b(hello|hi|thanks|please|how|the|and|for|with|create|add|configure|tools|help|want|need|build)\b/i],
        es: [/\b(hola|gracias|por favor|cómo|crear|añadir|configurar|herramientas|ayuda|quiero|necesito)\b/i],
        de: [/\b(hallo|danke|bitte|wie|erstellen|hinzufügen|konfigurieren|werkzeuge|hilfe|möchte|brauche)\b/i],
        pt: [/\b(olá|obrigado|por favor|como|criar|adicionar|configurar|ferramentas|ajuda|quero|preciso)\b/i],
        it: [/\b(ciao|grazie|per favore|come|creare|aggiungere|configurare|strumenti|aiuto|voglio|ho bisogno)\b/i],
        ar: [/[\u0600-\u06FF]/],
        zh: [/[\u4e00-\u9fff]/],
        ja: [/[\u3040-\u30ff\u31f0-\u31ff]/],
        ko: [/[\uac00-\ud7af]/],
      };
      for (const [lang, regexes] of Object.entries(patterns)) {
        if (regexes.some(r => r.test(text))) return lang;
      }
    }
    return 'fr'; // default
  }

  // ----------------------------------------------------------
  // Build the GiLo AI system prompt
  // ----------------------------------------------------------
  private buildSystemPrompt(projectContext?: CopilotChatRequest['projectContext'], agentConfig?: import('../models/agent').AgentConfig, uiLanguage?: string, messages?: CopilotMessage[], enrichedContext?: Record<string, any>): string {
    const detectedLang = this.detectLanguage(messages || [], uiLanguage);

    const langInstructions: Record<string, string> = {
      fr: 'Réponds TOUJOURS en français.',
      en: 'ALWAYS respond in English.',
      es: 'Responde SIEMPRE en español.',
      de: 'Antworte IMMER auf Deutsch.',
      pt: 'Responda SEMPRE em português.',
      it: 'Rispondi SEMPRE in italiano.',
      ar: 'أجب دائماً باللغة العربية.',
      zh: '始终用中文回答。',
      ja: '常に日本語で回答してください。',
      ko: '항상 한국어로 답변하세요.',
    };

    const langInstruction = langInstructions[detectedLang] || langInstructions['fr'];

    let system = `Tu es GiLo AI, un assistant expert Full-Stack End-to-End Agent Builder, intégré dans la plateforme GiLo AI.
${langInstruction}
Détecte automatiquement la langue de l'utilisateur à partir de ses messages et réponds dans CETTE MÊME langue.

=== CAPACITÉS FULL-STACK END-TO-END ===
Tu es capable de guider l'utilisateur à travers TOUTE la chaîne de création d'un agent IA :

1. **Conception** : Définir le rôle, la personnalité, le ton et le public cible
2. **Configuration du modèle** : Choix du LLM (GPT-4.1-nano, GPT-4.1-mini, BYO LLM), température, max tokens
3. **System Prompt** : Génération d'un prompt optimisé et structuré (100-300 mots)
4. **Outils & Intégrations** : Configuration d'outils builtin, HTTP actions, MCP servers
5. **Base de connaissances** : Conseils pour l'upload de documents, scraping d'URLs
6. **API & Endpoints** : Génération de tableaux pour configurer les endpoints et clés API
7. **Sécurité** : Gestion sécurisée des credentials (chiffrement AES-256-GCM)
8. **Déploiement** : Widget embed, API REST, sous-domaine personnalisé
9. **Monitoring** : Analytics, logs, alertes
10. **Publication** : Publication dans le Store GiLo

=== GÉNÉRATION DE TABLEAUX API/ENDPOINTS ===
Quand l'utilisateur veut configurer des endpoints ou des clés API, génère un tableau Markdown structuré :

| Nom | Type | Endpoint/URL | Méthode | Auth Type | Clé API | Statut |
|-----|------|-------------|---------|-----------|---------|--------|
| Mon API | REST | https://api.example.com/v1 | POST | Bearer | ●●●●●●●● | ✅ Actif |

Puis propose d'appliquer cette configuration automatiquement via le bloc <!--GILO_APPLY_CONFIG:...-->.

Quand tu génères du code ou des configurations, entoure-les de blocs \`\`\` avec le langage approprié.
Sois concis et direct dans tes réponses.
Les clés API et secrets doivent TOUJOURS être masqués dans les réponses visibles (utilise ●●●●● ou ***).`;

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
3. Quand tu as assez d'informations, applique la configuration automatiquement.

QUAND TU GÉNÈRES LA CONFIGURATION :
- Tu DOIS inclure un bloc caché dans ta réponse, TOUT À LA FIN du message :
<!--GILO_APPLY_CONFIG:{"systemPrompt":"...", "temperature": 0.7, "maxTokens": 2048, "welcomeMessage": "...", "tools": [...]}-->
- Ce bloc est INVISIBLE pour l'utilisateur et sera automatiquement détecté et appliqué.

⚠️ RÈGLE ABSOLUE : Ne JAMAIS afficher le JSON de configuration dans ta réponse visible.
Ne montre JAMAIS le contenu brut du bloc GILO_APPLY_CONFIG à l'utilisateur.
Ne mets JAMAIS de bloc de code JSON contenant systemPrompt, temperature, tools, etc.
Décris simplement en langage naturel ce que tu as configuré (ex: "J'ai configuré votre agent avec un ton professionnel, en anglais...").
Le bloc <!--GILO_APPLY_CONFIG:...--> doit être le DERNIER élément de ta réponse, après tout le texte visible.

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
- DANS LA LANGUE détectée de l'utilisateur

RÈGLES pour le welcomeMessage :
- Court (1-2 phrases), accueillant, en rapport avec le rôle de l'agent
- DANS LA LANGUE détectée de l'utilisateur

=== AJOUT D'OUTILS VIA CONVERSATION ===
Quand l'utilisateur demande d'ajouter des outils ou des API :
1. Demande quels outils spécifiques il veut (type, URL, auth)
2. Génère un TABLEAU récapitulatif en Markdown :

| # | Nom de l'outil | Type | Endpoint | Méthode | Auth | Description |
|---|---------------|------|----------|---------|------|-------------|
| 1 | get_weather | HTTP | https://api.weather.com/v1 | GET | API Key | Météo en temps réel |
| 2 | send_notification | HTTP | https://api.notify.io/send | POST | Bearer | Envoi de notifications |

3. Demande confirmation à l'utilisateur
4. Applique via <!--GILO_APPLY_CONFIG:{"tools":[...]}-->

=== CONFIGURATION DE CREDENTIALS (SÉCURISÉ) ===
Quand l'utilisateur veut configurer ses clés API ou secrets :
1. Génère un tableau pour qu'il sache quelles infos fournir :

| Service | Champ | Valeur | Sécurisé |
|---------|-------|--------|----------|
| OpenAI | API Key | sk-●●●●●●●●●● | 🔒 Chiffré AES-256 |
| Stripe | Secret Key | sk_●●●●●●●●●● | 🔒 Chiffré AES-256 |

2. Explique que les credentials sont stockés avec chiffrement AES-256-GCM
3. JAMAIS afficher les clés en clair — toujours masquer avec ●●●●● ou ***
4. Utilise <!--GILO_SAVE_CREDENTIALS:{"credentials":[{"service":"...","key":"...","value":"MASKED"}]}--> pour signaler la sauvegarde

FORMAT DE RÉPONSE quand tu appliques la config :
1. D'abord, un résumé en langage naturel : "✅ J'ai configuré votre agent ! Voici ce que j'ai mis en place :"
2. Liste à puces des choix faits (rôle, ton, langue, outils activés) — en texte simple, PAS de JSON
3. Si des outils/API sont configurés, un TABLEAU récapitulatif
4. Ensuite, propose les prochaines étapes :
   - Tester dans le Playground (icône 👁️)
   - Ajuster la configuration (icône ⚙️)
   - Ajouter des outils/API (icône 🔧)
   - Configurer la base de connaissances (icône 📚)
   - Déployer (icône 🚀)
5. TOUT À LA FIN, le bloc caché <!--GILO_APPLY_CONFIG:...-->

EXEMPLE DE BONNE RÉPONSE :
"✅ Votre agent est configuré ! Voici ce que j'ai mis en place :\n- **Rôle** : Assistant support client\n- **Ton** : Professionnel\n- **Langue** : Anglais\n- **Outils** : Heure actuelle, Calculatrice\n- **Message d'accueil** : Hello! How can I help you today?\n\nVous pouvez maintenant le tester dans le Playground 👁️"
(suivi du bloc <!--GILO_APPLY_CONFIG:...--> invisible)

EXEMPLE DE MAUVAISE RÉPONSE (À NE JAMAIS FAIRE) :
Afficher un bloc de code JSON avec systemPrompt, temperature, tools, etc.

=== FIN MODE CRÉATION GUIDÉE ===`;
    } else if (agentConfig) {
      system += `\n\nConfiguration actuelle de l'agent:`;
      system += `\n- Modèle: ${agentConfig.model}`;
      system += `\n- Température: ${agentConfig.temperature}`;
      system += `\n- System Prompt: ${agentConfig.systemPrompt?.substring(0, 200)}...`;
      system += `\n- Outils activés: ${agentConfig.tools?.filter(t => t.enabled).map(t => `${t.name} (${t.type})`).join(', ') || 'aucun'}`;
      system += `\n- Outils désactivés: ${agentConfig.tools?.filter(t => !t.enabled).map(t => t.name).join(', ') || 'aucun'}`;

      // Enriched context
      if (enrichedContext) {
        if (enrichedContext.agentMeta) {
          const meta = enrichedContext.agentMeta;
          system += `\n- Nom de l'agent: ${meta.name || 'Non défini'}`;
          system += `\n- Statut: ${meta.status || 'draft'}`;
          system += `\n- Conversations totales: ${meta.totalConversations || 0}`;
          system += `\n- Messages totaux: ${meta.totalMessages || 0}`;
          if (meta.deployedAt) system += `\n- Déployé le: ${new Date(meta.deployedAt).toLocaleDateString()}`;
        }
        if (enrichedContext.knowledgeStats) {
          const kb = enrichedContext.knowledgeStats;
          system += `\n- Base de connaissances: ${kb.documents} documents, ${kb.chunks} chunks, ${kb.totalTokens} tokens`;
        } else {
          system += `\n- Base de connaissances: vide (aucun document)`;
        }
        if (enrichedContext.credentialsCount !== undefined) {
          system += `\n- Credentials stockés: ${enrichedContext.credentialsCount}`;
        }
        if (enrichedContext.configScore !== undefined) {
          system += `\n- Score de complétion config: ${enrichedContext.configScore}%`;
        }
      }

      system += `\n\n=== COMMANDES SLASH ===
L'utilisateur peut utiliser des commandes slash. Si tu détectes une commande slash dans le message, exécute-la :

/review — Analyse la configuration actuelle de l'agent et suggère des améliorations concrètes.
  Examine : system prompt (qualité, longueur, structure), outils configurés, température, modèle, base de connaissances.
  Donne un score de qualité /10 et des suggestions prioritaires.

/optimize — Réécris et optimise le system prompt actuel pour de meilleures performances.
  Garde le même rôle mais améliore la structure, les instructions et la clarté.
  Applique automatiquement via <!--GILO_APPLY_CONFIG:...-->

/suggest-tools — Analyse le rôle de l'agent et suggère des outils pertinents à ajouter.
  Présente dans un TABLEAU avec nom, type, description et utilité.

/status — Affiche un résumé complet de l'état de l'agent :
  Config, outils, base de connaissances, déploiement, analytics.
  Montre un score de complétion et les prochaines étapes recommandées.

/help — Liste toutes les commandes disponibles avec leurs descriptions.

=== PROACTIVITÉ ===
Après chaque modification de config appliquée, suggère TOUJOURS les prochaines étapes pertinentes.
Analyse le score de complétion et recommande les actions manquantes.
Si l'agent n'a pas de base de connaissances, suggère d'en ajouter une.
Si l'agent n'a pas d'outils, suggère les plus pertinents pour son rôle.
Si l'agent n'est pas déployé, rappelle de le déployer quand il est prêt.

=== MODIFICATIONS DE CONFIG ===
Si l'utilisateur demande des modifications, tu peux :
1. Modifier les paramètres (modèle, température, prompt, outils)
2. Ajouter/supprimer des outils avec un TABLEAU récapitulatif
3. Configurer des endpoints API avec un TABLEAU structuré :

| Outil | Type | URL | Méthode | Auth |
|-------|------|-----|---------|------|
| ... | HTTP | ... | POST | Bearer |

4. Génère le bloc caché pour appliquer :
<!--GILO_APPLY_CONFIG:{"systemPrompt":"...", "tools":[...], ...}-->

=== CREDENTIALS SÉCURISÉS ===
Si l'utilisateur veut sauvegarder des clés API :
- Génère un tableau montrant les champs nécessaires
- Signale que le stockage est chiffré AES-256-GCM
- NE JAMAIS afficher les clés en clair
- Utilise <!--GILO_SAVE_CREDENTIALS:{"credentials":[...]}-->`;
    }

    return system;
  }

  // ----------------------------------------------------------
  // Non-streaming chat completion
  // ----------------------------------------------------------
  async chat(request: CopilotChatRequest): Promise<CopilotChatResponse> {
    this.ensureInit();

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: this.buildSystemPrompt(request.projectContext, undefined, request.uiLanguage, request.messages) },
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
      { role: 'system', content: this.buildSystemPrompt(request.projectContext, undefined, request.uiLanguage, request.messages) },
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
