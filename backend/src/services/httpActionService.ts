// ============================================================
// GiLo AI – HTTP Action Service (API Connector)
// Manages reusable HTTP API actions configured as agent tools.
// Supports OpenAPI/Swagger import and URL templating.
// ============================================================

import type { AgentToolDefinition } from './toolExecutor';

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------

export interface HttpActionConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  bodyTemplate?: string;
  auth?: {
    type: 'none' | 'api_key' | 'bearer';
    key?: string;
    headerName?: string;
  };
  /** Response JSONPath (optional) to extract a subset */
  responsePath?: string;
  /** Timeout in ms (default 30000) */
  timeout?: number;
}

export interface OpenAPIOperation {
  operationId: string;
  summary?: string;
  description?: string;
  method: string;
  path: string;
  parameters?: Array<{
    name: string;
    in: string;
    description?: string;
    required?: boolean;
    schema?: Record<string, unknown>;
  }>;
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: Record<string, unknown> }>;
  };
}

// ----------------------------------------------------------
// OpenAPI / Swagger import
// ----------------------------------------------------------

/**
 * Parse an OpenAPI 3.x spec and extract operations as AgentToolDefinitions.
 * Accepts the parsed JSON object (not the raw string).
 */
export function parseOpenAPISpec(
  spec: Record<string, unknown>
): AgentToolDefinition[] {
  const tools: AgentToolDefinition[] = [];
  const paths = (spec.paths || {}) as Record<string, Record<string, unknown>>;
  const servers = (spec.servers || []) as Array<{ url?: string }>;
  const baseUrl = servers[0]?.url || '';

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, opRaw] of Object.entries(methods)) {
      if (['get', 'post', 'put', 'patch', 'delete'].indexOf(method) === -1) continue;
      const op = opRaw as OpenAPIOperation;

      const name = op.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const description = op.summary || op.description || `${method.toUpperCase()} ${path}`;

      // Build JSON Schema for parameters
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      // Path and query parameters
      if (op.parameters) {
        for (const param of op.parameters) {
          properties[param.name] = {
            type: (param.schema as any)?.type || 'string',
            description: param.description || param.name,
          };
          if (param.required) {
            required.push(param.name);
          }
        }
      }

      // Request body – flatten top-level properties
      if (op.requestBody?.content) {
        const jsonContent = op.requestBody.content['application/json'];
        if (jsonContent?.schema) {
          const bodySchema = jsonContent.schema as Record<string, unknown>;
          if ((bodySchema as any).properties) {
            for (const [propName, propSchema] of Object.entries((bodySchema as any).properties)) {
              properties[propName] = propSchema;
            }
            if (Array.isArray((bodySchema as any).required)) {
              required.push(...(bodySchema as any).required);
            }
          } else {
            // If the body is not an object, add a "body" param
            properties['body'] = bodySchema;
          }
        }
      }

      // Build URL with path parameter placeholders
      const url = `${baseUrl}${path}`.replace(/{(\w+)}/g, '{{$1}}');

      // Build body template if POST/PUT/PATCH
      let bodyTemplate: string | undefined;
      if (['post', 'put', 'patch'].includes(method)) {
        const bodyParams = Object.keys(properties).filter(
          (p) => !op.parameters?.some((param) => param.name === p)
        );
        if (bodyParams.length > 0) {
          const tmpl: Record<string, string> = {};
          for (const p of bodyParams) {
            tmpl[p] = `{{${p}}}`;
          }
          bodyTemplate = JSON.stringify(tmpl, null, 2);
        }
      }

      tools.push({
        id: `openapi_${name}`,
        name,
        type: 'http',
        description,
        enabled: true,
        parameters: {
          type: 'object',
          properties,
          required: required.length > 0 ? required : undefined,
        },
        config: {
          url,
          method: method.toUpperCase(),
          headers: { 'Content-Type': 'application/json' },
          bodyTemplate,
          auth: { type: 'none' },
        },
      });
    }
  }

  return tools;
}

/**
 * Test an HTTP action with sample arguments and return the result.
 */
export async function testHttpAction(
  config: HttpActionConfig,
  sampleArgs: Record<string, unknown>
): Promise<{
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
}> {
  const start = Date.now();

  let url = config.url;
  let body = config.bodyTemplate || '';
  for (const [key, value] of Object.entries(sampleArgs)) {
    const placeholder = `{{${key}}}`;
    const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    url = url.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), strValue);
    body = body.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), strValue);
  }

  const headers: Record<string, string> = { ...config.headers };
  if (config.auth) {
    if (config.auth.type === 'bearer' && config.auth.key) {
      headers['Authorization'] = `Bearer ${config.auth.key}`;
    } else if (config.auth.type === 'api_key' && config.auth.key) {
      headers[config.auth.headerName || 'X-API-Key'] = config.auth.key;
    }
  }

  const fetchOptions: RequestInit = {
    method: config.method,
    headers,
    signal: AbortSignal.timeout(config.timeout || 30_000),
  };

  if (['POST', 'PUT', 'PATCH'].includes(config.method) && body) {
    fetchOptions.body = body;
  }

  const response = await fetch(url, fetchOptions);
  const responseBody = await response.text();

  const respHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    respHeaders[key] = value;
  });

  return {
    status: response.status,
    statusText: response.statusText,
    headers: respHeaders,
    body: responseBody.length > 50_000 ? responseBody.slice(0, 50_000) + '\n...[truncated]' : responseBody,
    durationMs: Date.now() - start,
  };
}
