# GiLo AI — Agent Builder : Roadmap des Phases de Développement

> **État actuel** : Phase 1–7 ✅ + Phase 9 ✅ + Phase 10 (en cours) ✅
> **Dernière mise à jour** : 14 février 2026

---

## Tableau de bord des phases

| Phase | Nom | Statut | Priorité |
|-------|-----|--------|----------|
| 1 | Rebrand UI | ✅ Terminé | — |
| 2 | Agent Builder fonctionnel | ✅ Terminé | — |
| 2.5 | Agent Store + Chat Interface | ✅ Terminé (core) | — |
| 3 | Persistance & Auth réelle | ✅ Terminé | — |
| 4 | Déploiement réel des agents | ✅ Terminé | — |
| 5 | Knowledge Base & RAG | ✅ Terminé | — |
| 6 | Outils & MCP fonctionnel | ✅ Terminé | — |
| 7 | Analytics & Monitoring | ✅ Terminé | — |
| 8 | Versioning & Collaboration | ⏳ Planifié | Basse |
| 9 | Billing Stripe | ✅ Terminé | — |
| 10 | Production & DevOps | 🟡 En cours | Moyenne |

---

## Résumé global — Ce qui est réalisé ✅

### Infrastructure & Fondations
- **PostgreSQL 16** + Drizzle ORM — 15 tables (users, agents, store_agents, conversations, messages, knowledge_documents, knowledge_chunks, api_keys, webhooks, refresh_tokens, community_tools, agent_metrics, agent_logs, agent_alerts, integrations)
- **Redis 7** — cache, rate limiting persistent (sorted sets sliding window), fallback in-memory
- **JWT Auth** réel avec bcrypt + jsonwebtoken (register, login, me, upgrade, downgrade)
- **OAuth GitHub login** (findOrCreateByGithub, 3 cas : existant, email link, nouveau)
- **Cloudflare Turnstile** captcha (managed mode, dark theme) anti-bot sur register + login
- **Forgot password / Reset password** (token email + page reset)
- **RGPD/GDPR** — `GET /auth/export` (Art. 15/20) + `DELETE /auth/account` (Art. 17)
- **Docker Compose** — 5 services (Caddy reverse proxy, backend, frontend, PostgreSQL, Redis)
- **Dockerfile** multi-stage backend (Node.js 20 Alpine)
- **Bicep IaC** — Azure Container Apps + ACR + PostgreSQL Flexible + SWA + Log Analytics
- **CI/CD** GitHub Actions — deploy-backend.yml + deploy-frontend.yml
- **Zod v4 validation** sur toutes les routes critiques (10 schemas, middleware centralisé)
- **35 tests unitaires** vitest (chunker, toolExecutor, toolCatalogue, httpActionService)
- **Rate limiting** par tier (free/pro) avec Redis sliding window (fallback in-memory)

### Backend — 20 fichiers routes, ~100+ endpoints
- **Auth** : register, login, me, upgrade, downgrade, export RGPD, delete account, GitHub OAuth login, forgot/reset password
- **Captcha** : Cloudflare Turnstile (managed mode) sur register + login
- **Agents CRUD** : list, create, get, update, updateConfig, deploy, delete, chat SSE
- **Conversations** : create, list, getMessages, delete (persistance automatique dans chat)
- **Public API v1** : `GET /api/v1/agents/:id`, `POST /api/v1/agents/:id/chat` (API key auth)
- **API Keys** : create, list, revoke par agent
- **Webhooks** : CRUD + firing automatique (on_conversation_start, on_message, on_escalation, on_error) + signature HMAC
- **Knowledge Base** : upload (PDF/TXT/MD/DOCX/CSV), chunking, embeddings, RAG search, URL scraping
- **Store** : list, detail, publish, remix, chat SSE, categories, token validation, regenerate-token
- **Analytics** : dashboard global, par agent, logs détaillés, export CSV
- **Alerts** : CRUD règles d'alerte (error_rate, cost_limit, inactivity, rate_limit), check automatique
- **Billing** : plans, checkout Stripe, portal, webhook handler
- **Tools** : catalogue 16 built-in, community marketplace, import OpenAPI, test HTTP
- **MCP** : 12 templates, servers CRUD, connect/disconnect, tools/resources/prompts execution
- **Copilot** : chat, stream SSE, generate, review, repo info/tree
- **Integrations** : OAuth providers (Google implémenté), API key auth
- **Deploy** : CRUD déploiements par projet
- **Subdomain** : `{slug}.gilo.dev` → chat HTML + API
- **Widget** : `/widget.js` embeddable avec CORS * (chat bubble)

### Backend — 17 services
- `agentService.ts` — orchestration tâches
- `analyticsService.ts` — métriques, logs, conversations tracking
- `billingService.ts` — Stripe checkout, portal, webhook handler
- `chunker.ts` — découpage texte en chunks avec overlap
- `conversationService.ts` — CRUD conversations + messages PostgreSQL
- `copilotService.ts` — interface GitHub Models API (GPT-4.1)
- `deploymentService.ts` — gestion déploiements
- `documentParser.ts` — parsing PDF/DOCX/CSV/JSON
- `embeddingService.ts` — embeddings text-embedding-3-small
- `httpActionService.ts` — actions HTTP + parsing OpenAPI
- `knowledgeService.ts` — RAG complet (upload → chunks → embeddings → search → inject)
- `mcpService.ts` — client MCP JSON-RPC 2.0 (stdio + HTTP)
- `sessionManager.ts` — gestion sessions de travail
- `storageService.ts` — filesystem local
- `toolCatalogue.ts` — 16 outils built-in (6 catégories)
- `toolExecutor.ts` — dispatch builtin/http/mcp + OpenAI function calling
- `urlScraperService.ts` — scraping URL avec cheerio

### Backend — 6 middlewares
- `auth.ts` — JWT verification + optionalAuth
- `apiKeyAuth.ts` — API key auth pour public API v1
- `rateLimiter.ts` — rate limiting par tier (API key)
- `publicRateLimiter.ts` — rate limiting subdomain (IP)
- `subdomain.ts` — routing `{slug}.gilo.dev` → agent
- `validation.ts` — Zod v4 schemas + `validate()` middleware factory

### Frontend — 10 pages, 18+ composants
- **Pages** : Home, Dashboard, Studio (Builder), AgentStore, AgentStorePage, AgentChat, Analytics, Documentation, Privacy, Terms
- **Composants** : ChatPanel, AgentConfig, Playground, AppearancePanel, KnowledgePanel, MCPSettings, MCPBrowser, PublishModal, ApiIntegrationModal (avec widget embed snippet), AuthModal, PreviewPanel, IntegrationsPanel, TimelinePanel, FileEditor, LanguageSwitcher, ThemeSwitcher, ProjectCard, ProtectedRoute
- **i18n** : français + anglais
- **State** : Zustand (sessionStore, builderStore)
- **Styling** : Tailwind CSS + design system glass/gradient custom

---

## Détail par Phase

### ✅ Phase 1 — Rebrand UI
- Landing page "GiLo AI — Agent Builder" avec design system glass/gradient
- Dashboard avec stats (agents, conversations, déployés, tier)
- Design responsive mobile/tablette/desktop
- Animations (fade-in-up, slide-in-right, pulse-glow)

### ✅ Phase 2 — Agent Builder fonctionnel
- CRUD agents avec config (model, temperature, system prompt, tools)
- Chat SSE temps réel via GitHub Models API (GPT-4.1/Mini/Nano)
- AgentConfig UI (onglets : Instructions, Modèle, Outils, Apparence, Connaissances)
- Playground intégré pour tester les agents
- Dashboard avec stats et création rapide
- Copilot Chat avec streaming SSE

### ✅ Phase 2.5 — Agent Store (core)
- [x] Page `/store` — grille d'icônes d'agents (style écran d'accueil mobile)
- [x] Catégories, recherche, trending, top rated
- [x] Page détail agent — stats, features, boutons Utiliser/Remixer
- [x] Interface chat plein écran style ChatGPT/Gemini/Claude
- [x] PublishModal — wizard 3 étapes depuis le Builder
- [x] Agents publics et privés (token validation)
- [x] **Remix/Fork** — `POST /store/:id/remix` clone l'agent, tracking remixCount
- [ ] Monétisation agents privés (payant via Stripe) — **non implémenté**

### ✅ Phase 3 — Persistance & Auth Réelle
- [x] PostgreSQL 16 + Drizzle ORM (15 tables, migration complète depuis Map)
- [x] JWT auth avec bcrypt (register, login, me)
- [x] Relations User ↔ Agent (isolation multi-tenant)
- [x] **Conversations persistées** — sauvegarde automatique dans chat agents, public API et copilot
- [x] RGPD : export données + suppression compte
- [x] Déploiement Azure (SWA + Container Apps + PostgreSQL)
- [x] CI/CD GitHub Actions
- [x] **OAuth GitHub** provider (read:user, user:email, repo, gist, workflow scopes)
- [x] **OAuth GitHub login** — `findOrCreateByGithub()` (existant, email link, nouveau)
- [x] **Cloudflare Turnstile** captcha anti-bot sur register + login
- [x] **Forgot / Reset password** — token email SendGrid + page `/auth/reset-password`

### ✅ Phase 4 — Déploiement Réel des Agents
- [x] `POST /api/v1/agents/:id/chat` — API publique (SSE + JSON mode)
- [x] API Keys CRUD (`POST/GET/DELETE /api/agents/:id/api-keys`)
- [x] Rate limiting par tier (free: 60/min 1K/jour, pro: 300/min 10K/jour)
- [x] **Widget embeddable** (`/widget.js`) — chat bubble injectable via `<script>` tag
  - Configurable : data-agent-id, data-api-key, data-theme, data-accent, data-title, data-lang, data-position
  - Dark/light, responsive mobile, SSE streaming, conversation persistence
  - Section "Widget Embed" dans ApiIntegrationModal avec snippet copiable
- [x] Webhooks CRUD + firing + signature HMAC (on_conversation_start, on_message, on_escalation, on_error)
- [x] Subdomain routing (`{slug}.gilo.dev`) — chat HTML + API
- [x] UI API Integration : code snippets curl/Python/JS/Node.js + widget embed
- [ ] **Slack Bot** — non implémenté
- [ ] **Discord Bot** — non implémenté
- [ ] **WhatsApp (Twilio)** — non implémenté

### ✅ Phase 5 — Knowledge Base & RAG
- [x] Upload documents (PDF, TXT, MD, DOCX, CSV) avec parsing
- [x] Chunking intelligent (~500 tokens, overlap 50)
- [x] Embeddings via text-embedding-3-small + recherche cosinus pgvector
- [x] RAG intégré dans chat : 5 chunks injectés + citations SSE
- [x] URL Scraper (cheerio)
- [x] UI Knowledge Panel (drag & drop, stats, test search)
- [ ] **Connecteurs Notion** — non implémenté
- [ ] **Connecteurs Google Drive** — non implémenté
- [ ] **Scalable vector DB** (Qdrant/Pinecone) — utilise pgvector

### ✅ Phase 6 — Outils & MCP
- [x] Function calling natif OpenAI (boucle tool_calls, max 10 rounds)
- [x] MCP Service JSON-RPC 2.0 (stdio + HTTP transports)
- [x] 16 outils built-in (6 catégories : utilities, data, communication, productivity)
- [x] 12 templates MCP pré-configurés
- [x] Actions HTTP + import OpenAPI/Swagger
- [x] Community Tools Marketplace (publish, install, rating)
- [x] MCPBrowser UI (outils, ressources, prompts, test panel)

### ✅ Phase 7 — Analytics & Monitoring
- [x] Dashboard Analytics (`/analytics`) — vue globale + par agent
- [x] Métriques : conversations, messages, tokens, temps de réponse, coût estimé
- [x] Logs détaillés (input, system prompt, RAG chunks, tool calls, réponse, latence, coût)
- [x] Export CSV des logs
- [x] Alertes configurables (error_rate, cost_limit, inactivity, rate_limit)

### ⏳ Phase 8 — Versioning & Collaboration (non implémenté)
- [ ] Table `agent_versions` + CRUD + rollback + diff visuel
- [ ] Environnements Draft / Staging / Production
- [ ] Collaboration équipe (teams, roles owner/editor/viewer, invitations)
- [x] **Templates d'agents prédéfinis** (10 templates : Support Client, Assistant RH, Bot E-commerce, Code Reviewer, Content Writer, Tuteur IA, Data Analyst, Assistant Juridique, Social Media Manager, Assistant Réunion)

### ✅ Phase 9 — Billing Stripe (Per-Agent Pricing + BYO LLM)
- [x] Stripe SDK installé + billingService.ts
- [x] **Modèle per-agent** : Free (2 agents) + $3/agent/mois supplémentaire
- [x] `GET /api/billing/plans` — liste des plans (Free $0, Agent slot $3/mois)
- [x] `POST /api/billing/checkout` — Stripe Checkout avec `mode: subscription`, `quantity` dynamique
- [x] `POST /api/billing/portal` — crée Stripe Customer Portal Session
- [x] `POST /api/billing/webhook` — handler Stripe (raw body)
  - [x] `checkout.session.completed` → ajoute `paid_agent_slots` à l'utilisateur
  - [x] `customer.subscription.created/updated` → sync quantity ↔ paid_agent_slots
  - [x] `customer.subscription.deleted` → reset paid_agent_slots à 0
- [x] Env vars : `STRIPE_SECRET_KEY`, `STRIPE_AGENT_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`
- [x] **BYO LLM** — chaque agent peut utiliser sa propre clé OpenAI (apiKey + baseUrl + model)
  - [x] `copilotService.getClientForAgent()` — crée un client OpenAI dédié par agent
  - [x] Fallback sur GitHub Models API si pas de BYO LLM configuré
  - [x] UI AgentConfig avec section "LLM personnalisé" (toggle, champs clé/url/modèle)
- [x] **Page Billing frontend** — calculateur d'agents, checkout Stripe, portail gestion, FAQ
- [x] `maxAgents = 2 + paidAgentSlots` — logique dynamique backend + frontend
- [ ] **Plan Team** ($99/mois) — non implémenté (dépend Phase 8 Collaboration)
- [ ] **Usage-based billing** (metered) — non implémenté

### 🟡 Phase 10 — Production & DevOps (partiel)

#### ✅ Réalisé
- [x] Docker Compose (Caddy + backend + frontend + PostgreSQL)
- [x] Dockerfile multi-stage backend
- [x] CI/CD GitHub Actions (deploy-backend + deploy-frontend)
- [x] Bicep IaC (infra/main.bicep)
- [x] Health check (`GET /health`, `GET /api/health`)
- [x] Zod v4 validation sur toutes les routes critiques (10 schemas)
- [x] 35 tests unitaires vitest (chunker, toolExecutor, toolCatalogue, httpActionService)
- [x] CORS configurable (ALLOWED_ORIGINS + *.gilo.dev)
- [x] Rate limiting (API key tier + public IP)
- [x] RGPD endpoints (export + delete)
- [x] Trust proxy (behind Caddy)
- [x] Helmet.js — headers HTTP sécurisés (HSTS, X-Frame-Options, etc.)
- [x] **Cloudflare Turnstile** — captcha anti-bot managed mode
- [x] **OAuth GitHub login** — authentification GitHub complète
- [x] **Forgot / Reset password** — flow email + page reset

#### ❌ Non réalisé
- [x] Redis pour cache, sessions, rate limiting (ioredis + sorted sets sliding window + fallback in-memory)
- [ ] Tests d'intégration API routes
- [ ] Tests E2E (Playwright) frontend
- [ ] Couverture > 80% (actuellement ~35 tests unitaires seulement)
- [ ] Application Insights / Sentry pour error tracking
- [ ] Prometheus métriques (req/s, latence P95/P99)
- [ ] Alertes PagerDuty/Slack si downtime
- [ ] Azure Key Vault pour secrets en production
- [ ] Preview deployments par PR

---

## ❌ Ce qui reste à faire

### 🔴 Priorité Haute
| Tâche | Phase | Effort estimé |
|-------|-------|---------------|
| Tests d'intégration routes API | 10 | 2-3 jours |

### ✅ Récemment complété (Haute/Moyenne)
| Tâche | Phase |
|-------|-------|
| ~~Redis cache + rate limiter persistent~~ | 10 |
| ~~Page Billing frontend (plans, checkout, portal)~~ | 9 |
| ~~OAuth GitHub provider~~ | 3 |
| ~~Helmet.js + headers sécurité~~ | 10 |
| ~~Templates d'agents prédéfinis~~ | 8 |
| ~~OAuth GitHub login~~ | 3 |
| ~~Cloudflare Turnstile captcha~~ | 10 |
| ~~Forgot / Reset password~~ | 3 |

### 🟡 Priorité Moyenne
| Tâche | Phase | Effort estimé |
|-------|-------|---------------|
| Agent Versioning (table, CRUD, rollback, diff) | 8 | 3-4 jours |
| Error tracking (Sentry/App Insights) | 10 | 1 jour |
| Connecteur Notion (Knowledge Base) | 5 | 2 jours |
| Connecteur Google Drive (Knowledge Base) | 5 | 2 jours |
| Deploy réel Azure pipeline (production) | 10 | 1-2 jours |

### 🟢 Priorité Basse
| Tâche | Phase | Effort estimé |
|-------|-------|---------------|
| Slack Bot (OAuth + event subscription) | 4 | 3-4 jours |
| Discord Bot (bot token + slash commands) | 4 | 3-4 jours |
| WhatsApp via Twilio | 4 | 2-3 jours |
| Collaboration équipe (teams, roles, invitations) | 8 | 4-5 jours |
| Plan Team Stripe ($99/mois) | 9 | 1 jour |
| Usage-based billing (metered) | 9 | 2 jours |
| Cloud storage (Azure Blob) au lieu de filesystem | 10 | 2 jours |
| Tests E2E Playwright frontend | 10 | 3-4 jours |
| Prometheus + Grafana monitoring | 10 | 2 jours |
| Monétisation agents privés (payant) | 2.5 | 2 jours |
| Scalable vector DB (Qdrant/Pinecone) | 5 | 2 jours |
| Azure Key Vault pour secrets | 10 | 1 jour |

---

## Stack technique actuelle

| Couche | Technologie | Statut |
|--------|-------------|--------|
| **Frontend** | React 18 + Vite + Tailwind + Zustand + i18n | ✅ |
| **Backend** | Express + TypeScript + Drizzle ORM | ✅ |
| **Validation** | Zod v4 (10 schemas, middleware centralisé) | ✅ |
| **Base de données** | PostgreSQL 16 + pgvector (15 tables) | ✅ |
| **Cache** | Redis 7 (ioredis) + in-memory fallback | ✅ |
| **Auth** | JWT + bcrypt + OAuth GitHub login + Turnstile captcha | ✅ |
| **AI** | GitHub Models API (GPT-4.1) + embeddings | ✅ |
| **Recherche** | pgvector (cosinus similarity) | ✅ |
| **Billing** | Stripe (checkout, portal, webhooks) | ✅ |
| **Déploiement** | Docker + Azure Container Apps + Bicep | ✅ |
| **CI/CD** | GitHub Actions (backend + frontend) | ✅ |
| **Reverse Proxy** | Caddy (auto HTTPS, subdomain routing) | ✅ |
| **Tests** | Vitest (35 tests unitaires) | ✅ (couverture partielle) |
| **Monitoring** | Console.log + Analytics service | ⚠️ Pas de Sentry |

---

## Historique des commits récents

| Date | Commit | Description |
|------|--------|-------------|
| 14 fév 2026 | *en cours* | Forgot/reset password + auto-open auth modal |
| 13 fév 2026 | `9d29793` | Long email overflow fix |
| 13 fév 2026 | `9e700a0` | Cloudflare Turnstile captcha anti-bot |
| 13 fév 2026 | `cd6a590` | Remove Google sign-in button |
| 13 fév 2026 | `5382f76` | GitHub OAuth login |
| 13 fév 2026 | `7844936` | 6 paid tier features |
| 13 fév 2026 | `0f3b090` | Daily message quotas |
| 13 fév 2026 | `70be5d5` | Security & billing audit |
| 13 fév 2026 | `57589b0` | Per-agent pricing ($3/agent/mo) + BYO LLM + billing overhaul |
| 13 fév 2026 | `10bd1bc` | Redis, GDPR, display name, star ratings, cost optimization || 12 fév 2026 | `d495575` | Stripe billing (checkout, portal, webhooks) |
| 12 fév 2026 | `c21cbbf` | Widget.js embeddable + embed snippet UI |
| 12 fév 2026 | `99501c1` | Zod validation middleware (10 schemas, 8 routes) |
| 12 fév 2026 | `2542c93` | Vitest + 35 tests unitaires backend |
| 12 fév 2026 | `5544e63` | Conversation persistence PostgreSQL |
| 12 fév 2026 | `a5d2c56` | Fix mobile MCP buttons + toolbar guide docs |

---

*Dernière mise à jour : 14 février 2026*