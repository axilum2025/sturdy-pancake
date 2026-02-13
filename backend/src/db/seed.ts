// ============================================================
// GiLo AI – Database Seed Script
// Inserts demo user + sample store agents
// Run: npx tsx src/db/seed.ts
// ============================================================

import dotenv from 'dotenv';
dotenv.config();

import { initDb, getDb, closeDb } from './index';
import { users, agents, storeAgents } from './schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const DEMO_USER_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'demo123';

// Admin account — uses ADMIN_EMAIL from .env
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = 'Zgd10091990@';

async function seed() {
  console.log('🌱 Seeding database...');

  await initDb();
  const db = getDb();

  // ---- Create admin user (app developer) ----
  if (ADMIN_EMAIL) {
    const existingAdmin = await db.query.users.findFirst({
      where: eq(users.email, ADMIN_EMAIL),
    });

    if (existingAdmin) {
      // Always reset password to ensure it matches seed config
      const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await db.update(users)
        .set({ passwordHash: adminHash, tier: 'pro', subscription: { status: 'active' } })
        .where(eq(users.email, ADMIN_EMAIL));
      console.log('  ✓ Admin user already exists — password & tier reset');
    } else {
      const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      const [adminUser] = await db.insert(users).values({
        email: ADMIN_EMAIL,
        passwordHash: adminHash,
        tier: 'pro',
        subscription: { status: 'active' },
        quotas: {
          projectsMax: 999,
          storageMax: 50 * 1024 * 1024 * 1024,
          deploymentsPerMonth: 9999,
        },
        usage: {
          projectsCount: 0,
          storageUsed: 0,
          deploymentsThisMonth: 0,
          lastResetDate: new Date().toISOString(),
        },
      }).returning();
      console.log(`  ✓ Admin user created: ${adminUser.id} (${ADMIN_EMAIL})`);
    }
  }

  // ---- Create demo user ----
  const existing = await db.query.users.findFirst({
    where: eq(users.email, DEMO_USER_EMAIL),
  });

  let demoUserId: string;

  if (existing) {
    console.log('  ✓ Demo user already exists');
    demoUserId = existing.id;
  } else {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const [demoUser] = await db.insert(users).values({
      email: DEMO_USER_EMAIL,
      passwordHash,
      tier: 'pro',
      subscription: { status: 'active' },
      quotas: {
        projectsMax: 10,
        storageMax: 5 * 1024 * 1024 * 1024,
        deploymentsPerMonth: 20,
      },
      usage: {
        projectsCount: 0,
        storageUsed: 0,
        deploymentsThisMonth: 0,
        lastResetDate: new Date().toISOString(),
      },
    }).returning();
    demoUserId = demoUser.id;
    console.log(`  ✓ Demo user created: ${demoUserId}`);
  }

  // ---- Create sample agent ----
  const existingAgents = await db.query.agents.findFirst({
    where: eq(agents.userId, demoUserId),
  });

  let sampleAgentId: string | undefined;

  if (!existingAgents) {
    const [sampleAgent] = await db.insert(agents).values({
      userId: demoUserId,
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
        welcomeMessage: "Bonjour ! Je suis votre assistant support. Comment puis-je vous aider aujourd'hui ?",
        tools: [
          { id: 'tool-faq', name: 'FAQ Lookup', type: 'function', description: 'Rechercher dans la base de connaissances FAQ', enabled: true },
          { id: 'tool-ticket', name: 'Create Ticket', type: 'api', description: 'Créer un ticket de support pour escalade humaine', enabled: true },
        ],
      },
      status: 'active',
      endpoint: '',
      totalConversations: 42,
      totalMessages: 318,
    }).returning();
    sampleAgentId = sampleAgent.id;
    // Update endpoint with real ID
    await db.update(agents).set({ endpoint: `/api/agents/${sampleAgentId}/chat` }).where(eq(agents.id, sampleAgentId));
    console.log(`  ✓ Sample agent created: ${sampleAgentId}`);
  } else {
    console.log('  ✓ Sample agent already exists');
  }

  // ---- Create sample store agents ----
  const existingStore = await db.query.storeAgents.findFirst({
    where: eq(storeAgents.userId, demoUserId),
  });

  if (!existingStore) {
    const samples = [
      {
        name: 'Support Pro',
        shortDescription: 'Agent de support client intelligent',
        description: 'Un agent de support client professionnel qui répond aux questions fréquentes, guide les utilisateurs et escalade vers un humain quand nécessaire.',
        iconColor: '#3b82f6',
        features: ['Support 24/7', 'Escalation intelligente', 'FAQ automatique', 'Multi-langue'],
        category: 'support' as const,
        tags: ['support', 'customer-service', 'faq'],
        usageCount: 1250, remixCount: 42, rating: 4.5, ratingCount: 89,
        configSnapshot: {
          model: 'openai/gpt-4.1',
          systemPrompt: 'Tu es un agent de support client professionnel.',
          welcomeMessage: 'Bonjour ! Comment puis-je vous aider ?',
          temperature: 0.5, maxTokens: 2048,
          tools: [{ name: 'FAQ Lookup', type: 'function' }],
        },
      },
      {
        name: 'Code Buddy',
        shortDescription: 'Assistant de développement et code review',
        description: 'Un assistant de développement qui aide au code review, debugging, et explique les concepts de programmation.',
        iconColor: '#8b5cf6',
        features: ['Code review', 'Debugging', 'Explications', 'Multi-langage'],
        category: 'dev-tools' as const,
        tags: ['code', 'development', 'review', 'debug'],
        usageCount: 3420, remixCount: 156, rating: 4.8, ratingCount: 234,
        configSnapshot: {
          model: 'openai/gpt-4.1',
          systemPrompt: 'Tu es un expert en développement logiciel.',
          welcomeMessage: "Hey ! Quel code on regarde aujourd'hui ?",
          temperature: 0.3, maxTokens: 4096, tools: [],
        },
      },
      {
        name: 'Creative Writer',
        shortDescription: 'Rédacteur créatif pour tous vos contenus',
        description: 'Un agent créatif qui génère du contenu : articles, posts réseaux sociaux, scripts, histoires.',
        iconColor: '#ec4899',
        features: ['Articles & blogs', 'Posts sociaux', 'Copywriting', 'Storytelling'],
        category: 'creative' as const,
        tags: ['writing', 'content', 'creative', 'marketing'],
        usageCount: 2100, remixCount: 78, rating: 4.3, ratingCount: 156,
        configSnapshot: {
          model: 'openai/gpt-4.1',
          systemPrompt: 'Tu es un rédacteur créatif polyvalent.',
          welcomeMessage: 'Salut ! Quel contenu créez-vous aujourd\'hui ?',
          temperature: 0.8, maxTokens: 4096, tools: [],
        },
      },
      {
        name: 'Data Analyst',
        shortDescription: 'Analyse de données et insights automatiques',
        description: 'Un agent qui aide à analyser des données, créer des requêtes SQL, interpréter des résultats.',
        iconColor: '#06b6d4',
        features: ['Analyse SQL', 'Interprétation', 'Visualisations', 'Recommandations'],
        category: 'data' as const,
        tags: ['data', 'analytics', 'sql', 'insights'],
        usageCount: 890, remixCount: 23, rating: 4.6, ratingCount: 67,
        configSnapshot: {
          model: 'openai/gpt-4.1',
          systemPrompt: 'Tu es un data analyst expert.',
          welcomeMessage: 'Bonjour ! Quelles données analysons-nous ?',
          temperature: 0.4, maxTokens: 4096,
          tools: [{ name: 'SQL Query', type: 'function' }],
        },
      },
      {
        name: 'Tuteur Maths',
        shortDescription: 'Professeur de mathématiques patient et pédagogue',
        description: 'Un tuteur de mathématiques qui explique les concepts du collège au supérieur.',
        iconColor: '#f59e0b',
        features: ['Algèbre', 'Calcul', 'Géométrie', 'Statistiques'],
        category: 'education' as const,
        tags: ['math', 'education', 'tutoring', 'learning'],
        usageCount: 5600, remixCount: 210, rating: 4.9, ratingCount: 412,
        configSnapshot: {
          model: 'openai/gpt-4.1',
          systemPrompt: 'Tu es un professeur de mathématiques patient et pédagogue.',
          welcomeMessage: 'Salut ! Quelle notion de maths travaillons-nous ?',
          temperature: 0.5, maxTokens: 2048, tools: [],
        },
      },
      {
        name: 'Marketing AI',
        shortDescription: 'Stratège marketing et growth hacking',
        description: 'Un agent spécialisé en marketing digital : SEO, ads, email marketing, growth hacking.',
        iconColor: '#10b981',
        features: ['SEO', 'Ads', 'Email Marketing', 'Growth'],
        category: 'marketing' as const,
        tags: ['marketing', 'seo', 'growth', 'digital'],
        usageCount: 1800, remixCount: 55, rating: 4.4, ratingCount: 98,
        configSnapshot: {
          model: 'openai/gpt-4.1-mini',
          systemPrompt: 'Tu es un expert en marketing digital.',
          welcomeMessage: 'Hello ! Parlons croissance. Quel est votre objectif ?',
          temperature: 0.6, maxTokens: 2048, tools: [],
        },
      },
      {
        name: 'Game Master',
        shortDescription: 'Maître du jeu RPG interactif',
        description: 'Un maître du jeu de rôle qui crée des aventures interactives.',
        iconColor: '#ef4444',
        features: ['Aventures uniques', 'Choix multiples', 'Personnages', 'Combats'],
        category: 'entertainment' as const,
        tags: ['rpg', 'game', 'adventure', 'interactive'],
        usageCount: 4200, remixCount: 189, rating: 4.7, ratingCount: 345,
        configSnapshot: {
          model: 'openai/gpt-4.1',
          systemPrompt: 'Tu es un maître du jeu de rôle fantastique.',
          welcomeMessage: 'Bienvenue, aventurier ! Choisissez votre destin...',
          temperature: 0.9, maxTokens: 4096, tools: [],
        },
      },
      {
        name: 'Private HR Bot',
        shortDescription: 'Assistant RH interne (privé)',
        description: "Agent RH interne pour répondre aux questions des employés sur les congés, la paie, les avantages.",
        iconColor: '#6366f1',
        features: ['Congés', 'Paie', 'Avantages', 'Politiques'],
        category: 'productivity' as const,
        tags: ['hr', 'internal', 'employee'],
        visibility: 'private' as const,
        accessToken: 'hr-token-demo-123',
        usageCount: 320, remixCount: 0, rating: 4.2, ratingCount: 15,
        configSnapshot: {
          model: 'openai/gpt-4.1-mini',
          systemPrompt: 'Tu es un assistant RH pour les employés.',
          welcomeMessage: 'Bonjour ! Question RH ? Je suis là pour aider.',
          temperature: 0.4, maxTokens: 2048, tools: [],
        },
      },
    ];

    for (const s of samples) {
      await db.insert(storeAgents).values({
        agentId: `agent-sample-${s.name.toLowerCase().replace(/\s+/g, '-')}`,
        userId: demoUserId,
        creatorName: 'GiLo Team',
        name: s.name,
        description: s.description,
        shortDescription: s.shortDescription,
        icon: '',
        iconColor: s.iconColor,
        features: s.features,
        category: s.category,
        tags: s.tags,
        configSnapshot: s.configSnapshot,
        visibility: s.visibility || 'public',
        accessToken: s.accessToken,
        usageCount: s.usageCount,
        remixCount: s.remixCount,
        rating: s.rating,
        ratingCount: s.ratingCount,
        version: '1.0.0',
        publishedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      });
    }
    console.log(`  ✓ ${samples.length} store agents created`);
  } else {
    console.log('  ✓ Store agents already exist');
  }

  console.log('✅ Seeding complete');
  await closeDb();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
