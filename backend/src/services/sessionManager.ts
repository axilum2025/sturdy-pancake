import { randomUUID } from 'crypto';

export interface Session {
  id: string;
  projectId: string;
  userId: string;
  createdAt: Date;
  permissions: SessionPermissions;
  state: 'active' | 'idle' | 'closed';
}

export interface SessionPermissions {
  filesystem: 'sandbox' | 'restricted' | 'full';
  allowedCommands: string[];
  maxFileSize: number;
  allowedPorts: number[];
}

export class SessionManager {
  private sessions: Map<string, Session>;

  constructor() {
    this.sessions = new Map();
  }

  async createSession(params: { projectId: string; userId: string }): Promise<Session> {
    const sessionId = randomUUID();
    
    const session: Session = {
      id: sessionId,
      projectId: params.projectId,
      userId: params.userId,
      createdAt: new Date(),
      permissions: {
        filesystem: 'sandbox',
        allowedCommands: ['npm', 'pnpm', 'vite', 'eslint', 'prettier'],
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedPorts: [3000, 5173, 8080]
      },
      state: 'active'
    };

    this.sessions.set(sessionId, session);
    
    console.log(`✅ Session created: ${sessionId} for project ${params.projectId}`);
    
    return session;
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    return this.sessions.get(sessionId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    console.log(`🗑️  Session deleted: ${sessionId}`);
  }

  async updateSessionState(sessionId: string, state: Session['state']): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.state = state;
    }
  }
}
