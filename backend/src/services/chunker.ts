// ============================================================
// GiLo AI – Text Chunking Service
// Splits text into overlapping chunks for embedding
// ============================================================

export interface ChunkOptions {
  maxTokens?: number;    // ~500 tokens per chunk
  overlapTokens?: number; // ~50 tokens overlap
  separator?: string;
}

export interface TextChunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
  metadata?: {
    page?: number;
    section?: string;
  };
}

/**
 * Rough token estimation: ~4 chars per token for English.
 * This is faster than actual tokenization and acceptable for chunking.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into sentences (simple heuristic)
 */
function splitSentences(text: string): string[] {
  // Split on period/question/exclamation followed by space or newline
  return text
    .split(/(?<=[.!?])\s+|(?:\r?\n){2,}/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Split text into chunks with overlap.
 * Strategy: sentence-aware chunking to avoid cutting mid-sentence.
 */
export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const maxTokens = options.maxTokens ?? 500;
  const overlapTokens = options.overlapTokens ?? 50;
  const maxChars = maxTokens * 4;
  const overlapChars = overlapTokens * 4;

  // Handle empty / whitespace-only text
  const trimmed = text.trim();
  if (!trimmed) return [];

  // If text is small enough, return as single chunk
  if (estimateTokens(trimmed) <= maxTokens) {
    return [{
      content: trimmed,
      chunkIndex: 0,
      tokenCount: estimateTokens(trimmed),
    }];
  }

  const sentences = splitSentences(text);
  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let chunkIndex = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];

    // If adding this sentence exceeds the limit
    if (currentChunk.length + sentence.length + 1 > maxChars && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex,
        tokenCount: estimateTokens(currentChunk),
      });
      chunkIndex++;

      // Start new chunk with overlap from the end of current chunk
      if (overlapChars > 0 && currentChunk.length > overlapChars) {
        // Take the last overlapChars of the current chunk
        const overlapStart = currentChunk.length - overlapChars;
        // Find a sentence boundary near the overlap start
        const overlapText = currentChunk.substring(overlapStart);
        const firstSentEnd = overlapText.indexOf('. ');
        if (firstSentEnd > 0 && firstSentEnd < overlapChars / 2) {
          currentChunk = overlapText.substring(firstSentEnd + 2);
        } else {
          currentChunk = overlapText;
        }
      } else {
        currentChunk = '';
      }
    }

    currentChunk += (currentChunk ? ' ' : '') + sentence;
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      chunkIndex,
      tokenCount: estimateTokens(currentChunk),
    });
  }

  return chunks;
}

/**
 * Chunk text with page metadata (for PDFs)
 */
export function chunkTextWithPages(text: string, pages: number, options: ChunkOptions = {}): TextChunk[] {
  const chunks = chunkText(text, options);

  // Rough page assignment: distribute chunks across pages
  if (pages > 1) {
    const chunkPerPage = chunks.length / pages;
    chunks.forEach((chunk, i) => {
      chunk.metadata = { page: Math.floor(i / chunkPerPage) + 1 };
    });
  }

  return chunks;
}
