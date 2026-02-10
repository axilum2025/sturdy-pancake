// ============================================================
// GiLo AI – Tool Executor Engine
// Central dispatcher for function calls from the LLM.
// Routes tool_call → handler based on tool type.
// ============================================================

import OpenAI from 'openai';
import type { ChatCompletionMessageFunctionToolCall } from 'openai/resources/chat/completions';

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------

/** Enhanced tool definition stored in AgentConfig.tools */
export interface AgentToolDefinition {
  id: string;
  name: string;
  type: 'builtin' | 'http' | 'mcp';
  description?: string;
  enabled: boolean;
  /** JSON Schema describing the function parameters */
  parameters?: Record<string, unknown>;
  /** Type-specific configuration */
  config?: {
    // HTTP Action fields
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    bodyTemplate?: string;
    auth?: {
      type: 'none' | 'api_key' | 'bearer';
      key?: string;
      headerName?: string;
    };
    // MCP fields
    serverId?: string;
    toolName?: string;
    // Built-in fields
    builtinId?: string;
    [key: string]: unknown;
  };
}

export interface ToolCallResult {
  success: boolean;
  result: string;
  error?: string;
  durationMs?: number;
}

/** Converts agent tool definitions to OpenAI tools format */
export function toOpenAITools(
  tools: AgentToolDefinition[]
): OpenAI.ChatCompletionTool[] {
  return tools
    .filter((t) => t.enabled)
    .map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description || `Tool: ${t.name}`,
        parameters: (t.parameters as OpenAI.FunctionParameters) || {
          type: 'object',
          properties: {},
        },
      },
    }));
}

// ----------------------------------------------------------
// Built-in tool handlers
// ----------------------------------------------------------

type BuiltinHandler = (args: Record<string, unknown>) => Promise<string>;

const builtinHandlers: Record<string, BuiltinHandler> = {
  /** Returns the current UTC date/time */
  get_current_time: async () => {
    const now = new Date();
    return JSON.stringify({
      utc: now.toISOString(),
      unix: Math.floor(now.getTime() / 1000),
      readable: now.toUTCString(),
    });
  },

  /** Simple math expression evaluator (safe – no eval) */
  calculator: async (args) => {
    const expr = String(args.expression || '');
    try {
      // Only allow digits, operators, parens, dots, spaces
      if (!/^[\d+\-*/().%\s]+$/.test(expr)) {
        return JSON.stringify({ error: 'Invalid expression' });
      }
      // Use Function constructor for safe numeric-only eval
      const fn = new Function(`"use strict"; return (${expr});`);
      const result = fn();
      if (typeof result !== 'number' || !isFinite(result)) {
        return JSON.stringify({ error: 'Result is not a finite number' });
      }
      return JSON.stringify({ expression: expr, result });
    } catch {
      return JSON.stringify({ error: 'Failed to evaluate expression' });
    }
  },

  /** Generate a random UUID */
  generate_uuid: async () => {
    const { randomUUID } = await import('crypto');
    return JSON.stringify({ uuid: randomUUID() });
  },

  /** Base64 encode/decode */
  base64: async (args) => {
    const action = String(args.action || 'encode');
    const input = String(args.input || '');
    if (action === 'decode') {
      return Buffer.from(input, 'base64').toString('utf-8');
    }
    return Buffer.from(input, 'utf-8').toString('base64');
  },

  /** JSON path extractor */
  json_extract: async (args) => {
    try {
      const data = typeof args.json === 'string' ? JSON.parse(args.json as string) : args.json;
      const path = String(args.path || '');
      const keys = path.split('.').filter(Boolean);
      let current: unknown = data;
      for (const key of keys) {
        if (current == null || typeof current !== 'object') {
          return JSON.stringify({ error: `Path "${path}" not found` });
        }
        current = (current as Record<string, unknown>)[key];
      }
      return JSON.stringify({ path, value: current });
    } catch {
      return JSON.stringify({ error: 'Invalid JSON input' });
    }
  },

  /** String utilities */
  string_utils: async (args) => {
    const input = String(args.input || '');
    const operation = String(args.operation || 'length');
    switch (operation) {
      case 'length':
        return JSON.stringify({ length: input.length });
      case 'uppercase':
        return input.toUpperCase();
      case 'lowercase':
        return input.toLowerCase();
      case 'reverse':
        return [...input].reverse().join('');
      case 'word_count':
        return JSON.stringify({ words: input.split(/\s+/).filter(Boolean).length });
      case 'trim':
        return input.trim();
      default:
        return JSON.stringify({ error: `Unknown operation: ${operation}` });
    }
  },
};

// ----------------------------------------------------------
// HTTP Action handler
// ----------------------------------------------------------

async function executeHttpAction(
  tool: AgentToolDefinition,
  args: Record<string, unknown>
): Promise<string> {
  const cfg = tool.config;
  if (!cfg?.url) {
    return JSON.stringify({ error: 'HTTP action has no URL configured' });
  }

  // Template substitution: replace {{paramName}} in URL and body
  let url = cfg.url;
  let body = cfg.bodyTemplate || '';
  for (const [key, value] of Object.entries(args)) {
    const placeholder = `{{${key}}}`;
    const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    url = url.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), strValue);
    body = body.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), strValue);
  }

  const method = (cfg.method || 'GET').toUpperCase();
  const headers: Record<string, string> = { ...cfg.headers };

  // Auth
  if (cfg.auth) {
    if (cfg.auth.type === 'bearer' && cfg.auth.key) {
      headers['Authorization'] = `Bearer ${cfg.auth.key}`;
    } else if (cfg.auth.type === 'api_key' && cfg.auth.key) {
      const headerName = cfg.auth.headerName || 'X-API-Key';
      headers[headerName] = cfg.auth.key;
    }
  }

  // Default content type for POST/PUT/PATCH
  if (['POST', 'PUT', 'PATCH'].includes(method) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(30_000), // 30s timeout
  };

  if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
    fetchOptions.body = body;
  }

  try {
    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get('content-type') || '';
    let responseBody: string;

    if (contentType.includes('application/json')) {
      const json = await response.json();
      responseBody = JSON.stringify(json, null, 2);
    } else {
      responseBody = await response.text();
      // Truncate very large responses
      if (responseBody.length > 10_000) {
        responseBody = responseBody.slice(0, 10_000) + '\n... [truncated]';
      }
    }

    return JSON.stringify({
      status: response.status,
      statusText: response.statusText,
      body: responseBody,
    });
  } catch (err: any) {
    return JSON.stringify({
      error: `HTTP request failed: ${err.message}`,
    });
  }
}

// ----------------------------------------------------------
// Main executor
// ----------------------------------------------------------

/**
 * Execute a single tool call from the LLM.
 *
 * @param toolCall  The OpenAI tool_call object (function type)
 * @param tools     The agent's tool definitions (for config lookup)
 */
export async function executeTool(
  toolCall: ChatCompletionMessageFunctionToolCall,
  tools: AgentToolDefinition[]
): Promise<ToolCallResult> {
  const start = Date.now();
  const fnName = toolCall.function.name;

  // Parse arguments
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(toolCall.function.arguments || '{}');
  } catch {
    return {
      success: false,
      result: '',
      error: `Failed to parse tool arguments for "${fnName}"`,
      durationMs: Date.now() - start,
    };
  }

  // Find the tool definition
  const tool = tools.find((t) => t.name === fnName && t.enabled);
  if (!tool) {
    return {
      success: false,
      result: '',
      error: `Tool "${fnName}" not found or not enabled`,
      durationMs: Date.now() - start,
    };
  }

  try {
    let result: string;

    switch (tool.type) {
      case 'builtin': {
        const handler = builtinHandlers[tool.config?.builtinId || tool.name];
        if (!handler) {
          return {
            success: false,
            result: '',
            error: `Unknown built-in tool: ${tool.name}`,
            durationMs: Date.now() - start,
          };
        }
        result = await handler(args);
        break;
      }

      case 'http': {
        result = await executeHttpAction(tool, args);
        break;
      }

      case 'mcp': {
        // Delegate to MCP service (lazy import to avoid circular deps)
        const { mcpService } = await import('./mcpService');
        const mcpResult = await mcpService.executeTool(
          tool.config?.serverId || '',
          tool.config?.toolName || tool.name,
          args
        );
        result = typeof mcpResult === 'string' ? mcpResult : JSON.stringify(mcpResult);
        break;
      }

      default:
        return {
          success: false,
          result: '',
          error: `Unknown tool type: ${tool.type}`,
          durationMs: Date.now() - start,
        };
    }

    return {
      success: true,
      result,
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      success: false,
      result: '',
      error: `Tool execution error: ${err.message}`,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Execute multiple tool calls in parallel.
 */
export async function executeToolCalls(
  toolCalls: ChatCompletionMessageFunctionToolCall[],
  tools: AgentToolDefinition[]
): Promise<Map<string, ToolCallResult>> {
  const results = new Map<string, ToolCallResult>();
  const promises = toolCalls.map(async (tc) => {
    const result = await executeTool(tc, tools);
    results.set(tc.id, result);
  });
  await Promise.all(promises);
  return results;
}
