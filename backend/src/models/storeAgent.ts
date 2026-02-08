import { randomUUID } from 'crypto';

// ============================================================
// GiLo AI – Store Agent Model
// Represents a published agent in the Agent Store.
// ============================================================

export type StoreVisibility = 'public' | 'private';
export type StoreCategory =
  | 'productivity'
  | 'support'
  | 'education'
  | 'creative'
  | 'dev-tools'
  | 'marketing'
  | 'data'
  | 'entertainment'
  | 'other';

export interface StoreAgentListing {
  id: string;                         // permanent store ID
  agentId: string;                    // reference to the builder Agent
  userId: string;                     // creator
  creatorName: string;                // display name

  // Presentation
  name: string;
  description: string;
  shortDescription: string;           // one-liner for the grid
  icon: string;                       // base64 or URL
  iconColor: string;                  // fallback gradient color
  features: string[];                 // list of key features
  category: StoreCategory;
  tags: string[];

  // Config snapshot (so the store agent is independent)
  configSnapshot: {
    model: string;
    systemPrompt: string;
    welcomeMessage: string;
    temperature: number;
    maxTokens: number;
    tools: { name: string; type: string }[];
  };

  // Visibility & Access
  visibility: StoreVisibility;
  accessToken?: string;               // for private agents
  accessPrice?: number;               // 0 = free, >0 = paid (in cents)

  // Stats
  usageCount: number;                 // number of conversations
  remixCount: number;
  rating: number;                     // 0-5
  ratingCount: number;

  // Remix
  remixedFrom?: string;               // store listing ID of the original

  // Version
  version: string;                    // semver

  // Timestamps
  publishedAt: Date;
  updatedAt: Date;
}

export interface PublishAgentDTO {
  agentId: string;
  name: string;
  description: string;
  shortDescription: string;
  icon?: string;
  iconColor?: string;
  features: string[];
  category: StoreCategory;
  tags?: string[];
  visibility: StoreVisibility;
  accessPrice?: number;
}

export interface StoreAgentCard {
  id: string;
  name: string;
  shortDescription: string;
  icon: string;
  iconColor: string;
  category: StoreCategory;
  visibility: StoreVisibility;
  rating: number;
  usageCount: number;
  creatorName: string;
}

// ============================================================
// Store Model (in-memory)
// ============================================================

export class StoreModel {
  private listings: Map<string, StoreAgentListing>;

  constructor() {
    this.listings = new Map();
    this.initializeSamples();
  }

  private initializeSamples(): void {
    const samples: Partial<StoreAgentListing>[] = [
      {
        name: 'Support Pro',
        shortDescription: 'Agent de support client intelligent',
        description: 'Un agent de support client professionnel qui répond aux questions fréquentes, guide les utilisateurs et escalade vers un humain quand nécessaire. Parfait pour les SaaS et les e-commerces.',
        icon: '',
        iconColor: '#3b82f6',
        features: ['Support 24/7', 'Escalation intelligente', 'FAQ automatique', 'Multi-langue'],
        category: 'support',
        tags: ['support', 'customer-service', 'faq'],
        visibility: 'public',
        usageCount: 1250,
        remixCount: 42,
        rating: 4.5,
        ratingCount: 89,
        configSnapshot: {
          model: 'openai/gpt-4.1',
          systemPrompt: 'Tu es un agent de support client professionnel.',
          welcomeMessage: 'Bonjour ! Comment puis-je vous aider ?',
          temperature: 0.5,
          maxTokens: 2048,
          tools: [{ name: 'FAQ Lookup', type: 'function' }],
        },
      },
      {
        name: 'Code Buddy',
        shortDescription: 'Assistant de développement et code review',
        description: 'Un assistant de développement qui aide au code review, debugging, et explique les concepts de programmation. Supporte JavaScript, TypeScript, Python, et plus.',
        icon: '',
        iconColor: '#8b5cf6',
        features: ['Code review', 'Debugging', 'Explications', 'Multi-langage'],
        category: 'dev-tools',
        tags: ['code', 'development', 'review', 'debug'],
        visibility: 'public',
        usageCount: 3420,
        remixCount: 156,
        rating: 4.8,
        ratingCount: 234,
        configSnapshot: {
          model: 'openai/gpt-4.1',
          systemPrompt: 'Tu es un expert en développement logiciel.',
          welcomeMessage: 'Hey ! Quel code on regarde aujourd\'hui ?',
          temperature: 0.3,
          maxTokens: 4096,
          tools: [],
        },
      },
      {
        name: 'Creative Writer',
        shortDescription: 'Rédacteur créatif pour tous vos contenus',
        description: 'Un agent créatif qui génère du contenu : articles, posts réseaux sociaux, scripts, histoires. Adaptable à votre ton et votre audience.',
        icon: '',
        iconColor: '#ec4899',
        features: ['Articles & blogs', 'Posts sociaux', 'Copywriting', 'Storytelling'],
        category: 'creative',
        tags: ['writing', 'content', 'creative', 'marketing'],
        visibility: 'public',
        usageCount: 2100,
        remixCount: 78,
        rating: 4.3,
        ratingCount: 156,
        configSnapshot: {
          model: 'openai/gpt-4.1',
          systemPrompt: 'Tu es un rédacteur créatif polyvalent.',
          welcomeMessage: 'Salut ! Quel contenu créez-vous aujourd\'hui ?',
          temperature: 0.8,
          maxTokens: 4096,
          tools: [],
        },
      },
      {
        name: 'Data Analyst',
        shortDescription: 'Analyse de données et insights automatiques',
        description: 'Un agent qui aide à analyser des données, créer des requêtes SQL, interpréter des résultats et proposer des visualisations. Parfait pour les équipes data.',
        icon: '',
        iconColor: '#06b6d4',
        features: ['Analyse SQL', 'Interprétation', 'Visualisations', 'Recommandations'],
        category: 'data',
        tags: ['data', 'analytics', 'sql', 'insights'],
        visibility: 'public',
        usageCount: 890,
        remixCount: 23,
        rating: 4.6,
        ratingCount: 67,
        configSnapshot: {
          model: 'openai/gpt-4.1',
          systemPrompt: 'Tu es un data analyst expert.',
          welcomeMessage: 'Bonjour ! Quelles données analysons-nous ?',
          temperature: 0.4,
          maxTokens: 4096,
          tools: [{ name: 'SQL Query', type: 'function' }],
        },
      },
      {
        name: 'Tuteur Maths',
        shortDescription: 'Professeur de mathématiques patient et pédagogue',
        description: 'Un tuteur de mathématiques qui explique les concepts du collège au supérieur. Approche pédagogique, exercices interactifs et explications pas-à-pas.',
        icon: '',
        iconColor: '#f59e0b',
        features: ['Algèbre', 'Calcul', 'Géométrie', 'Statistiques'],
        category: 'education',
        tags: ['math', 'education', 'tutoring', 'learning'],
        visibility: 'public',
        usageCount: 5600,
        remixCount: 210,
        rating: 4.9,
        ratingCount: 412,
        configSnapshot: {
          model: 'openai/gpt-4.1',
          systemPrompt: 'Tu es un professeur de mathématiques patient et pédagogue.',
          welcomeMessage: 'Salut ! Quelle notion de maths travaillons-nous ?',
          temperature: 0.5,
          maxTokens: 2048,
          tools: [],
        },
      },
      {
        name: 'Marketing AI',
        shortDescription: 'Stratège marketing et growth hacking',
        description: 'Un agent spécialisé en marketing digital : SEO, ads, email marketing, growth hacking. Conseils personnalisés basés sur votre secteur et vos objectifs.',
        icon: '',
        iconColor: '#10b981',
        features: ['SEO', 'Ads', 'Email Marketing', 'Growth'],
        category: 'marketing',
        tags: ['marketing', 'seo', 'growth', 'digital'],
        visibility: 'public',
        usageCount: 1800,
        remixCount: 55,
        rating: 4.4,
        ratingCount: 98,
        configSnapshot: {
          model: 'openai/gpt-4.1-mini',
          systemPrompt: 'Tu es un expert en marketing digital.',
          welcomeMessage: 'Hello ! Parlons croissance. Quel est votre objectif ?',
          temperature: 0.6,
          maxTokens: 2048,
          tools: [],
        },
      },
      {
        name: 'Game Master',
        shortDescription: 'Maître du jeu RPG interactif',
        description: 'Un maître du jeu de rôle qui crée des aventures interactives. Choisissez votre personnage et vivez une histoire unique à chaque conversation.',
        icon: '',
        iconColor: '#ef4444',
        features: ['Aventures uniques', 'Choix multiples', 'Personnages', 'Combats'],
        category: 'entertainment',
        tags: ['rpg', 'game', 'adventure', 'interactive'],
        visibility: 'public',
        usageCount: 4200,
        remixCount: 189,
        rating: 4.7,
        ratingCount: 345,
        configSnapshot: {
          model: 'openai/gpt-4.1',
          systemPrompt: 'Tu es un maître du jeu de rôle fantastique.',
          welcomeMessage: 'Bienvenue, aventurier ! Choisissez votre destin...',
          temperature: 0.9,
          maxTokens: 4096,
          tools: [],
        },
      },
      {
        name: 'Private HR Bot',
        shortDescription: 'Assistant RH interne (privé)',
        description: 'Agent RH interne pour répondre aux questions des employés sur les congés, la paie, les avantages et les politiques de l\'entreprise.',
        icon: '',
        iconColor: '#6366f1',
        features: ['Congés', 'Paie', 'Avantages', 'Politiques'],
        category: 'productivity',
        tags: ['hr', 'internal', 'employee'],
        visibility: 'private',
        accessToken: 'hr-token-demo-123',
        usageCount: 320,
        remixCount: 0,
        rating: 4.2,
        ratingCount: 15,
        configSnapshot: {
          model: 'openai/gpt-4.1-mini',
          systemPrompt: 'Tu es un assistant RH pour les employés.',
          welcomeMessage: 'Bonjour ! Question RH ? Je suis là pour aider.',
          temperature: 0.4,
          maxTokens: 2048,
          tools: [],
        },
      },
    ];

    samples.forEach((s) => {
      const id = randomUUID();
      const listing: StoreAgentListing = {
        id,
        agentId: `agent-${id.substring(0, 8)}`,
        userId: 'demo-user-id',
        creatorName: 'GiLo Team',
        name: s.name!,
        description: s.description!,
        shortDescription: s.shortDescription!,
        icon: s.icon || '',
        iconColor: s.iconColor || '#3b82f6',
        features: s.features || [],
        category: s.category || 'other',
        tags: s.tags || [],
        configSnapshot: s.configSnapshot!,
        visibility: s.visibility || 'public',
        accessToken: s.accessToken,
        accessPrice: s.accessPrice,
        usageCount: s.usageCount || 0,
        remixCount: s.remixCount || 0,
        rating: s.rating || 0,
        ratingCount: s.ratingCount || 0,
        version: '1.0.0',
        publishedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      };
      this.listings.set(id, listing);
    });
  }

  // ---- CRUD ----

  async publish(userId: string, creatorName: string, dto: PublishAgentDTO, configSnapshot: StoreAgentListing['configSnapshot']): Promise<StoreAgentListing> {
    const id = randomUUID();
    const listing: StoreAgentListing = {
      id,
      agentId: dto.agentId,
      userId,
      creatorName,
      name: dto.name,
      description: dto.description,
      shortDescription: dto.shortDescription,
      icon: dto.icon || '',
      iconColor: dto.iconColor || '#3b82f6',
      features: dto.features,
      category: dto.category,
      tags: dto.tags || [],
      configSnapshot,
      visibility: dto.visibility,
      accessToken: dto.visibility === 'private' ? randomUUID().replace(/-/g, '') : undefined,
      accessPrice: dto.accessPrice || 0,
      usageCount: 0,
      remixCount: 0,
      rating: 0,
      ratingCount: 0,
      version: '1.0.0',
      publishedAt: new Date(),
      updatedAt: new Date(),
    };

    this.listings.set(id, listing);
    return listing;
  }

  async findAll(options?: { category?: StoreCategory; search?: string; visibility?: StoreVisibility }): Promise<StoreAgentListing[]> {
    let results = Array.from(this.listings.values());

    if (options?.visibility) {
      results = results.filter((l) => l.visibility === options.visibility);
    }

    if (options?.category) {
      results = results.filter((l) => l.category === options.category);
    }

    if (options?.search) {
      const q = options.search.toLowerCase();
      results = results.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Sort by usage (most popular first)
    results.sort((a, b) => b.usageCount - a.usageCount);
    return results;
  }

  async findById(id: string): Promise<StoreAgentListing | undefined> {
    return this.listings.get(id);
  }

  async findByUserId(userId: string): Promise<StoreAgentListing[]> {
    return Array.from(this.listings.values()).filter((l) => l.userId === userId);
  }

  async getCards(): Promise<StoreAgentCard[]> {
    const all = Array.from(this.listings.values())
      .filter((l) => l.visibility === 'public')
      .sort((a, b) => b.usageCount - a.usageCount);

    return all.map((l) => ({
      id: l.id,
      name: l.name,
      shortDescription: l.shortDescription,
      icon: l.icon,
      iconColor: l.iconColor,
      category: l.category,
      visibility: l.visibility,
      rating: l.rating,
      usageCount: l.usageCount,
      creatorName: l.creatorName,
    }));
  }

  async incrementUsage(id: string): Promise<void> {
    const listing = this.listings.get(id);
    if (listing) {
      listing.usageCount++;
      listing.updatedAt = new Date();
    }
  }

  async incrementRemix(id: string): Promise<void> {
    const listing = this.listings.get(id);
    if (listing) {
      listing.remixCount++;
      listing.updatedAt = new Date();
    }
  }

  async update(id: string, data: Partial<StoreAgentListing>): Promise<StoreAgentListing> {
    const listing = this.listings.get(id);
    if (!listing) throw new Error('Store listing not found');
    const updated = { ...listing, ...data, updatedAt: new Date() };
    this.listings.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.listings.delete(id);
  }

  async validateToken(id: string, token: string): Promise<boolean> {
    const listing = this.listings.get(id);
    if (!listing) return false;
    if (listing.visibility === 'public') return true;
    return listing.accessToken === token;
  }
}

export const storeModel = new StoreModel();
