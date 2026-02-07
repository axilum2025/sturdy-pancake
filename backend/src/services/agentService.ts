import { randomUUID } from 'crypto';
import { mcpService } from '../routes/mcp';
import { copilotService } from './copilotService';

export interface TaskConstraints {
  stack?: string[];
  accessibility?: boolean;
  mobileFirst?: boolean;
  externalAPIs?: boolean;
  maxIterations?: number;
  mcpTools?: string[]; // Liste des outils MCP à utiliser
}

export interface Task {
  id: string;
  sessionId: string;
  prompt: string;
  constraints?: TaskConstraints;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
}

export class AgentService {
  private tasks: Map<string, Task>;
  private streamCallbacks: Map<string, ((data: any) => void)[]>;

  constructor() {
    this.tasks = new Map();
    this.streamCallbacks = new Map();
  }

  async executeTask(params: {
    sessionId: string;
    prompt: string;
    constraints?: TaskConstraints;
  }): Promise<Task> {
    const taskId = randomUUID();
    
    const task: Task = {
      id: taskId,
      sessionId: params.sessionId,
      prompt: params.prompt,
      constraints: params.constraints,
      status: 'pending',
      createdAt: new Date()
    };

    this.tasks.set(taskId, task);
    
    // Start async execution
    this.runTask(task).catch(error => {
      console.error(`Task ${taskId} failed:`, error);
      task.status = 'failed';
      task.error = error.message;
    });

    return task;
  }

  private async runTask(task: Task): Promise<void> {
    task.status = 'running';
    
    try {
      // Use GitHub Copilot for intelligent task execution
      console.log(`🤖 Executing task ${task.id} via GitHub Copilot`);
      console.log(`   Prompt: ${task.prompt}`);
      console.log(`   Constraints:`, task.constraints);

      this.emitStream(task.sessionId, {
        type: 'status',
        message: 'Agent started planning via GitHub Copilot...'
      });

      // Execute via Copilot
      const copilotResponse = await copilotService.chat({
        messages: [
          {
            role: 'user',
            content: `En tant qu'agent de développement, exécute cette tâche:\n\n${task.prompt}\n\nContraintes: ${JSON.stringify(task.constraints || {})}`,
          },
        ],
        projectContext: {
          projectId: task.sessionId,
          techStack: task.constraints?.stack,
        },
      });

      task.status = 'completed';
      task.completedAt = new Date();
      task.result = {
        message: copilotResponse.content,
        model: copilotResponse.model,
        usage: copilotResponse.usage,
        filesCreated: [],
        commandsRun: []
      };

      this.emitStream(task.sessionId, {
        type: 'complete',
        message: 'Task completed successfully'
      });

    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message;
      
      this.emitStream(task.sessionId, {
        type: 'error',
        message: error.message
      });
    }
  }

  async getTaskStatus(taskId: string): Promise<Task | undefined> {
    return this.tasks.get(taskId);
  }

  streamOutput(sessionId: string, callback: (data: any) => void): void {
    if (!this.streamCallbacks.has(sessionId)) {
      this.streamCallbacks.set(sessionId, []);
    }
    this.streamCallbacks.get(sessionId)?.push(callback);
  }

  private emitStream(sessionId: string, data: any): void {
    const callbacks = this.streamCallbacks.get(sessionId) || [];
    callbacks.forEach(callback => callback(data));
  }
}
