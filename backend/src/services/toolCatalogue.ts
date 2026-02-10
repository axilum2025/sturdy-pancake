// ============================================================
// GiLo AI – Built-in Tools Catalogue
// Pre-built tool definitions that users can add to their agents
// with one click. Each tool is a complete AgentToolDefinition.
// ============================================================

import type { AgentToolDefinition } from './toolExecutor';

export interface ToolCatalogueEntry {
  /** Tool definition ready to inject into agent config */
  definition: AgentToolDefinition;
  /** Display category */
  category: 'productivity' | 'developer' | 'communication' | 'data' | 'web' | 'utilities';
  /** Icon name (Lucide icon) */
  icon: string;
  /** Whether this is a premium-only tool */
  premium: boolean;
}

// ----------------------------------------------------------
// Built-in tools
// ----------------------------------------------------------

export const BUILTIN_TOOLS: ToolCatalogueEntry[] = [
  // ==================== Utilities ====================
  {
    category: 'utilities',
    icon: 'Clock',
    premium: false,
    definition: {
      id: 'builtin_get_current_time',
      name: 'get_current_time',
      type: 'builtin',
      description: 'Get the current date and time in UTC',
      enabled: true,
      parameters: {
        type: 'object',
        properties: {},
      },
      config: { builtinId: 'get_current_time' },
    },
  },
  {
    category: 'utilities',
    icon: 'Calculator',
    premium: false,
    definition: {
      id: 'builtin_calculator',
      name: 'calculator',
      type: 'builtin',
      description: 'Evaluate a mathematical expression (supports +, -, *, /, %, parentheses)',
      enabled: true,
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'The mathematical expression to evaluate, e.g. "(2 + 3) * 4"',
          },
        },
        required: ['expression'],
      },
      config: { builtinId: 'calculator' },
    },
  },
  {
    category: 'utilities',
    icon: 'Fingerprint',
    premium: false,
    definition: {
      id: 'builtin_generate_uuid',
      name: 'generate_uuid',
      type: 'builtin',
      description: 'Generate a random UUID v4',
      enabled: true,
      parameters: {
        type: 'object',
        properties: {},
      },
      config: { builtinId: 'generate_uuid' },
    },
  },
  {
    category: 'utilities',
    icon: 'Binary',
    premium: false,
    definition: {
      id: 'builtin_base64',
      name: 'base64',
      type: 'builtin',
      description: 'Encode or decode text using Base64',
      enabled: true,
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['encode', 'decode'],
            description: 'Whether to encode or decode',
          },
          input: {
            type: 'string',
            description: 'The text to encode/decode',
          },
        },
        required: ['action', 'input'],
      },
      config: { builtinId: 'base64' },
    },
  },
  {
    category: 'utilities',
    icon: 'Type',
    premium: false,
    definition: {
      id: 'builtin_string_utils',
      name: 'string_utils',
      type: 'builtin',
      description: 'String manipulation utilities: length, uppercase, lowercase, reverse, word_count, trim',
      enabled: true,
      parameters: {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'The input string',
          },
          operation: {
            type: 'string',
            enum: ['length', 'uppercase', 'lowercase', 'reverse', 'word_count', 'trim'],
            description: 'The string operation to perform',
          },
        },
        required: ['input', 'operation'],
      },
      config: { builtinId: 'string_utils' },
    },
  },

  // ==================== Data ====================
  {
    category: 'data',
    icon: 'Braces',
    premium: false,
    definition: {
      id: 'builtin_json_extract',
      name: 'json_extract',
      type: 'builtin',
      description: 'Extract a value from a JSON object using dot notation path (e.g. "data.items.0.name")',
      enabled: true,
      parameters: {
        type: 'object',
        properties: {
          json: {
            type: 'string',
            description: 'The JSON string to extract from',
          },
          path: {
            type: 'string',
            description: 'Dot-notation path, e.g. "items.0.name"',
          },
        },
        required: ['json', 'path'],
      },
      config: { builtinId: 'json_extract' },
    },
  },

  // ==================== Web ====================
  {
    category: 'web',
    icon: 'Globe',
    premium: false,
    definition: {
      id: 'builtin_http_get',
      name: 'http_get',
      type: 'http',
      description: 'Make an HTTP GET request to any URL and return the response',
      enabled: true,
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to request',
          },
        },
        required: ['url'],
      },
      config: {
        url: '{{url}}',
        method: 'GET',
        headers: { 'User-Agent': 'GiLo-AI-Agent/1.0' },
        auth: { type: 'none' },
      },
    },
  },
  {
    category: 'web',
    icon: 'Send',
    premium: false,
    definition: {
      id: 'builtin_http_post',
      name: 'http_post',
      type: 'http',
      description: 'Make an HTTP POST request with a JSON body',
      enabled: true,
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to request',
          },
          body: {
            type: 'string',
            description: 'The JSON body to send',
          },
        },
        required: ['url', 'body'],
      },
      config: {
        url: '{{url}}',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GiLo-AI-Agent/1.0',
        },
        bodyTemplate: '{{body}}',
        auth: { type: 'none' },
      },
    },
  },

  // ==================== Developer ====================
  {
    category: 'developer',
    icon: 'Code',
    premium: false,
    definition: {
      id: 'builtin_webhook_trigger',
      name: 'webhook_trigger',
      type: 'http',
      description: 'Trigger a webhook by sending a POST request with custom JSON payload',
      enabled: true,
      parameters: {
        type: 'object',
        properties: {
          webhook_url: {
            type: 'string',
            description: 'The webhook URL to trigger',
          },
          payload: {
            type: 'string',
            description: 'JSON payload to send',
          },
        },
        required: ['webhook_url', 'payload'],
      },
      config: {
        url: '{{webhook_url}}',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        bodyTemplate: '{{payload}}',
        auth: { type: 'none' },
      },
    },
  },
];

// ----------------------------------------------------------
// Lookup helpers
// ----------------------------------------------------------

/** Get all catalogue entries, optionally filtered by category */
export function getCatalogueTools(category?: string): ToolCatalogueEntry[] {
  if (!category) return BUILTIN_TOOLS;
  return BUILTIN_TOOLS.filter((t) => t.category === category);
}

/** Get a single tool definition by its ID */
export function getCatalogueTool(toolId: string): AgentToolDefinition | undefined {
  return BUILTIN_TOOLS.find((t) => t.definition.id === toolId)?.definition;
}

/** Available categories with counts */
export function getCatalogueCategories(): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const tool of BUILTIN_TOOLS) {
    counts.set(tool.category, (counts.get(tool.category) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
}
