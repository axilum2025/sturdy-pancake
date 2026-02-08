#!/usr/bin/env bash
# ──────────────────────────────────────────────────
# GiLo AI Agent Builder – Azure Initial Setup Script
# Provisions all Azure resources via Bicep template
# ──────────────────────────────────────────────────
set -euo pipefail

# ── Colours ──────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}ℹ  $1${NC}"; }
ok()    { echo -e "${GREEN}✔  $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠  $1${NC}"; }
err()   { echo -e "${RED}✖  $1${NC}"; exit 1; }

# ── Configuration (override via env vars) ────────
PROJECT_NAME="${PROJECT_NAME:-gilo}"
ENVIRONMENT="${ENVIRONMENT:-prod}"
LOCATION="${LOCATION:-canadacentral}"
RESOURCE_GROUP="${RESOURCE_GROUP:-${PROJECT_NAME}-${ENVIRONMENT}-rg}"
DB_ADMIN_LOGIN="${DB_ADMIN_LOGIN:-giloadmin}"

# ── Pre-flight checks ───────────────────────────
command -v az   >/dev/null 2>&1 || err "Azure CLI (az) not found. Install: https://aka.ms/installazurecli"
command -v jq   >/dev/null 2>&1 || err "jq not found. Install: sudo apt install jq"

info "Checking Azure login..."
az account show >/dev/null 2>&1 || { warn "Not logged in – running 'az login'"; az login; }

SUBSCRIPTION=$(az account show --query name -o tsv)
ok "Using subscription: ${SUBSCRIPTION}"

# ── Generate secrets if not provided ─────────────
if [ -z "${DB_ADMIN_PASSWORD:-}" ]; then
  DB_ADMIN_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
  warn "Generated DB password (save it!): ${DB_ADMIN_PASSWORD}"
fi

if [ -z "${JWT_SECRET:-}" ]; then
  JWT_SECRET=$(openssl rand -hex 32)
  warn "Generated JWT secret (save it!): ${JWT_SECRET}"
fi

GITHUB_TOKEN="${GITHUB_TOKEN:-}"

# ── Create Resource Group ────────────────────────
info "Creating resource group: ${RESOURCE_GROUP} in ${LOCATION}..."
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --tags project="$PROJECT_NAME" environment="$ENVIRONMENT" managedBy=bicep \
  -o none
ok "Resource group ready"

# ── Deploy Bicep Template ────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BICEP_FILE="${SCRIPT_DIR}/../infra/main.bicep"

if [ ! -f "$BICEP_FILE" ]; then
  err "Bicep file not found: ${BICEP_FILE}"
fi

info "Deploying infrastructure (this takes 5-10 minutes)..."
DEPLOY_OUTPUT=$(az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file "$BICEP_FILE" \
  --parameters \
    environment="$ENVIRONMENT" \
    projectName="$PROJECT_NAME" \
    dbAdminLogin="$DB_ADMIN_LOGIN" \
    dbAdminPassword="$DB_ADMIN_PASSWORD" \
    jwtSecret="$JWT_SECRET" \
    githubToken="$GITHUB_TOKEN" \
  --query "properties.outputs" \
  -o json)

ok "Infrastructure deployed!"

# ── Extract Outputs ──────────────────────────────
ACR_LOGIN_SERVER=$(echo "$DEPLOY_OUTPUT" | jq -r '.acrLoginServer.value')
BACKEND_URL=$(echo "$DEPLOY_OUTPUT" | jq -r '.backendUrl.value')
FRONTEND_URL=$(echo "$DEPLOY_OUTPUT" | jq -r '.frontendUrl.value')
SWA_TOKEN=$(echo "$DEPLOY_OUTPUT" | jq -r '.swaDeploymentToken.value')
POSTGRES_HOST=$(echo "$DEPLOY_OUTPUT" | jq -r '.postgresHost.value')
CONTAINER_APP_NAME="${PROJECT_NAME}-${ENVIRONMENT}-api"
ACR_NAME=$(echo "$ACR_LOGIN_SERVER" | cut -d. -f1)

# ── Build & Push Initial Backend Image ───────────
info "Building and pushing backend Docker image..."
az acr login --name "$ACR_NAME"

BACKEND_DIR="${SCRIPT_DIR}/../backend"
docker build -t "${ACR_LOGIN_SERVER}/${PROJECT_NAME}-backend:latest" "$BACKEND_DIR"
docker push "${ACR_LOGIN_SERVER}/${PROJECT_NAME}-backend:latest"
ok "Backend image pushed"

# ── Run DB Setup ─────────────────────────────────
info "Waiting for container app to start..."
sleep 30

info "Running database migrations and seed..."
az containerapp exec \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --command "npx drizzle-kit push && node dist/db/seed.js" 2>/dev/null || \
  warn "Auto-migration failed – run manually after deployment"

# ── Print Summary ────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🚀 GiLo AI Agent Builder – Deployment Complete${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "  ${BLUE}Frontend URL:${NC}   ${FRONTEND_URL}"
echo -e "  ${BLUE}Backend URL:${NC}    ${BACKEND_URL}"
echo -e "  ${BLUE}ACR Server:${NC}     ${ACR_LOGIN_SERVER}"
echo -e "  ${BLUE}PostgreSQL:${NC}     ${POSTGRES_HOST}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}GitHub Repository Secrets to configure:${NC}"
echo ""
echo "  AZURE_CREDENTIALS    → Service principal JSON (az ad sp create-for-rbac)"
echo "  SWA_DEPLOYMENT_TOKEN → ${SWA_TOKEN}"
echo ""
echo -e "${YELLOW}GitHub Repository Variables to configure:${NC}"
echo ""
echo "  ACR_NAME             → ${ACR_NAME}"
echo "  CONTAINER_APP_NAME   → ${CONTAINER_APP_NAME}"
echo "  AZURE_RESOURCE_GROUP → ${RESOURCE_GROUP}"
echo "  BACKEND_URL          → ${BACKEND_URL}"
echo ""
echo -e "${YELLOW}Credentials (save securely!):${NC}"
echo ""
echo "  DB Admin:   ${DB_ADMIN_LOGIN}"
echo "  DB Password: ${DB_ADMIN_PASSWORD}"
echo "  JWT Secret:  ${JWT_SECRET}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Create a Service Principal:"
echo "     az ad sp create-for-rbac --name '${PROJECT_NAME}-deploy' \\"
echo "       --role contributor --scopes /subscriptions/\$(az account show --query id -o tsv)/resourceGroups/${RESOURCE_GROUP}"
echo ""
echo "  2. Add the output JSON as AZURE_CREDENTIALS GitHub secret"
echo "  3. Add SWA_DEPLOYMENT_TOKEN as GitHub secret"
echo "  4. Set GitHub repository variables (ACR_NAME, CONTAINER_APP_NAME, etc.)"
echo "  5. Push to main branch to trigger CI/CD!"
