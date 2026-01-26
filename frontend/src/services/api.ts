import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Session {
  id: string;
  projectId: string;
  userId: string;
  createdAt: string;
  state: 'active' | 'idle' | 'closed';
}

export interface TaskConstraints {
  stack?: string[];
  accessibility?: boolean;
  mobileFirst?: boolean;
  externalAPIs?: boolean;
}

export interface Task {
  id: string;
  sessionId: string;
  prompt: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export const createSession = async (params: {
  projectId: string;
  userId: string;
}): Promise<Session> => {
  const response = await api.post('/sessions', params);
  return response.data;
};

export const getSession = async (sessionId: string): Promise<Session> => {
  const response = await api.get(`/sessions/${sessionId}`);
  return response.data;
};

export const sendAgentTask = async (params: {
  sessionId: string;
  prompt: string;
  constraints?: TaskConstraints;
}): Promise<Task> => {
  const response = await api.post('/agent/task', params);
  return response.data;
};

export const getTaskStatus = async (taskId: string): Promise<Task> => {
  const response = await api.get(`/agent/task/${taskId}`);
  return response.data;
};
