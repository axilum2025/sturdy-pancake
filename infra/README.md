# Infrastructure Azure — GiLo AI Agent Builder

Architecture **Option B — Hybride** pour un coût minimal (~$25-35/mois) :

| Ressource | Service Azure | SKU |
|-----------|--------------|-----|
| Frontend | Static Web Apps | Free |
| Backend API | Container Apps | Scale 0→5 |
| Base de données | PostgreSQL Flexible Server | Burstable B1ms |
| Registry | Container Registry | Basic |
| Logs | Log Analytics Workspace | PerGB2018 |

## Prérequis

- [Azure CLI](https://aka.ms/installazurecli) ≥ 2.50
- Docker
- `jq` (`sudo apt install jq`)

## Déploiement initial

```bash
# 1. Se connecter à Azure
az login

# 2. Lancer le script de setup (provisionne tout)
./scripts/setup-azure.sh

# 3. Le script affichera les secrets/variables GitHub à configurer
```

## Variables d'environnement

### Backend (Container App)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL PostgreSQL (secret) |
| `JWT_SECRET` | Clé secrète JWT (secret) |
| `GITHUB_TOKEN` | Token GitHub Models API (secret) |
| `NODE_ENV` | `production` |
| `PORT` | `3001` |

### Frontend (build Vite)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | URL complète du backend (ex: `https://gilo-prod-api.azurecontainerapps.io`) |

## GitHub Actions — Secrets & Variables

### Secrets (Settings → Secrets and variables → Actions → Secrets)

| Secret | Source |
|--------|--------|
| `AZURE_CREDENTIALS` | `az ad sp create-for-rbac --name gilo-deploy --role contributor ...` |
| `SWA_DEPLOYMENT_TOKEN` | Affiché par `setup-azure.sh` ou portail Azure |

### Variables (Settings → Secrets and variables → Actions → Variables)

| Variable | Exemple |
|----------|---------|
| `ACR_NAME` | `giloprodacr` |
| `CONTAINER_APP_NAME` | `gilo-prod-api` |
| `AZURE_RESOURCE_GROUP` | `gilo-prod-rg` |
| `BACKEND_URL` | `https://gilo-prod-api.azurecontainerapps.io` |

## Déploiement manuel (Bicep)

```bash
az deployment group create \
  --resource-group gilo-prod-rg \
  --template-file infra/main.bicep \
  --parameters @infra/parameters.json
```

## Coûts estimés

| Ressource | Coût/mois |
|-----------|-----------|
| Static Web Apps (Free) | $0 |
| Container Apps (scale-to-zero) | ~$5-15 |
| PostgreSQL B1ms | ~$15-20 |
| Container Registry Basic | ~$5 |
| **Total** | **~$25-35** |
