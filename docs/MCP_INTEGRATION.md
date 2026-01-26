# Intégration MCP (Model Context Protocol)

## Vue d'ensemble

Le système MCP permet aux utilisateurs de connecter leur AI Builder à des outils, ressources et systèmes de stockage externes via le Model Context Protocol.

## Architecture

```
┌──────────────────┐
│   Frontend UI    │
│  - MCPSettings   │  Configuration des serveurs
│  - MCPBrowser    │  Navigation des outils/ressources
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Backend API    │
│  /api/mcp/*      │  Routes MCP
│  /api/storage/*  │  Routes Storage
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   MCPService     │  Gestion des connexions
│  StorageService  │  Persistance des données
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  MCP Servers     │  Serveurs externes
│  - Filesystem    │
│  - GitHub        │
│  - Memory        │
│  - Custom...     │
└──────────────────┘
```

## Fonctionnalités

### 1. Gestion des Serveurs MCP

**Configuration des serveurs :**
- Ajout/suppression de serveurs MCP personnalisés
- Activation/désactivation dynamique
- Persistance des configurations
- Serveurs par défaut pré-configurés

**Serveurs par défaut :**
- `Filesystem` - Accès sécurisé aux fichiers
- `GitHub` - Intégration GitHub (repos, issues, PRs)
- `Memory` - Stockage en mémoire pour l'agent

### 2. Outils (Tools)

Les outils MCP permettent à l'agent d'exécuter des actions :
- Manipulation de fichiers
- Interactions avec APIs
- Opérations sur bases de données
- Exécution de commandes

**API :**
```typescript
GET  /api/mcp/tools           // Lister tous les outils
POST /api/mcp/tools/execute   // Exécuter un outil
```

### 3. Ressources (Resources)

Les ressources donnent accès à des données :
- Fichiers locaux
- Contenus de repos GitHub
- Bases de données
- APIs externes

**API :**
```typescript
GET  /api/mcp/resources      // Lister les ressources
POST /api/mcp/resources/read // Lire une ressource
```

### 4. Prompts

Les prompts sont des templates réutilisables :
- Prompts système prédéfinis
- Prompts personnalisés
- Prompts avec paramètres

**API :**
```typescript
GET  /api/mcp/prompts     // Lister les prompts
POST /api/mcp/prompts/get // Récupérer un prompt
```

### 5. Stockage (Storage)

Système de persistance pour les projets :
- Sauvegarde de fichiers
- Métadonnées de projets
- Historique des modifications
- Export/import de projets

**API :**
```typescript
POST   /api/storage/projects                    // Créer un projet
GET    /api/storage/projects                    // Lister les projets
GET    /api/storage/projects/:id                // Récupérer un projet
DELETE /api/storage/projects/:id                // Supprimer un projet
POST   /api/storage/projects/:id/files          // Sauvegarder un fichier
GET    /api/storage/projects/:id/files/:name    // Récupérer un fichier
DELETE /api/storage/projects/:id/files/:name    // Supprimer un fichier
PATCH  /api/storage/projects/:id/metadata       // Mettre à jour métadonnées
```

## Configuration

### Variables d'environnement

```bash
# Backend (.env)
MCP_STORAGE_DIR=/path/to/storage    # Répertoire de stockage (défaut: ./data)
GITHUB_TOKEN=ghp_xxx                 # Token GitHub pour serveur GitHub MCP
```

### Ajouter un serveur MCP personnalisé

**Via l'interface :**
1. Cliquer sur "Paramètres" dans le header
2. Cliquer sur "Ajouter un serveur MCP"
3. Remplir les informations :
   - Nom du serveur
   - Commande (ex: `npx`)
   - Arguments (ex: `-y @org/server-name`)
   - Description (optionnel)
4. Activer le serveur

**Via l'API :**
```typescript
POST /api/mcp/servers
{
  "name": "Mon Serveur",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-custom"],
  "description": "Description du serveur",
  "enabled": true,
  "env": {
    "API_KEY": "xxx"
  }
}
```

## Utilisation dans l'Agent

L'agent peut utiliser les outils MCP dans les tâches :

```typescript
// Envoyer une tâche avec outils MCP
POST /api/agent/task
{
  "sessionId": "xxx",
  "prompt": "Créer un composant React",
  "constraints": {
    "mcpTools": ["filesystem.write_file", "github.create_file"]
  }
}
```

## Exemples de serveurs MCP populaires

### Filesystem
```bash
npx -y @modelcontextprotocol/server-filesystem /workspace
```
- Lecture/écriture de fichiers
- Liste de répertoires
- Recherche de fichiers

### GitHub
```bash
npx -y @modelcontextprotocol/server-github
# Nécessite: GITHUB_PERSONAL_ACCESS_TOKEN
```
- Gestion des repos
- Issues et PRs
- Recherche de code

### Postgres
```bash
npx -y @modelcontextprotocol/server-postgres postgresql://user:pass@host/db
```
- Requêtes SQL
- Schéma de base
- Migrations

### Memory
```bash
npx -y @modelcontextprotocol/server-memory
```
- Stockage clé-valeur
- Mémoire de l'agent
- Context persistence

### Custom Servers

Créez vos propres serveurs MCP :
- Suivre le [MCP Protocol](https://modelcontextprotocol.io/)
- Implémenter tools/resources/prompts
- Publier sur npm
- Configurer dans l'app

## Sécurité

### Sandboxing
- Les serveurs MCP s'exécutent dans des processus isolés
- Permissions limitées par configuration
- Pas d'accès direct au système hôte

### Validation
- Les entrées sont validées avant exécution
- Timeout sur les opérations longues
- Logs de toutes les actions MCP

### Bonnes pratiques
1. Toujours examiner les serveurs MCP avant activation
2. Utiliser des variables d'environnement pour les secrets
3. Activer uniquement les serveurs nécessaires
4. Surveiller les logs pour détecter les anomalies

## Dépannage

### Le serveur ne se connecte pas
1. Vérifier que la commande est correcte
2. Vérifier les variables d'environnement
3. Consulter les logs backend
4. Tester la commande manuellement

### Aucun outil n'apparaît
1. Vérifier que le serveur est activé
2. Recharger la liste des serveurs
3. Vérifier les permissions
4. Consulter les logs de connexion

### Erreur d'exécution d'outil
1. Vérifier les paramètres de l'outil
2. Consulter le schéma d'entrée
3. Vérifier les permissions du serveur
4. Consulter les logs détaillés

## Roadmap

- [ ] Support des serveurs MCP distants (HTTP/WebSocket)
- [ ] Marketplace de serveurs MCP intégrés
- [ ] Monitoring et métriques des serveurs
- [ ] Auto-détection des serveurs disponibles
- [ ] Templates de configuration pré-définis
- [ ] Tests automatiques des serveurs
