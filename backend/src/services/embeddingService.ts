// ============================================================
// GiLo AI – Embedding Service
// Generates embeddings via OpenAI-compatible API (GitHub Models)
// ============================================================

import OpenAI from 'openai';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const githubToken = process.env.GITHUB_TOKEN;
    client = new OpenAI({
      baseURL: process.env.COPILOT_API_URL || 'https://models.github.ai/inference',
      apiKey: githubToken || 'dummy',
    });
  }
  return client;
}

const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dimensions
const MAX_BATCH_SIZE = 50; // Max texts per API call

/**
 * Generate embeddings for an array of texts.
 * Returns array of float arrays (1536 dimensions each).
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const openai = getClient();
  const results: number[][] = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });

    for (const item of response.data) {
      results.push(item.embedding);
    }
  }

  return results;
}

/**
 * Generate a single embedding for a query string.
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const [embedding] = await generateEmbeddings([query]);
  return embedding;
}

/**
 * Compute cosine similarity between two vectors.
 * Used as fallback when pgvector is not available.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
