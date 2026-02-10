# Architecture du Projet - GiLo AI Agent Builder

> **Dernière mise à jour** : 8 février 2026

## Vue d'ensemble

Ce projet est un **constructeur d'agents IA** (Agent Builder) avec un **Agent Store** intégré. Il permet aux utilisateurs de créer, configurer, tester et publier des agents IA accessibles via une interface de chat style ChatGPT/Gemini/Claude.

---

## Diagramme d'Architecture

```mermaid
flowchart TB
    subgraph Frontend - Port 5173
        A[React + Vite + Tailwind]
        B[Pages]
        C[Composants]
        D[Services]
        E[Store Zustand]
        
        B --> Home[Home - Landing]
        B --> Dashboard[Dashboard - Liste agents]
        B --> Builder[Builder - Agent Studio]
        B --> AgentStore[AgentStore - Grille icônes]
        B --> AgentStorePage[AgentStorePage - Détails]
        B --> AgentChat[AgentChat - Chat plein écran]
        
        C --> ChatPanel
        C --> AgentConfig
        C --> Playground
        C --> TimelinePanel
        C --> MCPSettings
        C --> MCPBrowser
        C --> PublishModal
        C --> AuthModal
        
        D --> api.ts
        E --> sessionStore
        E --> builderStore
    end
    
    subgraph Backend - Port 3001
        F[Express Server]
        G[Routes]
        H[Services]
        I[Models]
        
        G --> agentsRouter[/api/agents]
        G --> storeRouter[/api/store]
        G --> sessionRouter[/api/sessions]
        G --> mcpRouter[/api/mcp]
        G --> authRouter[/api/auth]
        G --> storageRouter[/api/storage]
        
        H --> AgentService
        H --> SessionManager
        H --> MCPService
        H --> StorageService
        
        I --> AgentModel[Agent Model - Map]
        I --> StoreModel[StoreAgent Model - Map]
        I --> UserModel[User Model - Map]
    end
    
    subgraph External APIs
        J[GitHub Models API]
        K[OpenAI Compatible - SSE]
    end
    
    A -- HTTP REST + SSE --> F
    F -- Chat Streaming --> J
    F -- Store Chat --> K
```

---

## Structure des Données

### Session (SessionManager)
```typescript
interface Session {
  id: string;              // UUID
  projectId: string;       // ID du projet
  userId: string;           // ID utilisateur
  createdAt: Date;          // Date de création
  permissions: {
    filesystem: 'sandbox' | 'restricted' | 'full';
    allowedCommands: string[];
    maxFileSize: number;
    allowedPorts: number[];
  };
  state: 'active' | 'idle' | 'closed';
}
```

### Task (AgentService)
```typescript
interface Task {
  id: string;
  sessionId: string;
  prompt: string;
  constraints?: {
    stack?: string[];
    accessibility?: boolean;
    mobileFirst?: boolean;
    externalAPIs?: boolean;
    mcpTools?: string[];
  };
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
}
```

### MCP Server Config
```typescript
interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  description?: string;
}
```

---

## Flux de Données

### 1. Création d'une Session
```
User → Builder.tsx → useSessionStore → POST /api/sessions → SessionManager
```

### 2. Envoi d'une Tâche
```
User → ChatPanel.tsx → POST /api/agent/task → AgentService
    → Task créée avec statut 'pending'
    → Exécution asynchrone
    → Streaming des événements via SSE
```

### 3. Gestion MCP
```
MCPBrowser.tsx → GET /api/mcp/tools → MCPService
    → Liste des outils disponibles
    → Exécution via POST /api/mcp/tools/execute
```

---

## Technologies Utilisées

### Frontend
- **React 18** — Framework UI
- **Vite** — Build tool
- **Tailwind CSS** — Styling (design system glass/gradient custom)
- **React Router v6** — Routing
- **Zustand** — State management (sessionStore, builderStore)
- **Lucide React** — Icônes
- **TypeScript** — Typage

### Backend
- **Express.js** — Framework web
- **TypeScript** — Langage
- **OpenAI SDK** — Chat completions (GitHub Models API)
- **SSE** — Server-Sent Events pour le streaming
- **CORS** — Cross-origin middleware
- **dotenv** — Variables d'environnement

### AI
- **GitHub Models API** — GPT-4.1 / GPT-4.1-mini / GPT-4.1-nano
- **OpenAI-compatible endpoint** — `https://models.github.ai/inference`
- **SSE streaming** — Réponses en temps réel

---

## API Endpoints

### Auth
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/login` | Connexion (demo) |
| POST | `/api/auth/register` | Inscription (demo) |
| GET | `/api/auth/me` | Utilisateur courant |

### Agents
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/agents` | Lister les agents de l'utilisateur |
| POST | `/api/agents` | Créer un agent |
| GET | `/api/agents/:id` | Détail d'un agent |
| PATCH | `/api/agents/:id` | Modifier un agent |
| DELETE | `/api/agents/:id` | Supprimer un agent |
| PATCH | `/api/agents/:id/config` | Modifier la config (model, temperature, tools) |
| POST | `/api/agents/:id/chat` | Chat SSE avec l'agent |
| POST | `/api/agents/:id/deploy` | Déployer un agent |

### Agent Store
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/store` | Lister les agents du Store (cards) |
| GET | `/api/store/categories` | Catégories disponibles |
| GET | `/api/store/:id` | Détail d'un agent du Store |
| POST | `/api/store/publish` | Publier un agent dans le Store |
| POST | `/api/store/:id/chat` | Chat SSE avec un agent du Store |
| POST | `/api/store/:id/use` | Incrémenter le compteur d'utilisation |
| POST | `/api/store/:id/validate-token` | Valider un token d'accès privé |
| DELETE | `/api/store/:id` | Retirer un agent du Store |

### Sessions
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/sessions` | Créer une session |
| GET | `/api/sessions/:sessionId` | Récupérer une session |
| DELETE | `/api/sessions/:sessionId` | Supprimer une session |

### MCP
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/mcp/servers` | Liste des serveurs |
| POST | `/api/mcp/servers` | Ajouter un serveur |
| PATCH | `/api/mcp/servers/:id` | Modifier un serveur |
| DELETE | `/api/mcp/servers/:id` | Supprimer un serveur |
| GET | `/api/mcp/tools` | Liste des outils |
| POST | `/api/mcp/tools/execute` | Exécuter un outil |
| GET | `/api/mcp/resources` | Liste des ressources |

### Storage
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/storage/projects` | Créer un projet |
| GET | `/api/storage/projects` | Lister les projets |
| GET | `/api/storage/projects/:id` | Récupérer un projet |
| POST | `/api/storage/projects/:id/files` | Sauvegarder un fichier |

---

## Fonctionnalités Actuelles

### Phase 1 - Rebrand UI ✅
- Design system glass/gradient (glass-strong, gradient-text, glow-icon, btn-gradient)
- Landing page "GiLo AI — Agent Builder"
- Responsive mobile/tablette/desktop
- Animations (fade-in-up, slide-in-right, pulse-glow)

### Phase 2 - Agent Builder ✅
- CRUD agents avec config (model, temperature, system prompt, tools)
- Chat SSE temps réel (GitHub Models API — GPT-4.1)
- AgentConfig UI (3 onglets : Instructions, Modèle, Outils)
- Playground intégré pour tester les agents
- Dashboard avec stats et création rapide
- MCP Settings + Browser (design glass/gradient)
- Timeline des actions
- Auth demo (demo@example.com / demo)

### Phase 2.5 - Agent Store ✅ (core)
- Agent Store (grille d'icônes style app mobile)
- Page détail agent (stats, features, boutons Utiliser/Remixer)
- Interface chat plein écran style ChatGPT/Gemini/Claude
- Publication depuis le Builder (3 étapes)
- 9 catégories (support, dev, creative, data, education, marketing, gaming, hr, general)
- Agents publics et privés (validation par token)

### À venir (voir ROADMAP.md)
- Phase 3 : Persistance DB + Auth JWT/OAuth
- Phase 4 : Déploiement réel (API endpoints, widget, webhooks)
- Phase 5 : Knowledge Base / RAG
- Phase 6 : Outils & MCP fonctionnel
- Phase 7-10 : Analytics, Versioning, Billing, Production

---

## Points d'Extension Prioritaires

### 1. Persistance (Phase 3)
Actuellement tout est en mémoire (`Map`). Au restart, toutes les données sont perdues.
→ Migration vers PostgreSQL + drizzle-orm

### 2. Auth Réelle (Phase 3)
Le système actuel utilise un header `x-user-id` avec un user demo fixe.
→ JWT + OAuth GitHub/Google

### 3. MCP Fonctionnel (Phase 6)
Le `mcpService.ts` contient des stubs/placeholders :
```typescript
// Toutes les méthodes retournent des données statiques
// TODO: Connecter de vrais serveurs MCP
```

### 4. Knowledge Base / RAG (Phase 5)
Pas encore implémenté. Objectif : permettre aux agents d'accéder à des documents personnalisés via embeddings + recherche vectorielle.

---

## Sécurité

- **Sandbox filesystem**: Permissions configurables
- **Allowlist commandes**: npm, pnpm, vite, eslint, prettier
- **Pas d'accès aux secrets**: Variables d'environnement protégées
- **Isolation par session**: Chaque projet a sa propre session

---

## Déploiement

- **Azure Web Apps** avec CI/CD GitHub Actions
- Variables d'environnement requises:
  - `PORT`
  - `NODE_ENV`
  - `GITHUB_TOKEN`
  - `ALLOWED_ORIGINS`
  - `GILO_DOMAIN` (e.g. `gilo.dev`)
  - `MCP_STORAGE_DIR`

---

*Document mis à jour le 8 février 2026*
