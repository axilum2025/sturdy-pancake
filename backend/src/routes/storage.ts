import { Router, Request, Response } from 'express';
import { storageService, ProjectStorage } from '../services/storageService';
import { randomUUID } from 'crypto';

export const storageRouter = Router();

// Créer un nouveau projet
storageRouter.post('/projects', async (req: Request, res: Response) => {
  try {
    const { name, metadata } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const project: ProjectStorage = {
      id: randomUUID(),
      name,
      files: {},
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await storageService.saveProject(project);
    res.status(201).json(project);
  } catch (error: any) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Lister tous les projets
storageRouter.get('/projects', async (req: Request, res: Response) => {
  try {
    const projects = await storageService.listProjects();
    res.json(projects);
  } catch (error: any) {
    console.error('Error listing projects:', error);
    res.status(500).json({ error: error.message });
  }
});

// Récupérer un projet
storageRouter.get('/projects/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const project = await storageService.loadProject(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error: any) {
    console.error('Error getting project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un projet
storageRouter.delete('/projects/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    await storageService.deleteProject(projectId);
    res.json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sauvegarder un fichier dans un projet
storageRouter.post('/projects/:projectId/files', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { filename, content } = req.body;

    if (!filename || content === undefined) {
      return res.status(400).json({ error: 'filename and content are required' });
    }

    await storageService.saveProjectFile(projectId, filename, content);
    res.json({ message: 'File saved successfully' });
  } catch (error: any) {
    console.error('Error saving file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Récupérer un fichier d'un projet
storageRouter.get('/projects/:projectId/files/:filename', async (req: Request, res: Response) => {
  try {
    const { projectId, filename } = req.params;
    const content = await storageService.getProjectFile(projectId, filename);

    if (content === null) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ filename, content });
  } catch (error: any) {
    console.error('Error getting file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un fichier d'un projet
storageRouter.delete('/projects/:projectId/files/:filename', async (req: Request, res: Response) => {
  try {
    const { projectId, filename } = req.params;
    await storageService.deleteProjectFile(projectId, filename);
    res.json({ message: 'File deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour les métadonnées d'un projet
storageRouter.patch('/projects/:projectId/metadata', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const metadata = req.body;

    await storageService.updateProjectMetadata(projectId, metadata);
    res.json({ message: 'Metadata updated successfully' });
  } catch (error: any) {
    console.error('Error updating metadata:', error);
    res.status(500).json({ error: error.message });
  }
});
