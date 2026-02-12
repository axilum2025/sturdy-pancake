# GiLo AI — Agent Builder : Roadmap des Prochaines Phases

> **État actuel** : Phase 1 ✅ → Phase 2 ✅ → Phase 2.5 ✅ (partiel) → Phase 3 ✅ → Phase 4 ✅ → Phase 5 ✅ → **Phase 6** ✅
> **Dernière mise à jour** : Juin 2025

---

## Tableau de bord des phases

| Phase | Nom | Statut | Priorité |
|-------|-----|--------|----------|
| 1 | Rebrand UI | ✅ Terminé | — |
| 2 | Agent Builder fonctionnel | ✅ Terminé | — |
| 2.5 | Agent Store + Chat Interface | ✅ Core terminé | — |
| 3 | Persistance & Auth réelle | ✅ Terminé | — |
| 4 | Déploiement réel des agents | ✅ Terminé | — |
| **5** | **Knowledge Base & RAG** | ✅ **Terminé** | **—** |
| **6** | **Outils & MCP fonctionnel** | ✅ **Terminé** | **—** |
| 7 | Analytics & Monitoring | ⏳ Planifié | Moyenne |
| 8 | Versioning & Collaboration | ⏳ Planifié | Basse |
| 9 | Billing Stripe | ⏳ Planifié | Haute |
| 10 | Production & DevOps | ✅ Intégré Phase 3 | — |

---

## Résumé de ce qui existe aujourd'hui

### ✅ Phase 1 — Rebrand UI (terminé)
- Landing page "GiLo AI — Agent Builder" avec design system glass/gradient
- Dashboard avec stats (agents, conversations, déployés, tier)
- Design responsive mobile/tablette/desktop

### ✅ Phase 2 — Agent Builder fonctionnel (terminé)
| Composant | Description |
|-----------|-------------|
| **Agent Model** | CRUD complet en mémoire (`Map`), config (model/temperature/tools), status (draft/active/deployed), stats |
| **API REST Agents** | `GET/POST/PATCH/DELETE /api/agents` + `PATCH /config` + `POST /deploy` |
| **Agent Chat SSE** | `POST /api/agents/:id/chat` — streaming temps réel via OpenAI SDK |
| **AgentConfig UI** | 3 onglets : Instructions (system prompt), Modèle (GPT-4.1/Mini/Nano, température), Outils |
| **Playground UI** | Chat live SSE pour tester un agent, historique messages, clear |
| **Dashboard** | Liste des agents, stats, création rapide, lien vers Agent Store |
| **Copilot Chat** | ChatPanel avec streaming SSE vers GitHub Models API |
| **Auth Demo** | `demo@example.com` / `demo` — header `x-user-id` |

### ✅ Phase 2.5 — Agent Store (core terminé)
| Composant | Description |
|-----------|-------------|
| **Store Backend** | Modèle `StoreAgent` (in-memory), 8 agents samples, routes REST + SSE chat |
| **Agent Store UI** | Page `/store` — grille d'icônes style app mobile, catégories, recherche, trending |
| **Agent Detail** | Page `/store/:agentId` — fiche détaillée, stats, features, bouton Utiliser/Remixer |
| **Agent Chat** | Page `/store/:agentId/chat` — interface plein écran style ChatGPT/Gemini/Claude |
| **PublishModal** | Wizard 3 étapes (infos → features → visibilité) pour publier depuis le Builder |
| **Navigation** | Bouton Store dans Dashboard + Builder |

### ✅ Phase 3 — Persistance & Auth réelle (terminé)
- PostgreSQL 16 + Drizzle ORM (remplaçant toutes les `Map` in-memory)
- JWT auth réel avec bcrypt (remplaçant `x-user-id` header)
- Déploiement Azure : SWA (frontend) + Container Apps (backend) + PostgreSQL
- CI/CD GitHub Actions, Dockerfile multi-stage, Bicep IaC

### ⚠️ Partiellement implémenté (stubs/placeholders)
| Composant | État |
|-----------|------|
| **MCP Service** | ✅ Client MCP complet (JSON-RPC 2.0, stdio + HTTP) + 12 templates + catalogue |
| **Storage Service** | Filesystem local seulement, pas de cloud storage |
| **Agent Deploy** | Remplacé par PublishModal → Store (l'ancien deploy est retiré) |
| **Auth** | ✅ JWT réel avec bcrypt + jsonwebtoken (OAuth GitHub reporté Phase 4) |
| **Remix/Fork** | Bouton UI présent mais logique pas encore implémentée |
| **Accès privé** | Token validation côté backend, pas encore de monétisation |

### ❌ Manquant pour la production
- ~~Base de données~~ ✅ PostgreSQL + Drizzle ORM
- ~~Authentification réelle~~ ✅ JWT + bcrypt
- ~~CI/CD pipeline~~ ✅ GitHub Actions
- Déploiement réel des agents (API endpoint, webhook, widget)
- Knowledge Base / RAG
- Versioning des agents
- Analytics / monitoring
- Billing (Stripe)
- Tests automatisés

---

## Phase 2.5 — Agent Store ✅ (core)

**Objectif** : Créer un App Store pour les agents IA. Les agents déployés deviennent des "applications" téléchargeables et utilisables avec une interface chat style ChatGPT/Gemini/Claude.

**Statut** : Core implémenté ✅ — Remix et monétisation restants

### 2.5.1 Agent Store — Vitrine ✅
- [x] Page `/store` — grille d'icônes d'agents (style écran d'accueil mobile)
- [x] Affichage minimaliste : icône + nom (comme des apps)
- [x] Tap/clic ouvre la page détail de l'agent
- [x] Recherche et filtrage par catégorie
- [x] Sections : Trending, Top Rated, Toutes catégories
- [x] Responsive : mobile, tablette, desktop

### 2.5.2 Page Détail Agent (`/store/:agentId`) ✅
- [x] Avatar/icône grand format avec couleur gradient
- [x] Nom, description, features listées
- [x] Catégorie, créateur, stats (rating, utilisations, remixes)
- [x] Informations techniques (modèle, température)
- [x] Boutons : "Utiliser" (ouvre le chat), "Remixer" (fork l'agent)
- [x] Badge : Public / Privé
- [x] Si privé : champ pour entrer le token d'accès

### 2.5.3 Interface Chat Agent (`/store/:agentId/chat`) ✅
- [x] UI style ChatGPT/Gemini/Claude (plein écran, dark, épuré)
- [x] Streaming SSE temps réel
- [x] Historique de conversation local
- [x] Responsive : fonctionne sur mobile
- [x] Branding de l'agent (nom, icône dans le header)
- [x] Message d'accueil personnalisé

### 2.5.4 Publication d'Agent (PublishModal) ✅
- [x] Modal de publication depuis le Builder (3 étapes)
- [x] Icône avec couleur personnalisable
- [x] Description, features, catégorie, tags
- [x] Choix : Public (visible dans le Store) ou Privé (accès par token)
- [x] Chaque agent publié reçoit un ID unique permanent

### 2.5.5 Remix / Fork ⏳
- [ ] Bouton "Remixer" présent dans l'UI mais logique backend pas encore implémentée
- [ ] Créer une copie de l'agent dans le workspace de l'utilisateur
- [ ] Lien de parenté : "Remixé à partir de X par @creator"
- [ ] Le créateur original voit le nombre de remixes

### 2.5.6 Accès Privé & Monétisation ⏳
- [x] Token d'accès unique par agent privé (validation backend)
- [ ] Permissions : gratuit ou payant
- [ ] Si payant : intégration Stripe (lié à Phase 9)
- [ ] Révocation de tokens
- [ ] Dashboard créateur : revenus, analytics

---

## Phase 3 — Persistance & Auth Réelle ✅

**Objectif** : Rendre la plateforme utilisable en production avec des données persistantes et une auth sécurisée.

**Statut** : ✅ Terminé — Juin 2025

### 3.1 Base de données PostgreSQL + Drizzle ORM ✅
- [x] PostgreSQL 16 via Drizzle ORM (`drizzle-orm` + `pg`)
- [x] Schéma complet : `users`, `agents`, `storeAgents`, `conversations`, `messages`, `refreshTokens`
- [x] UUID PK, timestamps avec timezone, JSONB pour config/quotas/features
- [x] Relations définies : users↔agents, agents↔conversations, conversations↔messages
- [x] Migration complète depuis `Map` in-memory vers PostgreSQL
- [x] Seeds : 1 user demo + 1 sample agent + 8 store agents
- [x] Docker Compose pour PostgreSQL local en dev
- [x] Scripts : `db:push`, `db:seed`, `db:studio`, `db:setup`

### 3.2 Authentification JWT réelle ✅
- [x] `bcryptjs` pour hash de mots de passe (salt rounds: 12)
- [x] `jsonwebtoken` pour génération/vérification JWT (24h expiry)
- [x] Route `POST /api/auth/register` — hash password, créer user, retourner JWT
- [x] Route `POST /api/auth/login` — vérifier password, retourner JWT
- [x] Middleware `authMiddleware` — JWT verification, fallback `x-user-id` en dev seulement
- [x] Frontend : `AuthContext` mis à jour pour JWT seul
- [x] Frontend : suppression complète des headers `x-user-id`
- [x] Intercepteur 401 → déconnexion automatique
- [ ] OAuth GitHub (reporté à Phase 4)

### 3.3 Relations User ↔ Agent ✅
- [x] Chaque agent appartient à un `userId` (clé étrangère)
- [x] L'API filtre par `userId` du JWT (isolation multi-tenant)
- [x] Quotas réels basés sur le tier du user

### 3.4 Historique des conversations ⏳
- [x] Tables `conversations` et `messages` créées en DB
- [ ] Sauvegarde automatique des messages du Playground (reporté)
- [ ] UI historique dans le Playground (reporté)

### 3.5 Déploiement Azure (Production) ✅
- [x] **Dockerfile** multi-stage pour le backend (node:20-alpine)
- [x] **Bicep** template complet (`infra/main.bicep`) :
  - Azure Container Registry (Basic)
  - PostgreSQL Flexible Server (Burstable B1ms)
  - Log Analytics Workspace
  - Container Apps Environment + Container App (scale 0-5)
  - Azure Static Web Apps (Free tier pour frontend)
- [x] **CI/CD** GitHub Actions :
  - `deploy-backend.yml` : build Docker → push ACR → deploy Container Apps
  - `deploy-frontend.yml` : build Vite → deploy SWA
- [x] **Script** `scripts/setup-azure.sh` : provisioning initial complet
- [x] Frontend : `VITE_API_URL` dynamique pour production
- [x] Coût estimé : ~$25-35/mois (scale-to-zero)

---

## Phase 4 — Déploiement Réel des Agents

**Objectif** : Permettre aux utilisateurs de déployer leurs agents comme des API accessibles de l'extérieur.

**Durée estimée** : 1-2 semaines

### 4.1 API Endpoint pour chaque agent déployé
- [ ] Route publique `POST /api/v1/agents/:id/chat` (authentifié par API key, pas par JWT)
- [ ] Génération d'API keys par agent :
  - [ ] Route `POST /api/agents/:id/api-keys` — créer une clé
  - [ ] Route `DELETE /api/agents/:id/api-keys/:keyId` — révoquer
  - [ ] Route `GET /api/agents/:id/api-keys` — lister les clés
- [ ] Rate limiting par tier :
  ```
  free:  60 req/min,   1000 req/jour
  pro:  300 req/min,  10000 req/jour
  ```
- [ ] Headers de réponse : `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### 4.2 Widget d'intégration (embeddable chat)
- [ ] Créer `/public/widget.js` — script JS injectable sur n'importe quel site
- [ ] Le widget ouvre un chat bubble (iframe) qui parle à l'API de l'agent
- [ ] Personnalisation : couleur, position, message d'accueil
- [ ] Code d'intégration :
  ```html
  <script src="https://gilo.ai/widget.js" data-agent-id="xxx" data-key="yyy"></script>
  ```
- [ ] UI dans AgentConfig : onglet "Intégration" avec le code à copier

### 4.3 Webhook / Événements
- [ ] Configuration de webhooks par agent :
  - [ ] `on_conversation_start` — notifier quand quelqu'un engage l'agent
  - [ ] `on_escalation` — notifier quand l'agent escalade vers un humain
  - [ ] `on_error` — notifier en cas d'erreur
- [ ] Route `POST /api/agents/:id/webhooks` — CRUD webhooks
- [ ] Signature HMAC des payloads webhook pour sécurité

### 4.4 Intégrations tierces
- [ ] Slack Bot : connecter un agent comme bot Slack
  - [ ] OAuth Slack App
  - [ ] Event subscription (messages)
  - [ ] Réponse via l'agent
- [ ] Discord Bot : connecter un agent comme bot Discord
  - [ ] Bot token configuration
  - [ ] Slash commands
- [ ] WhatsApp (via Twilio) : agent sur WhatsApp Business
  - [ ] Twilio webhook integration

### 4.5 UI Déploiement
- [ ] Page "Déployer" dans Builder avec :
  - [ ] Statut de l'endpoint (actif/inactif)
  - [ ] URL de l'API + documentation auto-générée
  - [ ] Gestion des API keys
  - [ ] Code d'intégration (widget, curl, Python, Node.js)
  - [ ] Logs des derniers appels API

---

## Phase 5 — Knowledge Base & RAG

**Objectif** : Permettre aux agents d'accéder à des documents/données personnalisées via Retrieval-Augmented Generation.

**Durée estimée** : 1-2 semaines

### 5.1 Upload de documents
- [x] Route `POST /api/agents/:id/knowledge` — upload fichiers (PDF, TXT, MD, DOCX, CSV)
- [x] Parsing des documents :
  - [x] `pdf-parse` pour PDF
  - [x] `mammoth` pour DOCX
  - [x] CSV/JSON direct
- [x] Chunking intelligent : découpage en morceaux de ~500 tokens avec overlap de 50 tokens
- [x] Stockage des chunks en DB (table `knowledge_chunks`)

### 5.2 Embeddings & Recherche vectorielle
- [x] Générer des embeddings via GitHub Models API (`text-embedding-3-small`)
- [x] Option A (simple) : stockage embeddings + recherche cosinus en PG avec `pgvector`
- [ ] Option B (scalable) : intégration Qdrant / Pinecone / Azure AI Search
- [x] Route `POST /api/agents/:id/knowledge/search` — recherche sémantique pour test

### 5.3 Intégration RAG dans le chat
- [x] Avant chaque appel LLM, rechercher les 5 chunks les plus pertinents
- [x] Injecter comme contexte dans le system prompt
- [x] Citations structurées retournées via SSE (`type: 'citations'`)
- [x] Toggle RAG on/off selon `agent.config.knowledgeBase`

### 5.4 Connecteurs de données
- [x] URL Scraper : donner une URL et l'agent indexe le contenu (`cheerio`)
- [ ] Notion : connecter un workspace Notion comme knowledge base
- [ ] Google Drive : indexer des fichiers depuis Drive
- [ ] API custom : webhook pour push de données en continu

### 5.5 UI Knowledge Base
- [x] Onglet "Connaissances" dans AgentConfig :
  - [x] Upload drag & drop de fichiers
  - [x] Liste des documents indexés (nom, taille, chunks, date)
  - [x] Suppression de documents
  - [x] Barre de recherche pour tester le RAG
  - [x] Statut d'indexation (en cours / terminé / erreur)
  - [x] Scraper une URL depuis l'UI
  - [x] Stats : documents, chunks, tokens

---

## Phase 6 — Outils & MCP (Model Context Protocol) ✅

**Objectif** : Permettre aux agents d'exécuter des actions réelles via des outils MCP et des function calls.

**Durée estimée** : 1-2 semaines
**Statut** : ✅ Terminé — Juin 2025

### 6.1 Function Calling natif
- [x] Support `tools` dans l'appel OpenAI + boucle tool_call → exécution → retour LLM (max 10 rounds)
- [x] Types alignés : `AgentTool.type` = `'builtin' | 'http' | 'mcp'` (partout)
- [x] `toOpenAITools()` convertit les tools agent en format OpenAI function calling
- [x] `executeToolCalls()` exécute en parallèle, dispatch par type → builtin/http/mcp
- [x] SSE events : `tool_calls`, `tool_result` envoyés au frontend pendant l'exécution

### 6.2 MCP Service complet (JSON-RPC 2.0)
- [x] `mcpService.ts` — client MCP réel : stdio + HTTP transports
- [x] `connectServer()` — spawn process (stdio) ou fetch (HTTP), initialize + discover
- [x] `executeTool()`, `readResource()`, `getPrompt()` — appels JSON-RPC complets
- [x] Découverte automatique des tools/resources/prompts à la connexion
- [x] Nettoyage propre des child processes à la déconnexion

### 6.3 Catalogue d'outils built-in (16 outils, 6 catégories)
- [x] `toolCatalogue.ts` — 16 outils prêts à l'emploi :
  - Utilities : get_current_time, calculator, generate_uuid, base64, json_extract, string_utils
  - Data : fs_read, fs_write, fs_list, db_query (read-only SQL)
  - Communication : send_email (SendGrid)
  - Productivity : calendar_list_events, calendar_create_event (Google Calendar)
- [x] Route `GET /api/tools/catalogue` + `POST /api/agents/:id/tools/add-builtin`
- [x] UI catalogue dans AgentConfig > Outils avec filtrage par catégorie

### 6.4 Serveurs MCP — Templates & Installation
- [x] Fichier `data/mcp-server-templates.json` — 12 serveurs MCP populaires pré-configurés
  - filesystem, github, memory, postgres, brave-search, fetch, puppeteer, sqlite, slack, google-drive, google-maps, everything
- [x] Route `GET /api/mcp/templates` + `POST /api/mcp/templates/:id/install`
- [x] MCPSettings UI complète :
  - Sélecteur de transport (stdio / HTTP)
  - Champ URL pour HTTP transport
  - Variables d'environnement (KEY=value textarea)
  - Catalogue de templates avec installation en 1 clic
  - Configuration des clés API avant/après installation
  - Affichage du type de transport dans la liste

### 6.5 MCPBrowser — Navigation & ajout aux agents
- [x] 3 onglets : Outils, Ressources, Prompts
- [x] Bouton "Ajouter à l'agent" pour chaque outil MCP (crée un tool type `mcp` avec serverId + toolName)
- [x] Panneau de test intégré : saisie des paramètres + exécution directe + affichage résultat
- [x] Expansion/collapse par outil avec schéma des paramètres

### 6.6 Actions HTTP (API Connector)
- [x] Configurer des appels API comme outils : URL, méthode, headers, body template, auth
- [x] Import depuis OpenAPI/Swagger spec (`parseOpenAPISpec()`)
- [x] Test HTTP action endpoint (`POST /api/tools/test-http`)

### 6.7 Community Tools Marketplace
- [x] Table `communityTools` dans PostgreSQL
- [x] Routes : `GET /api/tools/community`, `POST /api/tools/publish`, `POST /api/tools/community/:id/install`
- [x] Rating, install count, catégories, recherche

---

## Phase 7 — Analytics & Monitoring ✅

**Objectif** : Donner de la visibilité sur l'utilisation et la performance des agents.

**Durée estimée** : 1 semaine

### 7.1 Métriques par agent
- [x] Conversations par jour/semaine/mois (graphique)
- [x] Messages envoyés / reçus
- [x] Temps de réponse moyen du LLM
- [x] Tokens consommés (input + output)
- [x] Coût estimé par conversation
- [x] Taux de satisfaction (thumbs up/down sur les réponses)

### 7.2 Dashboard Analytics
- [x] Nouvelle page `/analytics` avec :
  - [x] Vue globale (tous les agents)
  - [x] Filtrage par agent, période, canal
  - [x] Graphiques : ligne (conversations/jour), barres (messages/agent), pie (répartition canaux)
- [x] Librairie : `recharts` ou `chart.js` côté frontend

### 7.3 Logs & Debug
- [x] Route `GET /api/agents/:id/logs` — derniers appels avec :
  - [x] Input utilisateur
  - [x] System prompt utilisé
  - [x] Chunks RAG injectés
  - [x] Tool calls exécutés
  - [x] Réponse complète
  - [x] Latence, tokens, coût
- [x] UI : onglet "Logs" dans Builder avec filtrage par date/statut
- [x] Export CSV des logs

### 7.4 Alertes
- [x] Notifications email si :
  - [x] Agent dépasse le rate limit
  - [x] Taux d'erreur > 5%
  - [x] Coût journalier dépasse un seuil configuré
  - [x] Agent inactif depuis X jours

---

## Phase 8 — Versioning & Collaboration

**Objectif** : Permettre de versionner les agents et de collaborer en équipe.

**Durée estimée** : 1 semaine

### 8.1 Versioning des agents
- [ ] Table `agent_versions (id, agentId, version, configSnapshot, changelog, createdAt)`
- [ ] Chaque `PATCH /config` crée automatiquement une nouvelle version
- [ ] Route `GET /api/agents/:id/versions` — historique des versions
- [ ] Route `POST /api/agents/:id/versions/:v/rollback` — revenir à une version
- [ ] Diff visuel entre deux versions (system prompt, modèle, outils)
- [ ] UI : onglet "Versions" dans AgentConfig

### 8.2 Environnements (Draft / Staging / Production)
- [ ] Chaque agent a 3 environnements :
  - **Draft** : édition libre, pas exposé
  - **Staging** : pour tester avant production (URL de test)
  - **Production** : endpoint live
- [ ] Promotion d'un environnement à l'autre (Draft → Staging → Prod)
- [ ] UI : sélecteur d'environnement dans le Builder

### 8.3 Collaboration équipe (Tier Team)
- [ ] Table `team_members (teamId, userId, role: owner|editor|viewer)`
- [ ] Invitation par email
- [ ] Permissions granulaires :
  - **Owner** : tout
  - **Editor** : modifier agents, pas supprimer
  - **Viewer** : lecture seule + Playground
- [ ] Audit log : qui a modifié quoi et quand

### 8.4 Templates d'agents
- [ ] Agents pré-configurés pour démarrer rapidement :
  - [ ] Support Client (FAQ + escalation)
  - [ ] Assistant RH (questions employés)
  - [ ] Bot E-commerce (recommandations produits)
  - [ ] Assistant Dev (code review, debug)
  - [ ] Onboarding Bot (guide nouveaux utilisateurs)
- [ ] Route `GET /api/templates` — lister les templates
- [ ] Route `POST /api/agents/from-template/:templateId` — créer depuis template
- [ ] UI : galerie de templates sur la page Dashboard

---

## Phase 9 — Billing & Monétisation (Stripe)

**Objectif** : Mettre en place la facturation pour les tiers Pro et Team.

**Durée estimée** : 1 semaine

### 9.1 Intégration Stripe
- [ ] Installer `stripe` SDK
- [ ] Créer les produits/prix dans Stripe Dashboard :
  - [ ] Free : USD 0/mois (5 agents, 1K req/jour)
  - [ ] Pro : USD 29/mois (20 agents, 10K req/jour, RAG, analytics)
  - [ ] Team : USD 99/mois (50 agents, unlimited req, collaboration, SSO)
- [ ] Route `POST /api/billing/checkout` — créer Stripe Checkout Session
- [ ] Route `POST /api/billing/portal` — accès au Customer Portal Stripe
- [ ] Route `POST /api/webhooks/stripe` — gérer les événements :
  - [ ] `checkout.session.completed` → upgrade tier
  - [ ] `customer.subscription.deleted` → downgrade to free
  - [ ] `invoice.payment_failed` → notifier + grace period

### 9.2 Gestion des quotas
- [ ] Vérification en temps réel des limites :
  - [ ] Nombre d'agents
  - [ ] Requêtes API / jour
  - [ ] Volume de données Knowledge Base
  - [ ] Nombre de membres d'équipe
- [ ] Middleware `quotaGuard` qui bloque si limite dépassée
- [ ] UI : barre de progression des quotas sur le Dashboard
- [ ] Modal d'upgrade quand une limite est atteinte

### 9.3 Usage-based billing (optionnel)
- [ ] Facturation à l'utilisation pour les gros volumes :
  - [ ] USD 0.01 par conversation au-delà du quota
  - [ ] USD 0.001 par requête API au-delà du quota
- [ ] Stripe Metered Billing integration
- [ ] Dashboard de facturation avec détail des coûts

---

## Phase 10 — Production & DevOps

**Objectif** : Préparer la mise en production avec infrastructure, CI/CD, monitoring, et sécurité.

**Durée estimée** : 1-2 semaines

### 10.1 Infrastructure
- [ ] Containerisation Docker :
  - [ ] `Dockerfile` backend (Node.js 20 LTS)
  - [ ] `Dockerfile` frontend (nginx + static build)
  - [ ] `docker-compose.yml` (backend + frontend + postgres + redis)
- [ ] Déploiement cloud :
  - [ ] Option A : Azure Container Apps (auto-scale)
  - [ ] Option B : Railway / Render (simple)
  - [ ] Option C : VPS + Docker Compose (économique)
- [ ] Base de données PostgreSQL managée (Azure Database / Neon / Supabase)
- [ ] Redis pour cache, sessions, rate limiting

### 10.2 CI/CD
- [ ] GitHub Actions workflow :
  - [ ] `ci.yml` : lint + typecheck + tests sur chaque PR
  - [ ] `deploy.yml` : build + push Docker + deploy sur chaque merge main
  - [ ] `preview.yml` : deploy preview pour chaque PR
- [ ] Variables d'environnement sécurisées (GitHub Secrets)
- [ ] Rollback automatique si health check échoue

### 10.3 Sécurité
- [ ] Audit de sécurité :
  - [ ] Helmet.js pour headers HTTP
  - [ ] CORS strict (domaines autorisés)
  - [ ] Rate limiting global (express-rate-limit)
  - [ ] Input validation (zod) sur toutes les routes
  - [ ] SQL injection protection (ORM paramétré)
  - [ ] XSS protection (sanitize outputs)
- [ ] Gestion des secrets :
  - [ ] Variables d'environnement (jamais de secrets en code)
  - [ ] Azure Key Vault ou Doppler pour les secrets en prod
- [ ] RGPD :
  - [ ] Route `DELETE /api/users/me` — suppression de compte + toutes les données
  - [ ] Export des données utilisateur
  - [ ] Politique de rétention des logs (30 jours max)

### 10.4 Monitoring
- [ ] Health check endpoint `GET /api/health`
- [ ] Application Insights ou Sentry pour les erreurs
- [ ] Métriques Prometheus :
  - [ ] Requêtes/seconde
  - [ ] Latence P50/P95/P99
  - [ ] Taux d'erreur
  - [ ] Tokens consommés
- [ ] Alertes PagerDuty/Slack si downtime

### 10.5 Tests
- [ ] Backend :
  - [ ] Tests unitaires (vitest) pour models, services
  - [ ] Tests d'intégration pour les routes API
  - [ ] Tests E2E pour les flux critiques (créer agent → configurer → chat)
- [ ] Frontend :
  - [ ] Tests composants (vitest + testing-library)
  - [ ] Tests E2E (Playwright) : login → dashboard → create → playground
- [ ] Couverture cible : >80%

---

## Ordre de priorité recommandé

```
Phase 2.5 restants (Remix + Tokens) ← Finir le Store — rapide
  ↓
Phase 3 (Persistance + Auth)        ← Fondation — CRITIQUE
  ↓
Phase 4 (Déploiement réel)          ← Valeur #1 pour les utilisateurs
  ↓
Phase 5 (Knowledge Base / RAG)      ← Différenciateur clé
  ↓
Phase 6 (Outils & MCP)              ← Puissance des agents
  ↓
Phase 9 (Billing Stripe)            ← Monétisation
  ↓
Phase 7 (Analytics)                  ← Rétention
  ↓
Phase 8 (Versioning + Équipes)      ← Scale & entreprise
  ↓
Phase 10 (Production)               ← Go-live
```

---

## Stack technique cible

| Couche | Actuel | Cible |
|--------|--------|-------|
| **Frontend** | React + Vite + Tailwind | Idem + recharts |
| **Backend** | Express + TypeScript | Idem + drizzle-orm |
| **Base de données** | In-memory (Map) | PostgreSQL + pgvector |
| **Cache** | Aucun | Redis |
| **Auth** | Demo header | JWT + OAuth GitHub |
| **AI** | GitHub Models (GPT-4.1) | Idem + embeddings |
| **Recherche** | Aucune | pgvector / Azure AI Search |
| **Billing** | Aucun | Stripe |
| **Déploiement** | Local dev | Docker + Azure Container Apps |
| **CI/CD** | Aucun | GitHub Actions |
| **Monitoring** | Console.log | Sentry + Prometheus |
| **Tests** | Aucun | Vitest + Playwright |

---

## Estimation globale

| Phase | Effort | Statut | Impact |
|-------|--------|--------|--------|
| Phase 1 — Rebrand UI | ~3 jours | ✅ Terminé | ⭐⭐⭐ |
| Phase 2 — Agent Builder | ~1 semaine | ✅ Terminé | ⭐⭐⭐⭐⭐ |
| Phase 2.5 — Agent Store | ~1 semaine | ✅ Core fait | ⭐⭐⭐⭐ |
| Phase 3 — Persistance & Auth | ~1 semaine | 🎯 Prochaine | ⭐⭐⭐⭐⭐ |
| Phase 4 — Déploiement Agents | ~1-2 semaines | ⏳ Planifié | ⭐⭐⭐⭐⭐ |
| Phase 5 — Knowledge Base / RAG | ~1-2 semaines | ⏳ Planifié | ⭐⭐⭐⭐ |
| Phase 6 — Outils & MCP | ~1-2 semaines | ✅ Terminé | ⭐⭐⭐⭐ |
| Phase 7 — Analytics | ~1 semaine | ⏳ Planifié | ⭐⭐⭐ |
| Phase 8 — Versioning & Collab | ~1 semaine | ⏳ Planifié | ⭐⭐⭐ |
| Phase 9 — Billing Stripe | ~1 semaine | ⏳ Planifié | ⭐⭐⭐⭐⭐ |
| Phase 10 — Production | ~1-2 semaines | ⏳ Planifié | ⭐⭐⭐⭐⭐ |
| **Total restant** | **~8-12 semaines** | | |

---

*Dernière mise à jour : 8 février 2026*
