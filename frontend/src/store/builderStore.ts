import { create } from 'zustand';

export type DeploymentStatus = 'pending' | 'building' | 'deployed' | 'failed';

export interface Deployment {
  deploymentId: string;
  status: DeploymentStatus;
  url?: string;
  previewUrl?: string;
  deployedAt?: string;
  error?: string;
}

interface BuilderState {
  selectedFile: string | null;
  selectedFileContent: string | null;
  projectId: string | null;
  deployment: Deployment | null;
  isDeploying: boolean;
  deploymentError: string | null;
  setSelectedFile: (path: string | null, content?: string | null) => void;
  setProjectId: (id: string) => void;
  setDeployment: (deployment: Deployment | null) => void;
  setIsDeploying: (isDeploying: boolean) => void;
  setDeploymentError: (error: string | null) => void;
  clearDeployment: () => void;
}

export const useBuilderStore = create<BuilderState>((set) => ({
  selectedFile: null,
  selectedFileContent: null,
  projectId: null,
  deployment: null,
  isDeploying: false,
  deploymentError: null,
  setSelectedFile: (path, content) => 
    set({ selectedFile: path, selectedFileContent: content ?? null }),
  setProjectId: (id) => set({ projectId: id }),
  setDeployment: (deployment) => set({ deployment }),
  setIsDeploying: (isDeploying) => set({ isDeploying }),
  setDeploymentError: (error) => set({ deploymentError: error }),
  clearDeployment: () => set({ deployment: null, isDeploying: false, deploymentError: null }),
}));
