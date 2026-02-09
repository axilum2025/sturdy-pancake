import { Router, Request, Response } from 'express';
import { storageService, ProjectStorage } from '../services/storageService';
import { AuthenticatedRequest } from '../middleware/auth';
import { randomUUID } from 'crypto';

export const storageRouter = Router();

// Créer un nouveau projet
storageRouter.post('/projects', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { name, metadata } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const project: ProjectStorage = {
      id: randomUUID(),
      userId,
      name,
      files: {},
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await storageService.saveProject(project);
    res.status(201).json(project);
  } catch (error: any) {
    console.error('Error creating project:', error.message);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Lister les projets de l'utilisateur
storageRouter.get('/projects', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const projects = await storageService.listProjectsByUser(userId);
    res.json(projects);
  } catch (error: any) {
    console.error('Error listing projects:', error.message);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// Helper: verify project ownership
async function verifyProjectOwnership(req: Request, res: Response): Promise<ProjectStorage | null> {
  const userId = (req as AuthenticatedRequest).userId;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  const project = await storageService.loadProject(req.params.projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  if (project.userId && project.userId !== userId) {
    res.status(403).json({ error: 'Access denied' });
    return null;
  }
  return project;
}

// Récupérer un projet
storageRouter.get('/projects/:projectId', async (req: Request, res: Response) => {
  try {
    const project = await verifyProjectOwnership(req, res);
    if (!project) return;
    res.json(project);
  } catch (error: any) {
    console.error('Error getting project:', error.message);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// Supprimer un projet
storageRouter.delete('/projects/:projectId', async (req: Request, res: Response) => {
  try {
    const project = await verifyProjectOwnership(req, res);
    if (!project) return;
    await storageService.deleteProject(req.params.projectId);
    res.json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting project:', error.message);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Sauvegarder un fichier dans un projet
storageRouter.post('/projects/:projectId/files', async (req: Request, res: Response) => {
  try {
    const project = await verifyProjectOwnership(req, res);
    if (!project) return;

    const { filename, content } = req.body;
    if (!filename || content === undefined) {
      return res.status(400).json({ error: 'filename and content are required' });
    }

    await storageService.saveProjectFile(req.params.projectId, filename, content);
    res.json({ message: 'File saved successfully' });
  } catch (error: any) {
    console.error('Error saving file:', error.message);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

// Récupérer un fichier d'un projet
storageRouter.get('/projects/:projectId/files/:filename', async (req: Request, res: Response) => {
  try {
    const project = await verifyProjectOwnership(req, res);
    if (!project) return;

    const { filename } = req.params;
    const content = await storageService.getProjectFile(req.params.projectId, filename);

    if (content === null) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ filename, content });
  } catch (error: any) {
    console.error('Error getting file:', error.message);
    res.status(500).json({ error: 'Failed to get file' });
  }
});

// Supprimer un fichier d'un projet
storageRouter.delete('/projects/:projectId/files/:filename', async (req: Request, res: Response) => {
  try {
    const project = await verifyProjectOwnership(req, res);
    if (!project) return;

    const { filename } = req.params;
    await storageService.deleteProjectFile(req.params.projectId, filename);
    res.json({ message: 'File deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting file:', error.message);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Mettre à jour les métadonnées d'un projet
storageRouter.patch('/projects/:projectId/metadata', async (req: Request, res: Response) => {
  try {
    const project = await verifyProjectOwnership(req, res);
    if (!project) return;

    const metadata = req.body;
    await storageService.updateProjectMetadata(req.params.projectId, metadata);
    res.json({ message: 'Metadata updated successfully' });
  } catch (error: any) {
    console.error('Error updating metadata:', error.message);
    res.status(500).json({ error: 'Failed to update metadata' });
  }
});
