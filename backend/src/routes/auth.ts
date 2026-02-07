import { Router, Request, Response } from 'express';
import { userModel } from '../models/user';

export const authRouter = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, githubId } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await userModel.create({ email, password, githubId });
    const response = userModel.toResponse(user);

    res.status(201).json({
      user: response,
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
 * Login with email/password
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

    // Demo: accept any password for demo user
    if (user.email === 'demo@example.com' && password === 'demo') {
      const response = userModel.toResponse(user);
      return res.json({
        user: response,
        token: `demo-token-${user.id}`,
      });
    }

    res.status(401).json({ error: 'Invalid credentials' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(userModel.toResponse(user));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/auth/upgrade
 * Upgrade to Pro tier (demo - would integrate Stripe)
 */
authRouter.post('/upgrade', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { stripeCustomerId, subscriptionId } = req.body;

    const user = await userModel.upgradeToPro(userId, stripeCustomerId, subscriptionId);
    
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
authRouter.post('/downgrade', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await userModel.downgradeToFree(userId);
    
    res.json({
      message: 'Downgraded to Free successfully',
      user: userModel.toResponse(user),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
