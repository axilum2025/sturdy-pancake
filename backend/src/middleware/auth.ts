import { Request, Response, NextFunction } from 'express';
import { userModel } from '../models/user';
import { User } from '../models/user';

export interface AuthenticatedRequest extends Request {
  userId: string;
  user: User;
}

/**
 * Authentication middleware
 * Expects userId in header 'x-user-id' for demo purposes
 * In production, this would validate JWT tokens
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // For demo: get userId from header
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized. Missing x-user-id header.' });
      return;
    }

    const user = await userModel.findById(userId);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Attach user to request
    (req as AuthenticatedRequest).userId = userId;
    (req as AuthenticatedRequest).user = user;

    next();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Optional auth - doesn't fail if no user
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.headers['x-user-id'] as string;
    
    if (userId) {
      const user = await userModel.findById(userId);
      if (user) {
        (req as AuthenticatedRequest).userId = userId;
        (req as AuthenticatedRequest).user = user;
      }
    }
    
    next();
  } catch (error: any) {
    next();
  }
};

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
