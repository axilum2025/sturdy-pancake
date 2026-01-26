# AI App Builder (Lovable-style)

Application de type "Lovable" - Un constructeur d'applications IA utilisant le Copilot SDK et prête pour le déploiement sur Azure.

## 📋 Vue d'ensemble

Ce projet implémente une plateforme de construction d'applications pilotée par l'IA, inspirée de Lovable, utilisant l'approche du GitHub Copilot SDK décrite dans le fichier `Agentic.md`.

### Architecture

```
┌─────────────┐
│   Frontend  │  React + Vite + Tailwind
│  (Port 5173)│  - Chat Interface
└──────┬──────┘  - Preview Panel
       │         - Timeline View
       ▼
┌─────────────┐
│   Backend   │  Node.js + Express + TypeScript
│  (Port 3001)│  - Session Management
└──────┬──────┘  - Agent Orchestration
       │         - Copilot SDK Integration
       ▼
┌─────────────┐
│ Copilot SDK │  Execution Platform
└─────────────┘
```

## 🚀 Démarrage rapide

### Prérequis

- Node.js 20.x ou supérieur
- npm ou pnpm
- Un token GitHub (pour l'intégration Copilot SDK)

### Installation

1. **Cloner et installer les dépendances**
   ```bash
   npm run install:all
   ```

2. **Configurer les variables d'environnement**
   ```bash
   # Backend
   cd backend
   cp .env.example .env
   # Éditer .env avec votre token GitHub
   ```

3. **Lancer en mode développement**
   ```bash
   # À la racine du projet
   npm run dev
   ```
   
   Cela lancera :
   - Backend sur http://localhost:3001
   - Frontend sur http://localhost:5173

## 📂 Structure du projet

```
.
├── backend/                 # API Backend
│   ├── src/
│   │   ├── index.ts        # Point d'entrée
│   │   ├── routes/         # Routes API
│   │   │   ├── session.ts  # Gestion des sessions
│   │   │   └── agent.ts    # Endpoints de l'agent
│   │   └── services/       # Services métier
│   │       ├── sessionManager.ts
│   │       └── agentService.ts
│   └── package.json
│
├── frontend/               # Application React
│   ├── src/
│   │   ├── pages/         # Pages principales
│   │   │   ├── Home.tsx   # Page d'accueil
│   │   │   └── Builder.tsx # Interface de construction
│   │   ├── components/    # Composants UI
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── PreviewPanel.tsx
│   │   │   └── TimelinePanel.tsx
│   │   ├── services/      # Clients API
│   │   │   └── api.ts
│   │   └── store/         # State management (Zustand)
│   │       └── sessionStore.ts
│   └── package.json
│
├── .github/
│   └── workflows/
│       └── azure-deploy.yml  # Pipeline CI/CD
│
└── Agentic.md             # Blueprint technique de référence
```

## 🎯 Fonctionnalités principales

### Phase 1 - MVP (Actuel)
- ✅ Architecture frontend/backend complète
- ✅ Interface de chat pour les instructions
- ✅ Panneau d'aperçu en direct
- ✅ Timeline des actions de l'agent
- ✅ Gestion des sessions
- ✅ Pipeline de déploiement Azure
- ✅ **Intégration MCP complète (Model Context Protocol)**
  - Connexion à des serveurs MCP personnalisés
  - Outils (tools) pour actions externes
  - Ressources (resources) pour accès aux données
  - Prompts réutilisables
  - Système de stockage persistant

### Phase 2 - Intégration Copilot SDK
- ⏳ Connexion au Copilot SDK
- ⏳ Planification et exécution des tâches
- ⏳ Création/édition de fichiers
- ⏳ Exécution de commandes

### Phase 3 - Fonctionnalités avancées
- ⏳ Templates UI prédéfinis
- ⏳ Outils de design system
- ⏳ Déploiement automatique
- ⏳ Export de projets

## 🔧 API Endpoints

### Sessions
- `POST /api/sessions` - Créer une nouvelle session
- `GET /api/sessions/:sessionId` - Récupérer une session
- `DELETE /api/sessions/:sessionId` - Supprimer une session

### Agent
- `POST /api/agent/task` - Envoyer une tâche à l'agent
- `GET /api/agent/task/:taskId` - Statut d'une tâche
- `GET /api/agent/stream/:sessionId` - Stream SSE des événements

### MCP (Model Context Protocol)
- `GET /api/mcp/servers` - Liste des serveurs MCP
- `POST /api/mcp/servers` - Ajouter un serveur
- `PATCH /api/mcp/servers/:id` - Modifier un serveur
- `DELETE /api/mcp/servers/:id` - Supprimer un serveur
- `GET /api/mcp/tools` - Liste des outils disponibles
- `POST /api/mcp/tools/execute` - Exécuter un outil
- `GET /api/mcp/resources` - Liste des ressources
- `POST /api/mcp/resources/read` - Lire une ressource
- `GET /api/mcp/prompts` - Liste des prompts

### Storage
- `POST /api/storage/projects` - Créer un projet
- `GET /api/storage/projects` - Lister les projets
- `GET /api/storage/projects/:id` - Récupérer un projet
- `POST /api/storage/projects/:id/files` - Sauvegarder un fichier

## 🌐 Déploiement sur Azure

### Configuration requise

1. **Créer une Web App Azure**
   ```bash
   az webapp create \
     --resource-group <your-rg> \
     --plan <your-plan> \
     --name lovable-ai-builder \
     --runtime "NODE:20-lts"
   ```

2. **Configurer les secrets GitHub**
   - `AZURE_WEBAPP_PUBLISH_PROFILE`
   - `AZURE_CREDENTIALS`
   - `AZURE_RESOURCE_GROUP`

3. **Déploiement automatique**
   Le workflow GitHub Actions se déclenche automatiquement sur chaque push vers `main`.

### Variables d'environnement Azure

Configurez ces variables dans Azure Web App :
```
PORT=8080
NODE_ENV=production
GITHUB_TOKEN=<votre-token>
ALLOWED_ORIGINS=https://lovable-ai-builder.azurewebsites.net
MCP_STORAGE_DIR=/home/data
```

## 🔌 Intégration MCP

Le système MCP permet de connecter votre AI à des outils et ressources externes.

### Serveurs MCP disponibles

**Configuration via l'interface :**
1. Cliquer sur "Paramètres" dans le Builder
2. Ajouter et configurer vos serveurs MCP
3. Activer les serveurs souhaités

**Serveurs populaires :**
- `@modelcontextprotocol/server-filesystem` - Accès fichiers
- `@modelcontextprotocol/server-github` - Intégration GitHub
- `@modelcontextprotocol/server-memory` - Stockage mémoire
- `@modelcontextprotocol/server-postgres` - Base de données

**Documentation complète :** [docs/MCP_INTEGRATION.md](docs/MCP_INTEGRATION.md)

## 🛠️ Développement

### Scripts disponibles

**Racine du projet :**
```bash
npm run dev              # Lance backend + frontend en parallèle
npm run build            # Build backend + frontend
npm run install:all      # Installe toutes les dépendances
```

**Backend :**
```bash
cd backend
npm run dev             # Mode développement avec hot-reload
npm run build           # Compiler TypeScript
npm run start           # Démarrer en production
npm run lint            # Linter le code
```

**Frontend :**
```bash
cd frontend
npm run dev             # Serveur de développement Vite
npm run build           # Build de production
npm run preview         # Aperçu du build
npm run lint            # Linter le code
```

## 📖 Concepts clés

### Agent Session Model

Chaque projet utilisateur = une session d'agent persistante avec :
- Mémoire contextuelle
- Permissions sandbox
- Commandes autorisées

### Task Decomposition

Les intentions utilisateur sont enveloppées dans des contrats de tâches avec :
- Contraintes de stack technique
- Exigences (accessibilité, mobile-first, etc.)
- Permissions d'exécution

### Outils domaine-spécifiques

L'agent utilise des outils métier plutôt que génériques :
- `create_ui_section` - Création de sections UI
- `apply_design_system` - Application de thèmes
- `deploy_preview` - Déploiement de preview

## 🔒 Sécurité

- Filesystem sandbox pour l'agent
- Allowlist de commandes autorisées
- Pas d'accès aux secrets
- Confirmation requise pour les déploiements prod
- Isolation par session

## 📝 Référence

Ce projet implémente les concepts décrits dans [Agentic.md](Agentic.md), qui fournit :
- Le blueprint architectural complet
- Les principes de design
- Les patterns d'intégration Copilot SDK
- Les meilleures pratiques

## 🤝 Contribution

Pour contribuer :
1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

ISC

## 🔗 Liens utiles

- [Documentation Copilot SDK](https://github.com/features/copilot)
- [Azure Web Apps](https://azure.microsoft.com/services/app-service/web/)
- [Vite](https://vitejs.dev/)
- [React](https://react.dev/)

---

**Status du projet :** 🚧 En développement actif

**Prochaines étapes :**
1. Intégrer le Copilot SDK réel
2. Implémenter les outils domaine-spécifiques
3. Ajouter le streaming temps réel des événements
4. Déployer sur Azure
