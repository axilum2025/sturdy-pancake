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
    res.status(500).json({ error: error.message });
  }
});
