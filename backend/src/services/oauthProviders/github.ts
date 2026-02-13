// ============================================================
// GiLo AI – GitHub OAuth Provider
// Handles GitHub OAuth 2.0 for repos, issues, gists, etc.
// ============================================================

import { OAuthProvider, OAuthTokens, OAuthUserInfo } from './base';

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_URL = 'https://api.github.com';

export class GitHubProvider extends OAuthProvider {
  readonly id = 'github';
  readonly name = 'GitHub';
  readonly icon = 'github';
  readonly color = '#24292f';

  readonly defaultScopes = [
    'read:user',
    'user:email',
  ];

  readonly availableScopes = [
    { id: 'repo', label: 'Repositories', description: 'Full control of private repositories' },
    { id: 'public_repo', label: 'Public repos', description: 'Access public repositories' },
    { id: 'read:org', label: 'Organizations (read)', description: 'Read organization membership' },
    { id: 'gist', label: 'Gists', description: 'Create and edit gists' },
    { id: 'read:discussion', label: 'Discussions (read)', description: 'Read team discussions' },
    { id: 'workflow', label: 'Workflows', description: 'Update GitHub Action workflows' },
  ];

  private get config() {
    return {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      redirectUri: process.env.GITHUB_REDIRECT_URI || `https://api.gilo.dev/api/integrations/github/callback`,
    };
  }

  isConfigured(): boolean {
    return !!(this.config.clientId && this.config.clientSecret);
  }

  getAuthUrl(state: string, scopes?: string[]): string {
    const allScopes = [...new Set([...this.defaultScopes, ...(scopes || [])])];
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: allScopes.join(' '),
      state,
      allow_signup: 'true',
    });
    return `${GITHUB_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const res = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GitHub token exchange failed: ${err}`);
    }

    const data = await res.json() as {
      access_token: string;
      token_type: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (data.error) {
      throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: undefined, // GitHub OAuth tokens don't expire (no refresh token)
      expiresAt: undefined,
      scopes: (data.scope || '').split(',').filter(Boolean),
    };
  }

  async refreshAccessToken(_refreshToken: string): Promise<OAuthTokens> {
    // GitHub OAuth tokens don't have refresh tokens in standard OAuth flow
    // GitHub Apps use a different mechanism; for standard OAuth, tokens don't expire
    throw new Error('GitHub OAuth tokens do not support refresh. Re-authorize instead.');
  }

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    // Fetch user profile
    const userRes = await fetch(`${GITHUB_API_URL}/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!userRes.ok) {
      throw new Error(`GitHub user info failed: ${userRes.status}`);
    }

    const user = await userRes.json() as {
      login: string;
      name?: string;
      email?: string;
      avatar_url?: string;
    };

    // If email is null (private), fetch from /user/emails
    let email = user.email;
    if (!email) {
      try {
        const emailsRes = await fetch(`${GITHUB_API_URL}/user/emails`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });

        if (emailsRes.ok) {
          const emails = await emailsRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
          const primary = emails.find(e => e.primary && e.verified);
          email = primary?.email || emails.find(e => e.verified)?.email;
        }
      } catch {
        // Ignore — email will just be undefined
      }
    }

    return {
      email,
      name: user.name || user.login,
      avatarUrl: user.avatar_url,
    };
  }

  async revokeToken(accessToken: string): Promise<void> {
    // GitHub requires app credentials to revoke a token
    const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

    const res = await fetch(`${GITHUB_API_URL}/applications/${this.config.clientId}/token`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ access_token: accessToken }),
    });

    // 204 = success, 422 = token already invalid
    if (!res.ok && res.status !== 422) {
      console.warn(`GitHub token revoke returned ${res.status}`);
    }
  }
}
