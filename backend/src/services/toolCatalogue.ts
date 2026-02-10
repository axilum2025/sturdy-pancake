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

  // ==================== Filesystem ====================
  {
    category: 'productivity',
    icon: 'FileText',
    premium: false,
    definition: {
      id: 'builtin_fs_read',
      name: 'fs_read',
      type: 'builtin',
      description: 'Read a file from the agent sandbox (sandboxed – cannot escape)',
      enabled: true,
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative path inside the sandbox, e.g. "notes/todo.txt"',
          },
        },
        required: ['path'],
      },
      config: { builtinId: 'fs_read' },
    },
  },
  {
    category: 'productivity',
    icon: 'FilePlus',
    premium: false,
    definition: {
      id: 'builtin_fs_write',
      name: 'fs_write',
      type: 'builtin',
      description: 'Write or overwrite a file in the agent sandbox',
      enabled: true,
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative path inside the sandbox, e.g. "output/report.md"',
          },
          content: {
            type: 'string',
            description: 'Content to write to the file',
          },
        },
        required: ['path', 'content'],
      },
      config: { builtinId: 'fs_write' },
    },
  },
  {
    category: 'productivity',
    icon: 'FolderOpen',
    premium: false,
    definition: {
      id: 'builtin_fs_list',
      name: 'fs_list',
      type: 'builtin',
      description: 'List files and directories in the agent sandbox',
      enabled: true,
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative directory path inside the sandbox (default: root ".")',
          },
        },
      },
      config: { builtinId: 'fs_list' },
    },
  },

  // ==================== Database ====================
  {
    category: 'data',
    icon: 'Database',
    premium: true,
    definition: {
      id: 'builtin_db_query',
      name: 'db_query',
      type: 'builtin',
      description: 'Execute a read-only SQL query (SELECT/WITH/EXPLAIN only) against a PostgreSQL database',
      enabled: true,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The SQL query to execute (SELECT only)',
          },
          connection_string: {
            type: 'string',
            description: 'PostgreSQL connection string, e.g. postgresql://user:pass@host:5432/db',
          },
        },
        required: ['query', 'connection_string'],
      },
      config: { builtinId: 'db_query' },
    },
  },

  // ==================== Communication ====================
  {
    category: 'communication',
    icon: 'Mail',
    premium: true,
    definition: {
      id: 'builtin_send_email',
      name: 'send_email',
      type: 'builtin',
      description: 'Send an email via SendGrid API',
      enabled: true,
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Recipient email address',
          },
          subject: {
            type: 'string',
            description: 'Email subject line',
          },
          body: {
            type: 'string',
            description: 'Email body (plain text)',
          },
          from: {
            type: 'string',
            description: 'Sender email address (optional, defaults to noreply@gilo.dev)',
          },
          api_key: {
            type: 'string',
            description: 'SendGrid API key (optional if SENDGRID_API_KEY env var is set)',
          },
        },
        required: ['to', 'subject', 'body'],
      },
      config: { builtinId: 'send_email' },
    },
  },

  // ==================== Calendar ====================
  {
    category: 'productivity',
    icon: 'Calendar',
    premium: true,
    definition: {
      id: 'builtin_calendar_list_events',
      name: 'calendar_list_events',
      type: 'builtin',
      description: 'List upcoming events from a Google Calendar',
      enabled: true,
      parameters: {
        type: 'object',
        properties: {
          access_token: {
            type: 'string',
            description: 'Google OAuth2 access token with calendar read scope',
          },
          calendar_id: {
            type: 'string',
            description: 'Calendar ID (default: "primary")',
          },
          max_results: {
            type: 'number',
            description: 'Max number of events to return (default: 10)',
          },
        },
        required: ['access_token'],
      },
      config: { builtinId: 'calendar_list_events' },
    },
  },
  {
    category: 'productivity',
    icon: 'CalendarPlus',
    premium: true,
    definition: {
      id: 'builtin_calendar_create_event',
      name: 'calendar_create_event',
      type: 'builtin',
      description: 'Create a new event in Google Calendar',
      enabled: true,
      parameters: {
        type: 'object',
        properties: {
          access_token: {
            type: 'string',
            description: 'Google OAuth2 access token with calendar write scope',
          },
          summary: {
            type: 'string',
            description: 'Event title',
          },
          start_time: {
            type: 'string',
            description: 'Event start time in ISO 8601 format',
          },
          end_time: {
            type: 'string',
            description: 'Event end time in ISO 8601 format',
          },
          description: {
            type: 'string',
            description: 'Event description (optional)',
          },
          location: {
            type: 'string',
            description: 'Event location (optional)',
          },
          calendar_id: {
            type: 'string',
            description: 'Calendar ID (default: "primary")',
          },
        },
        required: ['access_token', 'summary', 'start_time', 'end_time'],
      },
      config: { builtinId: 'calendar_create_event' },
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
