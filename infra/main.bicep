// ──────────────────────────────────────────────────
// GiLo AI Agent Builder – Azure Infrastructure
// Option B: Hybrid (SWA + Container Apps + PostgreSQL)
// ──────────────────────────────────────────────────

targetScope = 'resourceGroup'

// ── Parameters ──────────────────────────────────────
@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'prod'

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Project name used as prefix for resources')
@minLength(2)
@maxLength(12)
param projectName string = 'gilo'

@description('PostgreSQL administrator login')
param dbAdminLogin string = 'giloadmin'

@secure()
@description('PostgreSQL administrator password')
param dbAdminPassword string

@secure()
@description('JWT secret for authentication')
param jwtSecret string

@secure()
@description('GitHub token for Copilot proxy (optional)')
param githubToken string = ''

@description('Container image tag')
param imageTag string = 'latest'

@description('Custom domain for the application (e.g. gilo.dev)')
param customDomain string = 'gilo.dev'

@description('Enable custom domain configuration')
param enableCustomDomain bool = true

// ── Variables ───────────────────────────────────────
var prefix = '${projectName}-${environment}'
var tags = {
  project: projectName
  environment: environment
  managedBy: 'bicep'
}

// ── Log Analytics Workspace ─────────────────────────
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${prefix}-logs'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// ── Container Registry ──────────────────────────────
resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: replace('${prefix}acr', '-', '')
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

// ── PostgreSQL Flexible Server ──────────────────────
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: '${prefix}-pg'
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: dbAdminLogin
    administratorLoginPassword: dbAdminPassword
    storage: {
      storageSizeGB: 32
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

// Allow Azure services to connect to PostgreSQL
resource pgFirewallAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// PostgreSQL database
resource pgDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgres
  name: '${projectName}_ai'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// ── Container Apps Environment ──────────────────────
resource containerEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${prefix}-env'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ── Container App (Backend API) ─────────────────────
var databaseUrl = 'postgresql://${dbAdminLogin}:${dbAdminPassword}@${postgres.properties.fullyQualifiedDomainName}:5432/${projectName}_ai?sslmode=require'

resource backendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-api'
  location: location
  tags: tags
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3001
        transport: 'http'
        corsPolicy: {
          allowedOrigins: ['*']
          allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
          allowedHeaders: ['*']
          maxAge: 3600
        }
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        {
          name: 'acr-password'
          value: acr.listCredentials().passwords[0].value
        }
        {
          name: 'database-url'
          value: databaseUrl
        }
        {
          name: 'jwt-secret'
          value: jwtSecret
        }
        {
          name: 'github-token'
          value: githubToken
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: '${acr.properties.loginServer}/${projectName}-backend:${imageTag}'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3001' }
            { name: 'GILO_DOMAIN', value: customDomain }
            { name: 'ALLOWED_ORIGINS', value: 'https://${customDomain},https://www.${customDomain}' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'JWT_SECRET', secretRef: 'jwt-secret' }
            { name: 'GITHUB_TOKEN', secretRef: 'github-token' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: 3001
              }
              periodSeconds: 30
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/health'
                port: 3001
              }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 5
        rules: [
          {
            name: 'http-scale'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

// ── Static Web App (Frontend) ───────────────────────
resource swa 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${prefix}-web'
  location: 'eastus2' // SWA has limited region availability
  tags: tags
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    buildProperties: {
      appLocation: '/frontend'
      outputLocation: 'dist'
      skipGithubActionWorkflowGeneration: true
    }
  }
}

// SWA custom domain – apex (gilo.dev)
resource swaCustomDomainApex 'Microsoft.Web/staticSites/customDomains@2023-12-01' = if (enableCustomDomain) {
  parent: swa
  name: customDomain
  properties: {}
}

// SWA custom domain – www (www.gilo.dev)
resource swaCustomDomainWww 'Microsoft.Web/staticSites/customDomains@2023-12-01' = if (enableCustomDomain) {
  parent: swa
  name: 'www.${customDomain}'
  properties: {}
  dependsOn: [swaCustomDomainApex]
}

// SWA app settings – inject backend URL for frontend build
resource swaSettings 'Microsoft.Web/staticSites/config@2023-12-01' = {
  parent: swa
  name: 'appsettings'
  properties: {
    VITE_API_URL: enableCustomDomain ? 'https://api.${customDomain}' : 'https://${backendApp.properties.configuration.ingress.fqdn}'
  }
}

// ── Outputs ─────────────────────────────────────────
@description('Azure Container Registry login server')
output acrLoginServer string = acr.properties.loginServer

@description('Backend Container App FQDN')
output backendFqdn string = backendApp.properties.configuration.ingress.fqdn

@description('Backend Container App URL')
output backendUrl string = enableCustomDomain ? 'https://api.${customDomain}' : 'https://${backendApp.properties.configuration.ingress.fqdn}'

@description('Static Web App default hostname')
output frontendUrl string = enableCustomDomain ? 'https://${customDomain}' : 'https://${swa.properties.defaultHostname}'

@description('Static Web App deployment token')
output swaDeploymentToken string = swa.listSecrets().properties.apiKey

@description('PostgreSQL FQDN')
output postgresHost string = postgres.properties.fullyQualifiedDomainName

@description('Container Apps Environment ID')
output containerEnvId string = containerEnv.id

@description('Custom domain')
output customDomain string = customDomain

@description('Container Apps Environment verification ID (for DNS TXT record)')
output domainVerificationId string = containerEnv.properties.customDomainConfiguration.customDomainVerificationId

@description('Container Apps static IP (for DNS A record — use this for GoDaddy wildcard: * → this IP)')
output containerAppsStaticIp string = containerEnv.properties.staticIp
