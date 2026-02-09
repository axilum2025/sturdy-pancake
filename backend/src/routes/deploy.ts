import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { deploymentService } from '../services/deploymentService';
import { projectModel } from '../models/project';
import { agentModel } from '../models/agent';

export const deploymentRouter = Router();

// Apply auth middleware to all routes
deploymentRouter.use(authMiddleware);

/**
 * POST /api/deploy
 * Deploy a project to the Starter tier infrastructure
 */
deploymentRouter.post('/:projectId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const projectId = req.params.projectId;
    const { provider, customDomain } = req.body;

    // Get project (auto-create from agent if needed)
    let project = await projectModel.findById(projectId);
    if (!project) {
      const agent = await agentModel.findById(projectId);
      if (agent && agent.userId === userId) {
        project = await projectModel.ensureForAgent(projectId, userId, agent.name, (req.user?.tier as any) || 'free');
      }
    }
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check ownership
    if (project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check deployment quota
    if (req.user.usage.deploymentsThisMonth >= req.user.quotas.deploymentsPerMonth) {
      return res.status(403).json({
        error: 'Deployment limit reached',
        message: `You have used ${req.user.usage.deploymentsThisMonth}/${req.user.quotas.deploymentsPerMonth} deployments this month`,
      });
    }

    // Update project deployment status
    await projectModel.updateDeployment(projectId, {
      status: 'building',
      deployedAt: new Date(),
    });

    // Start deployment
    const deployment = await deploymentService.deploy({
      projectId,
      projectName: project.name,
      files: project.files,
      provider: provider || 'azure-static',
      customDomain,
    });

    // Update user deployment count
    await userModel.updateUsage(userId, {
      deploymentsThisMonth: req.user.usage.deploymentsThisMonth + 1,
    });

    res.json({
      message: 'Deployment started',
      deployment: {
        id: deployment.deploymentId,
        status: deployment.status,
        estimatedTime: '30-60 seconds',
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Deployment failed' });
  }
});

/**
 * GET /api/deploy/:deploymentId
 * Get deployment status
 */
deploymentRouter.get('/:deploymentId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const deploymentId = req.params.deploymentId;
    const deployment = await deploymentService.getDeployment(deploymentId);

    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    // Verify project ownership
    const project = await projectModel.findById(deployment.projectId);
    if (!project || project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(deployment);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get deployment' });
  }
});

/**
 * GET /api/deploy/project/:projectId
 * Get all deployments for a project
 */
deploymentRouter.get('/project/:projectId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const projectId = req.params.projectId;

    // Verify project ownership
    const project = await projectModel.findById(projectId);
    if (!project || project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deployments = await deploymentService.getProjectDeployments(projectId);

    res.json({
      deployments,
      total: deployments.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list deployments' });
  }
});

/**
 * DELETE /api/deploy/:deploymentId
 * Cancel or delete a deployment
 */
deploymentRouter.delete('/:deploymentId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const deploymentId = req.params.deploymentId;

    // Verify deployment ownership via project
    const deployment = await deploymentService.getDeployment(deploymentId);
    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    const project = await projectModel.findById(deployment.projectId);
    if (!project || project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deleted = await deploymentService.deleteDeployment(deploymentId);

    if (!deleted) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    res.json({ message: 'Deployment deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete deployment' });
  }
});

// Import userModel at the end to avoid circular dependency
import { userModel } from '../models/user';
