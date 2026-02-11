// ============================================================
// GiLo AI – Google OAuth Provider
// Handles Google OAuth 2.0 for Gmail, Calendar, Drive, Sheets
// ============================================================

import { OAuthProvider, OAuthTokens, OAuthUserInfo } from './base';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export class GoogleProvider extends OAuthProvider {
  readonly id = 'google';
  readonly name = 'Google';
  readonly icon = 'google';
  readonly color = '#4285F4';

  readonly defaultScopes = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  readonly availableScopes = [
    { id: 'https://www.googleapis.com/auth/gmail.readonly', label: 'Gmail (lecture)', description: 'Lire les emails' },
    { id: 'https://www.googleapis.com/auth/gmail.send', label: 'Gmail (envoi)', description: 'Envoyer des emails' },
    { id: 'https://www.googleapis.com/auth/calendar.readonly', label: 'Calendar (lecture)', description: 'Lire les événements' },
    { id: 'https://www.googleapis.com/auth/calendar.events', label: 'Calendar (écriture)', description: 'Créer/modifier des événements' },
    { id: 'https://www.googleapis.com/auth/drive.readonly', label: 'Drive (lecture)', description: 'Lire les fichiers Drive' },
    { id: 'https://www.googleapis.com/auth/spreadsheets.readonly', label: 'Sheets (lecture)', description: 'Lire les feuilles de calcul' },
  ];

  private get config() {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || `https://api.gilo.dev/api/integrations/google/callback`,
    };
  }

  isConfigured(): boolean {
    return !!(this.config.clientId && this.config.clientSecret);
  }

  getAuthUrl(state: string, scopes?: string[]): string {
    const allScopes = [...this.defaultScopes, ...(scopes || [])];
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: allScopes.join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent',
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google token exchange failed: ${err}`);
    }

    const data = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      scopes: (data.scope || '').split(' '),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google token refresh failed: ${err}`);
    }

    const data2 = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
    return {
      accessToken: data2.access_token,
      refreshToken: data2.refresh_token || refreshToken, // Google may not return a new refresh token
      expiresAt: data2.expires_in ? new Date(Date.now() + data2.expires_in * 1000) : undefined,
      scopes: (data2.scope || '').split(' '),
    };
  }

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const res = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error('Failed to fetch Google user info');
    }

    const data = await res.json() as { email?: string; name?: string; picture?: string };
    return {
      email: data.email,
      name: data.name,
      avatarUrl: data.picture,
    };
  }

  async revokeToken(accessToken: string): Promise<void> {
    await fetch(`${GOOGLE_REVOKE_URL}?token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    // Google revoke may return 200 or error — we don't throw either way
  }
}
