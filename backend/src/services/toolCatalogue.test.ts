// ============================================================
// Tests: Tool Catalogue — structure & consistency
// ============================================================

import { describe, it, expect } from 'vitest';
import { BUILTIN_TOOLS, ToolCatalogueEntry } from './toolCatalogue';

describe('BUILTIN_TOOLS catalogue', () => {
  it('has at least 10 tools', () => {
    expect(BUILTIN_TOOLS.length).toBeGreaterThanOrEqual(10);
  });

  it('every tool has required fields', () => {
    for (const entry of BUILTIN_TOOLS) {
      expect(entry.category).toBeDefined();
      expect(entry.icon).toBeDefined();
      expect(typeof entry.premium).toBe('boolean');

      const def = entry.definition;
      expect(def.id).toBeDefined();
      expect(def.name).toBeDefined();
      expect(['builtin', 'http', 'mcp']).toContain(def.type);
      expect(def.enabled).toBe(true);
      expect(def.description).toBeDefined();
      expect(def.description!.length).toBeGreaterThan(5);
    }
  });

  it('all tool IDs are unique', () => {
    const ids = BUILTIN_TOOLS.map((t) => t.definition.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all tool names are unique', () => {
    const names = BUILTIN_TOOLS.map((t) => t.definition.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('tool IDs match the "builtin_" + name pattern', () => {
    for (const entry of BUILTIN_TOOLS) {
      expect(entry.definition.id).toBe(`builtin_${entry.definition.name}`);
    }
  });

  it('every tool has valid category', () => {
    const validCategories = ['productivity', 'developer', 'communication', 'data', 'web', 'utilities'];
    for (const entry of BUILTIN_TOOLS) {
      expect(validCategories).toContain(entry.category);
    }
  });

  it('builtin tools have a config with builtinId', () => {
    const builtinTools = BUILTIN_TOOLS.filter(e => e.definition.type === 'builtin');
    for (const entry of builtinTools) {
      expect(entry.definition.config).toBeDefined();
      expect(entry.definition.config!.builtinId).toBe(entry.definition.name);
    }
  });

  it('tools have valid parameter schemas', () => {
    for (const entry of BUILTIN_TOOLS) {
      const params = entry.definition.parameters;
      if (params) {
        expect((params as any).type).toBe('object');
        expect((params as any).properties).toBeDefined();
      }
    }
  });

  it('includes expected core tools', () => {
    const names = BUILTIN_TOOLS.map((t) => t.definition.name);
    expect(names).toContain('get_current_time');
    expect(names).toContain('calculator');
    expect(names).toContain('generate_uuid');
    expect(names).toContain('base64');
  });
});
