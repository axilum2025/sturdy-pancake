// ============================================================
// Tests: HTTP Action Service — OpenAPI parser
// ============================================================

import { describe, it, expect } from 'vitest';
import { parseOpenAPISpec } from './httpActionService';

describe('parseOpenAPISpec', () => {
  const sampleSpec = {
    openapi: '3.0.0',
    info: { title: 'Pet Store', version: '1.0.0' },
    servers: [{ url: 'https://petstore.example.com/v1' }],
    paths: {
      '/pets': {
        get: {
          operationId: 'listPets',
          summary: 'List all pets',
          parameters: [
            {
              name: 'limit',
              in: 'query',
              description: 'Max items',
              required: false,
              schema: { type: 'integer' },
            },
          ],
        },
        post: {
          operationId: 'createPet',
          summary: 'Create a pet',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Pet name' },
                    tag: { type: 'string', description: 'Optional tag' },
                  },
                  required: ['name'],
                },
              },
            },
          },
        },
      },
      '/pets/{petId}': {
        get: {
          operationId: 'getPet',
          summary: 'Get a pet by ID',
          parameters: [
            {
              name: 'petId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
        },
        delete: {
          operationId: 'deletePet',
          summary: 'Delete a pet',
          parameters: [
            {
              name: 'petId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
        },
      },
    },
  };

  it('extracts all operations from paths', () => {
    const tools = parseOpenAPISpec(sampleSpec);
    expect(tools).toHaveLength(4);
    const names = tools.map(t => t.name);
    expect(names).toContain('listPets');
    expect(names).toContain('createPet');
    expect(names).toContain('getPet');
    expect(names).toContain('deletePet');
  });

  it('sets correct HTTP method in config', () => {
    const tools = parseOpenAPISpec(sampleSpec);
    const listPets = tools.find(t => t.name === 'listPets')!;
    expect(listPets.config?.method).toBe('GET');
    const createPet = tools.find(t => t.name === 'createPet')!;
    expect(createPet.config?.method).toBe('POST');
  });

  it('builds URL with base URL and path templates', () => {
    const tools = parseOpenAPISpec(sampleSpec);
    const getPet = tools.find(t => t.name === 'getPet')!;
    expect(getPet.config?.url).toBe('https://petstore.example.com/v1/pets/{{petId}}');
  });

  it('extracts query parameters', () => {
    const tools = parseOpenAPISpec(sampleSpec);
    const listPets = tools.find(t => t.name === 'listPets')!;
    const params = listPets.parameters as any;
    expect(params.properties.limit).toBeDefined();
    expect(params.properties.limit.type).toBe('integer');
  });

  it('extracts path parameters as required', () => {
    const tools = parseOpenAPISpec(sampleSpec);
    const getPet = tools.find(t => t.name === 'getPet')!;
    const params = getPet.parameters as any;
    expect(params.properties.petId).toBeDefined();
    expect(params.required).toContain('petId');
  });

  it('extracts request body properties', () => {
    const tools = parseOpenAPISpec(sampleSpec);
    const createPet = tools.find(t => t.name === 'createPet')!;
    const params = createPet.parameters as any;
    expect(params.properties.name).toBeDefined();
    expect(params.properties.tag).toBeDefined();
    expect(params.required).toContain('name');
  });

  it('generates body template for POST operations', () => {
    const tools = parseOpenAPISpec(sampleSpec);
    const createPet = tools.find(t => t.name === 'createPet')!;
    expect(createPet.config?.bodyTemplate).toBeDefined();
    const tmpl = JSON.parse(createPet.config!.bodyTemplate as string);
    expect(tmpl.name).toBe('{{name}}');
    expect(tmpl.tag).toBe('{{tag}}');
  });

  it('uses summary as description', () => {
    const tools = parseOpenAPISpec(sampleSpec);
    const listPets = tools.find(t => t.name === 'listPets')!;
    expect(listPets.description).toBe('List all pets');
  });

  it('all tools have type http', () => {
    const tools = parseOpenAPISpec(sampleSpec);
    for (const tool of tools) {
      expect(tool.type).toBe('http');
    }
  });

  it('returns empty for spec with no paths', () => {
    expect(parseOpenAPISpec({ openapi: '3.0.0', paths: {} })).toEqual([]);
    expect(parseOpenAPISpec({ openapi: '3.0.0' })).toEqual([]);
  });

  it('generates name from path when operationId is missing', () => {
    const spec = {
      openapi: '3.0.0',
      servers: [{ url: 'https://api.example.com' }],
      paths: {
        '/users': {
          get: {
            summary: 'List users',
          },
        },
      },
    };
    const tools = parseOpenAPISpec(spec);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toMatch(/get.*users/i);
  });
});
