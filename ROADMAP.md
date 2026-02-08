# GiLo AI — Agent Builder : Roadmap des Prochaines Phases

> **État actuel** : Phase 1 (Rebrand UI) ✅ + Phase 2 (Agent Builder fonctionnel) ✅
> **Commit courant** : `dd03c66` sur `main`
> **Date** : 8 février 2026

---

## Résumé de ce qui existe aujourd'hui

### ✅ Fonctionnel
| Composant | Description |
|-----------|-------------|
| **Agent Model** | CRUD complet en mémoire (`Map`), config (model/temperature/tools), status (draft/active/deployed), stats |
| **API REST Agents** | `GET/POST/PATCH/DELETE /api/agents` + `PATCH /config` + `POST /deploy` |
| **Agent Chat SSE** | `POST /api/agents/:id/chat` — streaming temps réel via OpenAI SDK |
| **AgentConfig UI** | 3 onglets : Instructions (system prompt), Modèle (GPT-4.1/Mini/Nano, température), Outils |
| **Playground UI** | Chat live SSE pour tester un agent, historique messages, clear |
| **Dashboard** | Liste des agents, stats (agents/conversations/déployés), création rapide |
| **Landing Page** | Rebrandée "Agent Builder" avec features, stats, témoignages |
| **Copilot Chat** | ChatPanel avec streaming SSE vers GitHub Models API |
| **Auth Demo** | `demo@example.com` / `demo` — header `x-user-id` |

### ⚠️ Partiellement implémenté (stubs/placeholders)
| Composant | État |
|-----------|------|
| **MCP Service** | Interfaces définies, toutes les méthodes retournent des placeholders |
| **Deployment Service** | Logique de base mais `TODO: Integrate with Azure Static Web Apps API` |
| **Storage Service** | Filesystem local seulement, pas de cloud storage |
| **Agent Deploy** | Change le status à "deployed" + génère un endpoint fictif, pas de vrai déploiement |
| **Auth** | Demo uniquement, pas de JWT/OAuth réel, pas de hash de mot de passe |

### ❌ Manquant
- Base de données (tout est en mémoire — perdu au restart)
- Authentification réelle (OAuth GitHub / Google, JWT)
- Déploiement réel des agents (API endpoint, webhook, widget)
- Knowledge Base / RAG
- Versioning des agents
- Analytics / monitoring
- Billing (Stripe)
- Tests automatisés

---

## Phase 3 — Persistance & Auth Réelle

**Objectif** : Rendre la plateforme utilisable en production avec des données persistantes et une auth sécurisée.

**Durée estimée** : 1 semaine

### 3.1 Base de données SQLite/PostgreSQL
- [ ] Installer `better-sqlite3` (dev) ou `pg` (prod) + `drizzle-orm` comme ORM
- [ ] Créer le schéma :
  ```
  users (id, email, passwordHash, tier, createdAt)
  agents (id, userId, name, description, status, configJson, createdAt, updatedAt)
  conversations (id, agentId, userId, startedAt, messageCount)
  messages (id, conversationId, role, content, createdAt)
  agent_tools (id, agentId, name, type, configJson, enabled)
  api_keys (id, userId, keyHash, name, permissions, createdAt, lastUsedAt)
  ```
- [ ] Migration depuis les `Map` in-memory vers les tables
- [ ] Seeds : agent sample, user demo

### 3.2 Authentification réelle
- [ ] Installer `bcrypt` + `jsonwebtoken`
- [ ] Route `POST /api/auth/register` — hash password, créer user, retourner JWT
- [ ] Route `POST /api/auth/login` — vérifier password, retourner JWT + refresh token
- [ ] Middleware `authMiddleware` — vérifier JWT au lieu de `x-user-id` header
- [ ] OAuth GitHub (optionnel Phase 3, recommandé Phase 4) :
  - [ ] GitHub App registration
  - [ ] Route `GET /api/auth/github` → redirect OAuth
  - [ ] Route `GET /api/auth/github/callback` → exchange code → JWT
- [ ] Frontend : `AuthContext` mis à jour pour JWT (localStorage + auto-refresh)
- [ ] Frontend : `AuthModal` mis à jour avec vrai login/register

### 3.3 Relations User ↔ Agent
- [ ] Chaque agent appartient à un `userId`
- [ ] L'API filtre par `userId` du JWT (isolation multi-tenant)
- [ ] Quotas réels basés sur le tier du user (free=5, pro=20 agents)

### 3.4 Historique des conversations
- [ ] Sauvegarder chaque message du Playground en DB
- [ ] Route `GET /api/agents/:id/conversations` — lister les conversations passées
- [ ] Route `GET /api/conversations/:id/messages` — relire une conversation
- [ ] UI : onglet "Historique" dans le Playground pour revoir les conversations passées

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
- [ ] Route `POST /api/agents/:id/knowledge` — upload fichiers (PDF, TXT, MD, DOCX, CSV)
- [ ] Parsing des documents :
  - [ ] `pdf-parse` pour PDF
  - [ ] `mammoth` pour DOCX
  - [ ] CSV/JSON direct
- [ ] Chunking intelligent : découpage en morceaux de ~500 tokens avec overlap de 50 tokens
- [ ] Stockage des chunks en DB (table `knowledge_chunks`)

### 5.2 Embeddings & Recherche vectorielle
- [ ] Générer des embeddings via GitHub Models API (`text-embedding-3-small`)
- [ ] Option A (simple) : stockage embeddings + recherche cosinus en SQLite/PG avec `pgvector`
- [ ] Option B (scalable) : intégration Qdrant / Pinecone / Azure AI Search
- [ ] Route `POST /api/agents/:id/knowledge/search` — recherche sémantique pour test

### 5.3 Intégration RAG dans le chat
- [ ] Avant chaque appel LLM, rechercher les 5 chunks les plus pertinents
- [ ] Injecter comme contexte dans le system prompt :
  ```
  [Documents pertinents]
  1. {chunk.content} (source: {chunk.filename}, page {chunk.page})
  2. ...
  ```
- [ ] Ajouter les citations dans la réponse de l'agent
- [ ] Toggle RAG on/off dans AgentConfig

### 5.4 Connecteurs de données
- [ ] URL Scraper : donner une URL et l'agent indexe le contenu
- [ ] Notion : connecter un workspace Notion comme knowledge base
- [ ] Google Drive : indexer des fichiers depuis Drive
- [ ] API custom : webhook pour push de données en continu

### 5.5 UI Knowledge Base
- [ ] Onglet "Connaissances" dans AgentConfig :
  - [ ] Upload drag & drop de fichiers
  - [ ] Liste des documents indexés (nom, taille, chunks, date)
  - [ ] Suppression de documents
  - [ ] Barre de recherche pour tester le RAG
  - [ ] Statut d'indexation (en cours / terminé / erreur)

---

## Phase 6 — Outils & MCP (Model Context Protocol)

**Objectif** : Permettre aux agents d'exécuter des actions réelles via des outils MCP et des function calls.

**Durée estimée** : 1-2 semaines

### 6.1 Function Calling natif
- [ ] Implémenter le support `tools` dans l'appel OpenAI :
  ```typescript
  tools: agent.config.tools.map(t => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.schema }
  }))
  ```
- [ ] Gérer la boucle tool_call → exécution → retour au LLM
- [ ] Définition de tools via JSON Schema dans AgentConfig :
  - [ ] Éditeur de schema visuel (nom, description, paramètres, type)
  - [ ] Preview du JSON généré
  - [ ] Test d'exécution dans le Playground

### 6.2 Serveurs MCP intégrés
- [ ] Remplacer les placeholders `mcpService.ts` par de vrais clients MCP
- [ ] Serveurs MCP built-in :
  - [ ] **Filesystem** : lecture/écriture de fichiers dans le sandbox de l'agent
  - [ ] **HTTP/API** : appel d'APIs REST externes (GET/POST avec auth)
  - [ ] **Database** : requêtes SQL sur une DB configurée par l'utilisateur
  - [ ] **Email** : envoi d'emails via SMTP/SendGrid
  - [ ] **Calendar** : lecture/création d'événements (Google Calendar API)
- [ ] Chaque serveur MCP configurable dans AgentConfig > Outils

### 6.3 Marketplace d'outils
- [ ] Catalogue public d'outils MCP préfabriqués
- [ ] Route `GET /api/marketplace/tools` — lister les outils disponibles
- [ ] Installation en 1 clic dans un agent
- [ ] Catégories : Productivité, Support, E-commerce, Marketing, Dev
- [ ] Outils communautaires : permettre aux users de publier leurs outils

### 6.4 Actions HTTP (API Connector)
- [ ] Configurer des appels API comme outils d'agent :
  - [ ] URL, méthode, headers, body template
  - [ ] Auth : API key, Bearer token, OAuth2
  - [ ] Mapping des paramètres LLM → paramètres HTTP
- [ ] Import depuis OpenAPI/Swagger spec
- [ ] Test dans le Playground avec logs détaillés

---

## Phase 7 — Analytics & Monitoring

**Objectif** : Donner de la visibilité sur l'utilisation et la performance des agents.

**Durée estimée** : 1 semaine

### 7.1 Métriques par agent
- [ ] Conversations par jour/semaine/mois (graphique)
- [ ] Messages envoyés / reçus
- [ ] Temps de réponse moyen du LLM
- [ ] Tokens consommés (input + output)
- [ ] Coût estimé par conversation
- [ ] Taux de satisfaction (thumbs up/down sur les réponses)

### 7.2 Dashboard Analytics
- [ ] Nouvelle page `/analytics` avec :
  - [ ] Vue globale (tous les agents)
  - [ ] Filtrage par agent, période, canal
  - [ ] Graphiques : ligne (conversations/jour), barres (messages/agent), pie (répartition canaux)
- [ ] Librairie : `recharts` ou `chart.js` côté frontend

### 7.3 Logs & Debug
- [ ] Route `GET /api/agents/:id/logs` — derniers appels avec :
  - [ ] Input utilisateur
  - [ ] System prompt utilisé
  - [ ] Chunks RAG injectés
  - [ ] Tool calls exécutés
  - [ ] Réponse complète
  - [ ] Latence, tokens, coût
- [ ] UI : onglet "Logs" dans Builder avec filtrage par date/statut
- [ ] Export CSV des logs

### 7.4 Alertes
- [ ] Notifications email si :
  - [ ] Agent dépasse le rate limit
  - [ ] Taux d'erreur > 5%
  - [ ] Coût journalier dépasse un seuil configuré
  - [ ] Agent inactif depuis X jours

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
Phase 3 (Persistance + Auth)     ← Fondation — CRITIQUE
  ↓
Phase 4 (Déploiement réel)       ← Valeur #1 pour les utilisateurs
  ↓
Phase 5 (Knowledge Base / RAG)   ← Différenciateur clé
  ↓
Phase 6 (Outils & MCP)           ← Puissance des agents
  ↓
Phase 9 (Billing Stripe)         ← Monétisation
  ↓
Phase 7 (Analytics)              ← Rétention
  ↓
Phase 8 (Versioning + Équipes)   ← Scale & entreprise
  ↓
Phase 10 (Production)            ← Go-live
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

| Phase | Effort | Impact |
|-------|--------|--------|
| Phase 3 — Persistance & Auth | ~1 semaine | ⭐⭐⭐⭐⭐ |
| Phase 4 — Déploiement Agents | ~1-2 semaines | ⭐⭐⭐⭐⭐ |
| Phase 5 — Knowledge Base / RAG | ~1-2 semaines | ⭐⭐⭐⭐ |
| Phase 6 — Outils & MCP | ~1-2 semaines | ⭐⭐⭐⭐ |
| Phase 7 — Analytics | ~1 semaine | ⭐⭐⭐ |
| Phase 8 — Versioning & Collab | ~1 semaine | ⭐⭐⭐ |
| Phase 9 — Billing Stripe | ~1 semaine | ⭐⭐⭐⭐⭐ |
| Phase 10 — Production | ~1-2 semaines | ⭐⭐⭐⭐⭐ |
| **Total** | **~8-12 semaines** | |

---

*Dernière mise à jour : 8 février 2026*
