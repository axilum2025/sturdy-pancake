import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  login as apiLogin, 
  logout as apiLogout, 
  getCurrentUser,
  createSession as apiCreateSession,
  User, 
  Session 
} from '../services/api';

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  clearError: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const { user } = await apiLogin(email, password);
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },

      logout: () => {
        apiLogout();
        set({ user: null, isAuthenticated: false });
      },

      fetchUser: async () => {
        const { isAuthenticated } = get();
        if (!isAuthenticated) return;
        
        set({ isLoading: true });
        try {
          const user = await getCurrentUser();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'user-storage',
      partialize: (state) => ({ 
        isAuthenticated: state.isAuthenticated,
        user: state.user 
      }),
    }
  )
);

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
