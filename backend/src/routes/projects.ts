import { Router, Response } from 'express';
import { projectModel, ProjectCreateDTO } from '../models/project';
import { authMiddleware, AuthenticatedRequest, checkProjectQuota } from '../middleware/auth';
import { userModel } from '../models/user';

export const projectsRouter = Router();

// Apply auth middleware to all routes
projectsRouter.use(authMiddleware);

/**
 * GET /api/projects
 * List all projects for current user
 */
projectsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const projects = await projectModel.findByUserId(userId);
    
    res.json({
      projects: projects.map(p => projectModel.toResponse(p)),
      total: projects.length,
      userTier: req.user.tier,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projects
 * Create a new project
 */
projectsRouter.post('/', checkProjectQuota, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { name, description, techStack } = req.body as ProjectCreateDTO;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = await projectModel.create(userId, { name, description, techStack }, req.user.tier);
    
    // Update user usage
    await userModel.updateUsage(userId, {
      projectsCount: (req.user.usage.projectsCount || 0) + 1,
    });

    res.status(201).json({
      message: 'Project created successfully',
      project: projectModel.toResponse(project),
    });
  } catch (error: any) {
    if (error.message.includes('limit reached')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:id
 * Get a specific project
 */
projectsRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const id = req.params.id;

    const project = await projectModel.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(projectModel.toResponse(project));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:id/files
 * Get all files in a project
 */
projectsRouter.get('/:id/files', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const id = req.params.id;

    const project = await projectModel.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      files: project.files,
      filesCount: Object.keys(project.files).length,
      storageUsed: project.storageUsed,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:id/files/* 
 * Get a specific file content
 */
projectsRouter.get('/:id/files/*', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const id = req.params.id;
    const path = req.params[0];

    const project = await projectModel.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const content = project.files[path];
    if (!content) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ path, content, size: content.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/projects/:id/files/*
 * Update a specific file content
 */
projectsRouter.put('/:id/files/*', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const id = req.params.id;
    const path = req.params[0];
    const { content } = req.body;

    if (content === undefined) {
      return res.status(400).json({ error: 'File content is required' });
    }

    const project = await projectModel.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check storage quota
    const storageDelta = content.length - (project.files[path]?.length || 0);
    const newStorageUsed = project.storageUsed + storageDelta;
    const maxStorage = req.user.quotas.storageMax;

    if (newStorageUsed > maxStorage) {
      return res.status(403).json({
        error: 'Storage limit exceeded',
        message: `Required: ${newStorageUsed} bytes, Limit: ${maxStorage} bytes`,
      });
    }

    const updatedProject = await projectModel.updateFile(id, path, content);

    // Update user storage usage
    await userModel.updateUsage(userId, {
      storageUsed: newStorageUsed,
    });

    res.json({
      message: 'File updated successfully',
      path,
      storageUsed: updatedProject.storageUsed,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/projects/:id/files/*
 * Delete a file from project
 */
projectsRouter.delete('/:id/files/*', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const id = req.params.id;
    const path = req.params[0];

    const project = await projectModel.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!project.files[path]) {
      return res.status(404).json({ error: 'File not found' });
    }

    const deletedProject = await projectModel.deleteFile(id, path);

    // Update user storage usage
    await userModel.updateUsage(userId, {
      storageUsed: deletedProject.storageUsed,
    });

    res.json({
      message: 'File deleted successfully',
      path,
      storageUsed: deletedProject.storageUsed,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/projects/:id
 * Update project metadata (name, description, etc.)
 */
projectsRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const id = req.params.id;
    const { name, description } = req.body;

    const project = await projectModel.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedProject = await projectModel.update(id, { name, description });
    res.json({
      message: 'Project updated successfully',
      project: projectModel.toResponse(updatedProject),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project
 */
projectsRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const id = req.params.id;

    const project = await projectModel.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await projectModel.delete(id);

    // Update user usage
    await userModel.updateUsage(userId, {
      projectsCount: Math.max(0, (req.user.usage.projectsCount || 1) - 1),
      storageUsed: Math.max(0, req.user.usage.storageUsed - project.storageUsed),
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projects/:id/deploy
 * Trigger deployment for a project
 */
projectsRouter.post('/:id/deploy', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const id = req.params.id;
    const { provider } = req.body;

    const project = await projectModel.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

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

    // Update deployment status
    await projectModel.updateDeployment(id, {
      status: 'building',
      deployedAt: new Date(),
    });

    // TODO: Integrate with actual deployment service
    // For now, simulate deployment
    setTimeout(async () => {
      const url = provider === 'azure-webapp' 
        ? `https://${project.name.toLowerCase().replace(/\s+/g, '-')}.azurewebsites.net`
        : `https://${project.name.toLowerCase().replace(/\s+/g, '-')}.azurestaticapps.net`;
      
      await projectModel.updateDeployment(id, {
        status: 'deployed',
        url,
      });

      // Update user deployment count
      await userModel.updateUsage(userId, {
        deploymentsThisMonth: req.user.usage.deploymentsThisMonth + 1,
      });
    }, 5000);

    res.json({
      message: 'Deployment started',
      status: 'building',
      estimatedTime: '30-60 seconds',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
