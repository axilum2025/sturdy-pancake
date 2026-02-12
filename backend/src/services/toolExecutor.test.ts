// ============================================================
// Tests: Tool Executor — pure function tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { toOpenAITools, AgentToolDefinition } from './toolExecutor';

describe('toOpenAITools', () => {
  it('converts enabled tools to OpenAI format', () => {
    const tools: AgentToolDefinition[] = [
      {
        id: 'tool1',
        name: 'get_time',
        type: 'builtin',
        description: 'Get the current time',
        enabled: true,
        parameters: { type: 'object', properties: {} },
      },
    ];
    const result = toOpenAITools(tools);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('function');
    expect(result[0].function.name).toBe('get_time');
    expect(result[0].function.description).toBe('Get the current time');
  });

  it('filters out disabled tools', () => {
    const tools: AgentToolDefinition[] = [
      {
        id: 'tool1',
        name: 'enabled_tool',
        type: 'builtin',
        description: 'Enabled',
        enabled: true,
        parameters: { type: 'object', properties: {} },
      },
      {
        id: 'tool2',
        name: 'disabled_tool',
        type: 'builtin',
        description: 'Disabled',
        enabled: false,
        parameters: { type: 'object', properties: {} },
      },
    ];
    const result = toOpenAITools(tools);
    expect(result).toHaveLength(1);
    expect(result[0].function.name).toBe('enabled_tool');
  });

  it('provides default description when missing', () => {
    const tools: AgentToolDefinition[] = [
      {
        id: 'tool1',
        name: 'my_tool',
        type: 'builtin',
        enabled: true,
        parameters: { type: 'object', properties: {} },
      },
    ];
    const result = toOpenAITools(tools);
    expect(result[0].function.description).toBe('Tool: my_tool');
  });

  it('provides default parameters when missing', () => {
    const tools: AgentToolDefinition[] = [
      {
        id: 'tool1',
        name: 'my_tool',
        type: 'builtin',
        description: 'Test',
        enabled: true,
      },
    ];
    const result = toOpenAITools(tools);
    expect(result[0].function.parameters).toEqual({
      type: 'object',
      properties: {},
    });
  });

  it('returns empty array for no tools', () => {
    expect(toOpenAITools([])).toEqual([]);
  });

  it('preserves parameter schema', () => {
    const params = {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results' },
      },
      required: ['query'],
    };
    const tools: AgentToolDefinition[] = [
      {
        id: 'tool1',
        name: 'search',
        type: 'builtin',
        description: 'Search',
        enabled: true,
        parameters: params,
      },
    ];
    const result = toOpenAITools(tools);
    expect(result[0].function.parameters).toEqual(params);
  });
});
