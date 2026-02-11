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

export interface TimelineEvent {
  id: string;
  type: 'planning' | 'generation' | 'file-create' | 'file-edit' | 'error' | 'complete';
  message: string;
  timestamp: Date;
  status: 'pending' | 'running' | 'completed' | 'error';
  detail?: string;
}

interface StudioState {
  selectedFile: string | null;
  selectedFileContent: string | null;
  projectId: string | null;
  deployment: Deployment | null;
  isDeploying: boolean;
  deploymentError: string | null;
  /** Incremented whenever a file is created/updated by the AI agent */
  fileRefreshCounter: number;
  /** Timeline events for the history panel */
  timelineEvents: TimelineEvent[];
  setSelectedFile: (path: string | null, content?: string | null) => void;
  setProjectId: (id: string) => void;
  setDeployment: (deployment: Deployment | null) => void;
  setIsDeploying: (isDeploying: boolean) => void;
  setDeploymentError: (error: string | null) => void;
  clearDeployment: () => void;
  /** Signal that the file list should be refreshed */
  triggerFileRefresh: () => void;
  /** Add a new timeline event */
  addTimelineEvent: (event: TimelineEvent) => void;
  /** Update an existing timeline event by id */
  updateTimelineEvent: (id: string, updates: Partial<TimelineEvent>) => void;
  /** Clear all timeline events */
  clearTimeline: () => void;
}

export const useStudioStore = create<StudioState>((set, get) => ({
  selectedFile: null,
  selectedFileContent: null,
  projectId: null,
  deployment: null,
  isDeploying: false,
  deploymentError: null,
  fileRefreshCounter: 0,
  timelineEvents: [],
  setSelectedFile: (path, content) => 
    set({ selectedFile: path, selectedFileContent: content ?? null }),
  setProjectId: (id) => set({ projectId: id }),
  setDeployment: (deployment) => set({ deployment }),
  setIsDeploying: (isDeploying) => set({ isDeploying }),
  setDeploymentError: (error) => set({ deploymentError: error }),
  clearDeployment: () => set({ deployment: null, isDeploying: false, deploymentError: null }),
  triggerFileRefresh: () => set({ fileRefreshCounter: get().fileRefreshCounter + 1 }),
  addTimelineEvent: (event) =>
    set({ timelineEvents: [...get().timelineEvents, event] }),
  updateTimelineEvent: (id, updates) =>
    set({
      timelineEvents: get().timelineEvents.map((e) =>
        e.id === id ? { ...e, ...updates } : e,
      ),
    }),
  clearTimeline: () => set({ timelineEvents: [] }),
}));
