import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { userModel } from '../models/user';
import { User } from '../models/user';

export interface AuthenticatedRequest extends Request {
  userId: string;
  user: User;
}

export interface JwtPayload {
  userId: string;
  tier: string;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is required');
  return secret;
}

/**
 * Authentication middleware
 * Checks Authorization: Bearer <JWT> header
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
        const user = await userModel.findById(decoded.userId);
        if (user) {
          (req as AuthenticatedRequest).userId = user.id;
          (req as AuthenticatedRequest).user = user;
          return next();
        }
      } catch (jwtError) {
        // JWT invalid
      }
    }

    res.status(401).json({ error: 'Unauthorized. Invalid or missing authentication.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Optional auth - doesn't fail if no user, just attaches if present
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
        const user = await userModel.findById(decoded.userId);
        if (user) {
          (req as AuthenticatedRequest).userId = user.id;
          (req as AuthenticatedRequest).user = user;
        }
      } catch {
        // ignore
      }
    }
    next();
  } catch {
    next();
  }
};

/**
 * Generate a JWT access token
 */
export function generateToken(user: User): string {
  const payload: JwtPayload = {
    userId: user.id,
    tier: user.tier,
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '24h' });
}

/**
 * Quota check middleware for projects
 */
export const checkProjectQuota = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    const maxProjects = user.quotas.projectsMax;
    const currentProjects = user.usage.projectsCount;

    if (currentProjects >= maxProjects) {
      res.status(403).json({
        error: 'Project limit reached',
        message: `You have reached the maximum of ${maxProjects} projects for your ${user.tier} tier.`,
        upgradeUrl: '/upgrade',
      });
      return;
    }

    next();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Quota check middleware for storage
 */
export const checkStorageQuota = (
  requiredBytes: number,
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const user = req.user;
  const available = user.quotas.storageMax - user.usage.storageUsed;

  if (requiredBytes > available) {
    res.status(403).json({
      error: 'Storage limit reached',
      message: `Not enough storage. Available: ${formatBytes(available)}, Required: ${formatBytes(requiredBytes)}`,
      upgradeUrl: '/upgrade',
    });
    return;
  }

  next();
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
