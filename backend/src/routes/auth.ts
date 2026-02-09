import { Router, Request, Response } from 'express';
import { userModel } from '../models/user';
import { authMiddleware, generateToken, AuthenticatedRequest } from '../middleware/auth';

export const authRouter = Router();

/**
 * POST /api/auth/register
 * Register a new user — returns JWT
 */
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, githubId } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
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
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
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

/**
 * POST /api/auth/upgrade
 * Upgrade to Pro tier (demo - would integrate Stripe)
 */
authRouter.post('/upgrade', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { stripeCustomerId, subscriptionId } = req.body;

    const user = await userModel.upgradeToPro(userId, stripeCustomerId || 'demo', subscriptionId || 'demo');

    res.json({
      message: 'Upgraded to Pro successfully',
      user: userModel.toResponse(user),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/downgrade
 * Downgrade to Free tier
 */
authRouter.post('/downgrade', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const user = await userModel.downgradeToFree(userId);

    res.json({
      message: 'Downgraded to Free successfully',
      user: userModel.toResponse(user),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to downgrade' });
  }
});

// ============================================================
// RGPD / GDPR Endpoints
// ============================================================

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
