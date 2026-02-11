// ============================================================
// GiLo AI – OAuth Provider Base
// Abstract base class for OAuth provider adapters
// ============================================================

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
}

export interface OAuthUserInfo {
  email?: string;
  name?: string;
  avatarUrl?: string;
}

export interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export abstract class OAuthProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly icon: string;
  abstract readonly color: string;
  abstract readonly defaultScopes: string[];
  abstract readonly availableScopes: { id: string; label: string; description: string }[];

  /**
   * Generate the authorization URL for the OAuth flow
   */
  abstract getAuthUrl(state: string, scopes?: string[]): string;

  /**
   * Exchange an authorization code for tokens
   */
  abstract exchangeCode(code: string): Promise<OAuthTokens>;

  /**
   * Refresh an expired access token
   */
  abstract refreshAccessToken(refreshToken: string): Promise<OAuthTokens>;

  /**
   * Get user info from the provider
   */
  abstract getUserInfo(accessToken: string): Promise<OAuthUserInfo>;

  /**
   * Revoke the token (disconnect)
   */
  abstract revokeToken(accessToken: string): Promise<void>;

  /**
   * Check if the provider is configured (has env vars)
   */
  abstract isConfigured(): boolean;
}
