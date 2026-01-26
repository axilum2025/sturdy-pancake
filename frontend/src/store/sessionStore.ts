import { create } from 'zustand';
import { createSession as apiCreateSession, Session } from '../services/api';

interface SessionState {
  currentSession: Session | null;
  isLoading: boolean;
  error: string | null;
  createSession: (params: { projectId: string; userId: string }) => Promise<void>;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  currentSession: null,
  isLoading: false,
  error: null,

  createSession: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const session = await apiCreateSession(params);
      set({ currentSession: session, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  clearSession: () => {
    set({ currentSession: null, error: null });
  },
}));
