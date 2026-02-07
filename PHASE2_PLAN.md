# Phase 2 - AI App Builder v2: Architecture Finale

## Modèle de Revenue Révisé

| Feature | Starter (Free) | Pro ($29/mois) | Team ($99/mois) |
|---------|----------------|----------------|-----------------|
| **Prix** | $0 | $29/mois | $99/mois |
| **Domaine** | `*.yourdomain.com` (notre Azure) | Domaine personnalisé | Domaine personnalisé |
| **GitHub** | ❌ | ✅ Repo privé | ✅ Repo privé |
| **Azure** | Notre compte | Compte dédié | Compte dédié |
| **Stockage** | 500Mo | 10Go | 50Go |
| **Databases** | ❌ | ✅ | ✅ |
| **CI/CD** | Automatique | GitHub Actions | GitHub Actions |
| **Support** | Communauté | Email | Prioritaire |

---

## Architecture Starter Tier (Notre Azure)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Notre Infrastructure Azure                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │           Azure Static Web Apps (Enterprise Tier)         │   │
│   │                                                          │   │
│   │   ├── app1.yourdomain.com  →  Storage Account #1         │   │
│   │   ├── app2.yourdomain.com  →  Storage Account #2         │   │
│   │   ├── app3.yourdomain.com  →  Storage Account #3         │   │
│   │   └── ... (autant que nécessaire)                        │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              Azure DNS Zone                             │   │
│   │                                                          │   │
│   │   CNAME: *.yourdomain.com → yourapp.azurefd.net        │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Avantages Starter Tier:
- ✅ Zero configuration pour l'utilisateur
- ✅ SSL automatique
- ✅ CDN global
- ✅ Preview instantané
- ✅ Upgrade transparent vers Pro

---

## Architecture Pro/Team Tier (Compte Dédié)

```
┌─────────────────────────────────────────────────────────────────┐
│                   Compte Azure de l'Utilisateur                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │          Resource Group: rg-user-project                 │   │
│   │                                                          │   │
│   │   ├── Azure Web App (B1: ~$13/mois)                    │   │
│   │   ├── Azure Database for PostgreSQL (B1: ~$15/mois)    │   │
│   │   ├── Azure Container Registry (Standard: ~$5/mois)    │   │
│   │   └── GitHub Actions (workflow deploye vers Azure)      │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                  GitHub Private Repo                    │   │
│   │                                                          │   │
│   │   ├── src/, package.json, etc.                          │   │
│   │   ├── .github/workflows/deploy.yml                      │   │
│   │   └── README.md                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flux de Déploiement

### Starter Tier (Auto-hébergé)
```
1. User: "Crée une app React avec Tailwind"
2. Agent génère les fichiers
3. Notre backend zip les fichiers
4. Upload vers notre Azure Static Web Apps
5. DNS: app.username.yourdomain.com → déployé
6. Time: ~30 secondes
```

### Pro Tier (Compte Dédié)
```
1. User: "Crée une app SaaS avec auth et database"
2. Agent génère full-stack (frontend + backend)
3. Backend crée repo GitHub privé (via notre OAuth GitHub App)
4. Push fichiers vers GitHub
5. GitHub Actions déploie vers Azure Web App
6. DNS: customdomain.com → déployé
7. Time: ~2-5 minutes
```

---

## Plan d'Implémentation Révisé

### Étape 1: Core + Starter Tier (Priorité Haute)
- [ ] User/Auth Models avec tiers (starter/pro/team)
- [ ] Project storage (string-based)
- [ ] Deployment Service pour Starter:
  - [ ] Azure Static Web Apps API integration
  - [ ] DNS management (Azure DNS ou Cloudflare)
  - [ ] SSL certificate automation

### Étape 2: Copilot Agent Integration
- [ ] GitHub Copilot SDK integration
- [ ] Tools pour génération fichiers
- [ ] Tools pour déploiement Starter

### Étape 3: Pro Tier (OAuth GitHub + Azure)
- [ ] GitHub OAuth App (pour créer repos)
- [ ] Azure Service Principal (pour déployer)
- [ ] Template CI/CD GitHub Actions

### Étape 4: Frontend v2
- [ ] Auth + Dashboard
- [ ] File Editor
- [ ] Deployment Panel
- [ ] Upgrade UI

### Étape 5: Billing (Stripe)
- [ ] Stripe Checkout
- [ ] Webhooks
- [ ] Portal client

---

## Coûts Estimés

### Starter Tier (par utilisateur)
```
Notre Azure Static Web Apps (Enterprise):
- ~$0.08/utilisateur/mois (500Mo stockage)
- SSL + CDN inclus
- Total: ~$0.10/utilisateur/mois
```

### Pro Tier (facturé à l'utilisateur)
```
Azure (payé par utilisateur):
- Web App B1: ~$13/mois
- PostgreSQL B1: ~$15/mois
- Container Registry: ~$5/mois
Total: ~$33/mois (utilisateur paie $29 = perte $4)
```

### Optimisation Pro Tier
```
Utiliser Azure Static Web Apps pour backend aussi:
- Gratuit jusqu'à certaine échelle
- Plus économique que VM
- Plus simple à configurer
```

---

## Questions en Suspens

1. **Domaine principal**: Quel sera votre domaine? (`*.ai-builder.io`, `*.devpilot.io`, etc.)

2. **GitHub OAuth**: Avez-vous déjà une GitHub App enregistrée ou faut-il la créer?

3. **Azure**: Quel est votre subscription Azure? (il faudra provisionner les resources)
