import { create } from 'zustand';

interface BuilderState {
  selectedFile: string | null;
  selectedFileContent: string | null;
  projectId: string | null;
  setSelectedFile: (path: string | null, content?: string | null) => void;
  setProjectId: (id: string) => void;
}

export const useBuilderStore = create<BuilderState>((set) => ({
  selectedFile: null,
  selectedFileContent: null,
  projectId: null,
  setSelectedFile: (path, content) => 
    set({ selectedFile: path, selectedFileContent: content ?? null }),
  setProjectId: (id) => set({ projectId: id }),
}));
