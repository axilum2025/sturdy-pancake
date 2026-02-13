import { Router, Request, Response } from 'express';
import { userModel } from '../models/user';
import { authMiddleware, generateToken, AuthenticatedRequest } from '../middleware/auth';
import { validate, registerSchema, loginSchema, changePasswordSchema, updateProfileSchema } from '../middleware/validation';

export const authRouter = Router();

/**
 * POST /api/auth/register
 * Register a new user — returns JWT
 */
authRouter.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, githubId } = req.body;

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
    const { email, password } = req.body;

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
