#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# GiLo AI — Custom Domain Setup Script
# Configures Azure resources for gilo.dev custom domain
# ──────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="gilo.dev"
RG="gilo-prod-rg"
SWA_NAME="gilo-prod-web"
CA_NAME="gilo-prod-api"
CA_ENV_NAME="gilo-prod-env"

echo "╔══════════════════════════════════════════════════════╗"
echo "║  GiLo AI — Custom Domain Configuration              ║"
echo "║  Domain: ${DOMAIN}                                   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. Gather Azure info ──────────────────────────────────────
echo "📋 Gathering Azure resource information..."

SWA_HOSTNAME=$(az staticwebapp show --name "$SWA_NAME" --resource-group "$RG" \
  --query "defaultHostname" -o tsv)

CA_FQDN=$(az containerapp show --name "$CA_NAME" --resource-group "$RG" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

CA_STATIC_IP=$(az containerapp env show --name "$CA_ENV_NAME" --resource-group "$RG" \
  --query "properties.staticIp" -o tsv)

CA_VERIFICATION_ID=$(az containerapp env show --name "$CA_ENV_NAME" --resource-group "$RG" \
  --query "properties.customDomainConfiguration.customDomainVerificationId" -o tsv)

echo ""
echo "  SWA Default Hostname : ${SWA_HOSTNAME}"
echo "  Container App FQDN   : ${CA_FQDN}"
echo "  Container App IP     : ${CA_STATIC_IP}"
echo "  Verification ID      : ${CA_VERIFICATION_ID}"
echo ""

# ── 2. Print GoDaddy DNS configuration ───────────────────────
echo "══════════════════════════════════════════════════════════"
echo "  STEP 1: Configure these DNS records on GoDaddy"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "  ⚠️  Go to https://dcc.godaddy.com/manage/${DOMAIN}/dns/records"
echo "  ⚠️  DELETE the 'A' record with 'Parked' data first!"
echo ""
echo "  ┌──────────┬───────────────────┬──────────────────────────────────────────────────────┬──────┐"
echo "  │ Type     │ Name              │ Data                                                 │ TTL  │"
echo "  ├──────────┼───────────────────┼──────────────────────────────────────────────────────┼──────┤"
echo "  │ CNAME    │ www               │ ${SWA_HOSTNAME}                                       │ 1h   │"
echo "  │ CNAME    │ api               │ ${CA_FQDN}                                            │ 1h   │"
echo "  │ TXT      │ asuid             │ ${CA_VERIFICATION_ID}                                 │ 1h   │"
echo "  │ TXT      │ asuid.api         │ ${CA_VERIFICATION_ID}                                 │ 1h   │"
echo "  │ TXT      │ asuid.www         │ ${SWA_HOSTNAME}                                       │ 1h   │"
echo "  └──────────┴───────────────────┴──────────────────────────────────────────────────────┴──────┘"
echo ""
echo "  Keep existing records:"
echo "    ✅ NS records (ns33/ns34.domaincontrol.com)"
echo "    ✅ SOA record"
echo "    ✅ TXT _dmarc record"
echo "    ✅ TXT verification token (_glqq7l9dr657...)"
echo ""
echo "  Delete these records:"
echo "    ❌ A record '@' → Parked"
echo "    ❌ CNAME '_domainconnect' → _domainconnect.gd.domaincontrol.com"
echo "    ❌ CNAME 'www' → gilo.dev (replace with new one above)"
echo ""

# ── 3. Wait for DNS propagation ──────────────────────────────
echo "══════════════════════════════════════════════════════════"
echo "  STEP 2: After updating GoDaddy, press Enter to continue"
echo "══════════════════════════════════════════════════════════"
read -r -p "  Press Enter when DNS records are configured on GoDaddy..."

echo ""
echo "⏳ Checking DNS propagation (this may take a few minutes)..."

# Check www CNAME
echo -n "  Checking www.${DOMAIN}... "
for i in $(seq 1 12); do
  RESULT=$(dig +short www.${DOMAIN} CNAME 2>/dev/null | head -1)
  if [[ -n "$RESULT" && "$RESULT" == *"azurestaticapps.net"* ]]; then
    echo "✅ OK → ${RESULT}"
    break
  fi
  if [[ $i -eq 12 ]]; then
    echo "⚠️  Not yet propagated (${RESULT:-empty}). You may need to wait longer."
  else
    echo -n "."
    sleep 10
  fi
done

# Check api CNAME
echo -n "  Checking api.${DOMAIN}... "
for i in $(seq 1 12); do
  RESULT=$(dig +short api.${DOMAIN} CNAME 2>/dev/null | head -1)
  if [[ -n "$RESULT" && "$RESULT" == *"azurecontainerapps.io"* ]]; then
    echo "✅ OK → ${RESULT}"
    break
  fi
  if [[ $i -eq 12 ]]; then
    echo "⚠️  Not yet propagated (${RESULT:-empty}). You may need to wait longer."
  else
    echo -n "."
    sleep 10
  fi
done

# ── 4. Configure Azure custom domains ────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════"
echo "  STEP 3: Configuring Azure custom domains"
echo "══════════════════════════════════════════════════════════"

# 4a. SWA – www.gilo.dev
echo ""
echo "📌 Adding www.${DOMAIN} to Static Web App..."
az staticwebapp hostname set \
  --name "$SWA_NAME" \
  --resource-group "$RG" \
  --hostname "www.${DOMAIN}" \
  2>&1 && echo "  ✅ www.${DOMAIN} added to SWA" || echo "  ⚠️  Failed (DNS may not be propagated yet)"

# 4b. Container App – api.gilo.dev (add hostname first, then managed certificate)
echo ""
echo "📌 Adding api.${DOMAIN} to Container App..."
az containerapp hostname add \
  --name "$CA_NAME" \
  --resource-group "$RG" \
  --hostname "api.${DOMAIN}" \
  2>&1 && echo "  ✅ api.${DOMAIN} hostname added" || echo "  ⚠️  Failed – try again after DNS propagation"

echo ""
echo "📌 Binding managed certificate for api.${DOMAIN}..."
az containerapp hostname bind \
  --name "$CA_NAME" \
  --resource-group "$RG" \
  --hostname "api.${DOMAIN}" \
  --environment "$CA_ENV_NAME" \
  --validation-method CNAME \
  2>&1 && echo "  ✅ Managed certificate bound for api.${DOMAIN}" || echo "  ⚠️  Certificate binding failed – you can retry later"

# ── 5. Summary ────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════"
echo "  ✅ Custom Domain Configuration Summary"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "  Frontend:"
echo "    https://${DOMAIN}     → SWA (${SWA_HOSTNAME})"
echo "    https://www.${DOMAIN} → SWA (${SWA_HOSTNAME})"
echo ""
echo "  Backend API:"
echo "    https://api.${DOMAIN} → Container App (${CA_FQDN})"
echo ""
echo "  Agent subdomains:"
echo "    https://{slug}.${DOMAIN} → Requires wildcard CNAME (manual step)"
echo ""
echo "  ⚠️  Note: SSL certificates are managed automatically by Azure."
echo "     Provisioning may take up to 15 minutes."
echo ""
echo "  🔍 To verify:"
echo "     curl -I https://www.${DOMAIN}"
echo "     curl -I https://api.${DOMAIN}/api/health"
echo ""
