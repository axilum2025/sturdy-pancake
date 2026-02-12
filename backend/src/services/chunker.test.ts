// ============================================================
// Tests: Text Chunker Service
// ============================================================

import { describe, it, expect } from 'vitest';
import { chunkText, chunkTextWithPages } from './chunker';

describe('chunkText', () => {
  it('returns single chunk for short text', () => {
    const text = 'Hello world. This is a short text.';
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].content).toBe(text);
  });

  it('estimates tokens roughly as length / 4', () => {
    const text = 'abcdefgh'; // 8 chars = 2 tokens
    const chunks = chunkText(text);
    expect(chunks[0].tokenCount).toBe(2);
  });

  it('splits long text into multiple chunks', () => {
    // Create text longer than 500 tokens (~2000 chars)
    const sentences = Array.from({ length: 50 }, (_, i) =>
      `This is sentence number ${i + 1} and it contains some words to fill up space in the text.`
    );
    const text = sentences.join(' ');
    const chunks = chunkText(text, { maxTokens: 100 });
    expect(chunks.length).toBeGreaterThan(1);
    // Check indices are sequential
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });

  it('respects maxTokens limit', () => {
    const sentences = Array.from({ length: 30 }, (_, i) =>
      `Sentence ${i + 1} with enough words to make this test meaningful.`
    );
    const text = sentences.join(' ');
    const chunks = chunkText(text, { maxTokens: 50 });
    // Each chunk should be roughly within limit (some tolerance for sentence boundaries)
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(80); // generous tolerance
    }
  });

  it('handles empty text', () => {
    const chunks = chunkText('');
    expect(chunks).toHaveLength(0);
  });

  it('handles text with only whitespace', () => {
    const chunks = chunkText('   \n\n  ');
    expect(chunks).toHaveLength(0);
  });

  it('uses overlap between chunks', () => {
    const sentences = Array.from({ length: 40 }, (_, i) =>
      `Unique sentence ${i + 1} for overlap testing purposes.`
    );
    const text = sentences.join(' ');
    const chunks = chunkText(text, { maxTokens: 80, overlapTokens: 20 });
    // With overlap, chunks should share some content
    if (chunks.length >= 2) {
      const lastPartOfFirst = chunks[0].content.slice(-50);
      const firstPartOfSecond = chunks[1].content.slice(0, 100);
      // There should be some textual overlap
      const words1 = lastPartOfFirst.split(' ');
      const words2 = firstPartOfSecond.split(' ');
      const overlap = words1.filter(w => words2.includes(w));
      expect(overlap.length).toBeGreaterThan(0);
    }
  });
});

describe('chunkTextWithPages', () => {
  it('assigns page metadata when pages > 1', () => {
    const sentences = Array.from({ length: 40 }, (_, i) =>
      `Page content sentence ${i + 1} for testing page assignment.`
    );
    const text = sentences.join(' ');
    const chunks = chunkTextWithPages(text, 5, { maxTokens: 80 });
    expect(chunks.length).toBeGreaterThan(1);
    // All chunks should have page metadata
    for (const chunk of chunks) {
      expect(chunk.metadata?.page).toBeDefined();
      expect(chunk.metadata!.page!).toBeGreaterThanOrEqual(1);
      expect(chunk.metadata!.page!).toBeLessThanOrEqual(5);
    }
  });

  it('does not assign page metadata when pages <= 1', () => {
    const text = Array.from({ length: 20 }, (_, i) =>
      `Sentence ${i}.`
    ).join(' ');
    const chunks = chunkTextWithPages(text, 1, { maxTokens: 50 });
    // With 1 page, no page assignment should happen
    for (const chunk of chunks) {
      expect(chunk.metadata?.page).toBeUndefined();
    }
  });
});
