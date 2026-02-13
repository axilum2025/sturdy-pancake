import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { userModel } from '../models/user';
import { authMiddleware, generateToken, AuthenticatedRequest } from '../middleware/auth';
import { validate, registerSchema, loginSchema, changePasswordSchema, updateProfileSchema } from '../middleware/validation';

export const authRouter = Router();

// ============================================================
// Cloudflare Turnstile verification
// ============================================================
async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // skip if not configured (dev mode)

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
    });
    const data = await res.json() as { success: boolean };
    return data.success === true;
  } catch (err) {
    console.error('Turnstile verification failed:', err);
    return false;
  }
}

// ============================================================
// GitHub OAuth Login — state store (short-lived, in-memory)
// ============================================================
const githubAuthStates = new Map<string, { createdAt: number }>();

// Clean up expired states every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of githubAuthStates) {
    if (now - val.createdAt > 10 * 60 * 1000) githubAuthStates.delete(key);
  }
}, 10 * 60 * 1000);

function getGithubConfig() {
  return {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    callbackUrl: process.env.GITHUB_AUTH_CALLBACK_URL
      || `${process.env.API_BASE_URL || 'https://api.gilo.dev'}/api/auth/github/callback`,
  };
}

/**
 * GET /api/auth/github
 * Initiate GitHub OAuth login — redirects user to GitHub
 */
authRouter.get('/github', (_req: Request, res: Response) => {
  const cfg = getGithubConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    return res.status(500).json({ error: 'GitHub OAuth is not configured' });
  }

  const state = crypto.randomBytes(32).toString('hex');
  githubAuthStates.set(state, { createdAt: Date.now() });

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.callbackUrl,
    scope: 'read:user user:email',
    state,
    allow_signup: 'true',
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

/**
 * GET /api/auth/github/callback
 * GitHub redirects here after user authorises.
 * Exchanges code for token, finds or creates user, returns JWT via frontend redirect.
 */
authRouter.get('/github/callback', async (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || 'https://gilo.dev';

  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError || !code || !state) {
      return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent((oauthError as string) || 'missing_params')}`);
    }

    // Validate state
    if (!githubAuthStates.has(state as string)) {
      return res.redirect(`${frontendUrl}/auth/callback?error=invalid_state`);
    }
    githubAuthStates.delete(state as string);

    // Exchange code for access token
    const cfg = getGithubConfig();
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        code,
        redirect_uri: cfg.callbackUrl,
      }),
    });

    const tokenData = await tokenRes.json() as Record<string, any>;
    if (tokenData.error) {
      return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
    }

    const accessToken = tokenData.access_token as string;

    // Fetch GitHub user profile
    const ghHeaders = { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' };
    const userRes = await fetch('https://api.github.com/user', { headers: ghHeaders });
    if (!userRes.ok) throw new Error(`GitHub API error: ${userRes.status}`);
    const ghUser = await userRes.json() as { id: number; login: string; name?: string; email?: string; avatar_url?: string };

    // Resolve email (may be private)
    let email = ghUser.email;
    if (!email) {
      try {
        const emailsRes = await fetch('https://api.github.com/user/emails', { headers: ghHeaders });
        if (emailsRes.ok) {
          const emails = await emailsRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
          const primary = emails.find(e => e.primary && e.verified);
          email = primary?.email || emails.find(e => e.verified)?.email;
        }
      } catch { /* ignore */ }
    }

    if (!email) {
      return res.redirect(`${frontendUrl}/auth/callback?error=no_email`);
    }

    // Find or create user
    const user = await userModel.findOrCreateByGithub(
      ghUser.id.toString(),
      email,
      ghUser.name || ghUser.login,
    );

    const token = generateToken(user);
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  } catch (error: any) {
    console.error('GitHub OAuth callback error:', error);
    res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * POST /api/auth/register
 * Register a new user — returns JWT
 */
authRouter.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, githubId, turnstileToken } = req.body;

    // Verify Turnstile (anti-bot)
    if (process.env.TURNSTILE_SECRET_KEY) {
      if (!turnstileToken) {
        return res.status(400).json({ error: 'Captcha verification required' });
      }
      const ok = await verifyTurnstile(turnstileToken, req.ip);
      if (!ok) {
        return res.status(403).json({ error: 'Captcha verification failed. Please try again.' });
      }
    }

    const user = await userModel.create({ email, password, githubId });
    const token = generateToken(user);
    const response = userModel.toResponse(user);

    res.status(201).json({
      user: response,
      token,
      message: 'User created successfully',
    });
  } catch (error: any) {
    if (error.message === 'Email already exists') {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/login
 * Login with email/password — returns JWT
 */
authRouter.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, turnstileToken } = req.body;

    // Verify Turnstile (anti-bot)
    if (process.env.TURNSTILE_SECRET_KEY) {
      if (!turnstileToken) {
        return res.status(400).json({ error: 'Captcha verification required' });
      }
      const ok = await verifyTurnstile(turnstileToken, req.ip);
      if (!ok) {
        return res.status(403).json({ error: 'Captcha verification failed. Please try again.' });
      }
    }

    const user = await userModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await userModel.verifyPassword(user, password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    const response = userModel.toResponse(user);

    res.json({
      user: response,
      token,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile (requires JWT)
 */
authRouter.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    res.json(userModel.toResponse(user));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Legacy upgrade/downgrade endpoints removed — billing is now handled
// exclusively through Stripe checkout + webhook flow (billingService.ts).

// ============================================================
// Profile Update
// ============================================================

/**
 * PATCH /api/auth/profile
 * Update user profile (display name)
 */
authRouter.patch('/profile', authMiddleware, validate(updateProfileSchema), async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { displayName } = req.body;

    const user = await userModel.update(userId, { displayName });

    res.json({
      message: 'Profile updated successfully',
      user: userModel.toResponse(user),
    });
  } catch (error: any) {
    console.error('Profile update error:', error.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ============================================================
// RGPD / GDPR Endpoints
// ============================================================

/**
 * POST /api/auth/change-password
 * Change user password (requires current password confirmation)
 */
authRouter.post('/change-password', authMiddleware, validate(changePasswordSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { currentPassword, newPassword } = req.body;

    const valid = await userModel.verifyPassword(user, currentPassword);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password and update
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const { getDb } = await import('../db');
    const { users } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');
    const db = getDb();
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));

    res.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    console.error('Change password error:', error.message);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * GET /api/auth/export
 * GDPR Art. 15/20 — Right of Access / Data Portability
 * Returns all user data as a JSON export
 */
authRouter.get('/export', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const data = await userModel.exportUserData(userId);
    if (!data) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.setHeader('Content-Disposition', 'attachment; filename="user-data-export.json"');
    res.setHeader('Content-Type', 'application/json');
    res.json(data);
  } catch (error: any) {
    console.error('Data export error:', error.message);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

/**
 * DELETE /api/auth/account
 * GDPR Art. 17 — Right to Erasure (Right to be Forgotten)
 * Permanently deletes user account and all associated data
 */
authRouter.delete('/account', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const user = (req as AuthenticatedRequest).user;

    // Require password confirmation for security
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password confirmation required' });
    }

    const valid = await userModel.verifyPassword(user, password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Delete user — cascade removes all related data
    const deleted = await userModel.delete(userId);
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Account and all associated data permanently deleted' });
  } catch (error: any) {
    console.error('Account deletion error:', error.message);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});
