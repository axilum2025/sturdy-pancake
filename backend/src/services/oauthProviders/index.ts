// ============================================================
// GiLo AI – OAuth Provider Registry
// Central registry for all OAuth provider adapters
// ============================================================

import { OAuthProvider } from './base';
import { GoogleProvider } from './google';
import { GitHubProvider } from './github';

// ---- Provider Registry ----

const providers: Map<string, OAuthProvider> = new Map();

// Register all providers
providers.set('google', new GoogleProvider());
providers.set('github', new GitHubProvider());
// Future: providers.set('slack', new SlackProvider());
// Future: providers.set('notion', new NotionProvider());

/**
 * Get a provider by ID
 */
export function getProvider(id: string): OAuthProvider | undefined {
  return providers.get(id);
}

/**
 * Get all registered providers
 */
export function getAllProviders(): OAuthProvider[] {
  return Array.from(providers.values());
}

/**
 * Get all configured (ready-to-use) providers
 */
export function getConfiguredProviders(): OAuthProvider[] {
  return getAllProviders().filter(p => p.isConfigured());
}

/**
 * Get provider catalog (public info, no secrets)
 */
export function getProviderCatalog() {
  return getAllProviders().map(p => ({
    id: p.id,
    name: p.name,
    icon: p.icon,
    color: p.color,
    configured: p.isConfigured(),
    availableScopes: p.availableScopes,
    defaultScopes: p.defaultScopes,
  }));
}

export { OAuthProvider } from './base';
export type { OAuthTokens, OAuthUserInfo, ProviderConfig } from './base';
