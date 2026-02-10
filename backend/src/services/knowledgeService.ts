// ============================================================
// GiLo AI – Knowledge Base Service
// Orchestrates document upload, chunking, embedding, and search
// ============================================================

import { eq, and, sql, desc } from 'drizzle-orm';
import { getDb } from '../db';
import { knowledgeDocuments, knowledgeChunks } from '../db/schema';
import { parseDocument, isSupportedMimeType } from './documentParser';
import { chunkText, chunkTextWithPages, TextChunk } from './chunker';
import { generateEmbeddings, generateQueryEmbedding, cosineSimilarity } from './embeddingService';
import { scrapeUrl } from './urlScraperService';

// ---- Types ----

export interface KnowledgeDocument {
  id: string;
  agentId: string;
  userId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  chunkCount: number;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  agentId: string;
  content: string;
  chunkIndex: number;
  tokenCount: number;
  embedding: number[] | null;
  metadata: { page?: number; section?: string; source?: string } | null;
  createdAt: Date;
}

export interface SearchResult {
  chunkId: string;
  content: string;
  score: number;
  documentId: string;
  filename: string;
  metadata: KnowledgeChunk['metadata'];
}

export interface RagCitation {
  documentId: string;
  filename: string;
  page: number | null;
  score: number;
  snippet: string;
}

// ---- Service ----

class KnowledgeService {
  /**
   * Process an uploaded document: parse → chunk → embed → store
   */
  async processDocument(
    agentId: string,
    userId: string,
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<KnowledgeDocument> {
    const db = getDb();

    if (!isSupportedMimeType(mimeType)) {
      throw new Error(`Unsupported file type: ${mimeType}. Supported: PDF, DOCX, TXT, MD, CSV, JSON`);
    }

    // 1. Create document record (status: processing)
    const [doc] = await db.insert(knowledgeDocuments).values({
      agentId,
      userId,
      filename,
      mimeType,
      fileSize: buffer.length,
      status: 'processing',
    }).returning();

    // Process asynchronously: parse → chunk → embed → store
    this.processAsync(doc.id, agentId, buffer, mimeType, filename).catch(err => {
      console.error(`Knowledge processing error for doc ${doc.id}:`, err);
    });

    return doc as unknown as KnowledgeDocument;
  }

  private async processAsync(
    docId: string,
    agentId: string,
    buffer: Buffer,
    mimeType: string,
    filename: string,
  ): Promise<void> {
    const db = getDb();

    try {
      // 2. Parse document
      const parsed = await parseDocument(buffer, mimeType, filename);

      if (!parsed.text || parsed.text.trim().length === 0) {
        await db.update(knowledgeDocuments)
          .set({ status: 'error', errorMessage: 'Document is empty or could not be parsed' })
          .where(eq(knowledgeDocuments.id, docId));
        return;
      }

      // 3. Chunk text
      let chunks: TextChunk[];
      if (parsed.pages && parsed.pages > 1) {
        chunks = chunkTextWithPages(parsed.text, parsed.pages, { maxTokens: 500, overlapTokens: 50 });
      } else {
        chunks = chunkText(parsed.text, { maxTokens: 500, overlapTokens: 50 });
      }

      if (chunks.length === 0) {
        await db.update(knowledgeDocuments)
          .set({ status: 'error', errorMessage: 'No text chunks produced' })
          .where(eq(knowledgeDocuments.id, docId));
        return;
      }

      // 4. Generate embeddings
      let embeddings: number[][] = [];
      try {
        embeddings = await generateEmbeddings(chunks.map(c => c.content));
      } catch (embErr: any) {
        console.warn(`Embedding generation failed for doc ${docId}, storing without embeddings:`, embErr.message);
        // Continue without embeddings — search will use keyword fallback
      }

      // 5. Store chunks in DB
      const chunkRows = chunks.map((chunk, i) => ({
        documentId: docId,
        agentId,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        tokenCount: chunk.tokenCount,
        embedding: embeddings[i] || null,
        metadata: {
          source: filename,
          ...(chunk.metadata || {}),
        },
      }));

      // Insert in batches of 100
      for (let i = 0; i < chunkRows.length; i += 100) {
        const batch = chunkRows.slice(i, i + 100);
        await db.insert(knowledgeChunks).values(batch);
      }

      // 6. Update document status
      await db.update(knowledgeDocuments)
        .set({ chunkCount: chunks.length, status: 'ready' })
        .where(eq(knowledgeDocuments.id, docId));

      console.log(`✅ Knowledge doc ${filename}: ${chunks.length} chunks indexed (${embeddings.length} with embeddings)`);
    } catch (error: any) {
      console.error(`Knowledge processing error:`, error);
      await db.update(knowledgeDocuments)
        .set({ status: 'error', errorMessage: error.message })
        .where(eq(knowledgeDocuments.id, docId));
    }
  }

  /**
   * Process a URL: scrape → chunk → embed → store
   */
  async processUrl(
    agentId: string,
    userId: string,
    url: string,
  ): Promise<KnowledgeDocument> {
    const db = getDb();

    // 1. Create document record (status: processing)
    const [doc] = await db.insert(knowledgeDocuments).values({
      agentId,
      userId,
      filename: url,
      mimeType: 'text/html',
      fileSize: 0,
      status: 'processing',
    }).returning();

    // Process asynchronously
    this.processUrlAsync(doc.id, agentId, url).catch(err => {
      console.error(`URL scrape error for doc ${doc.id}:`, err);
    });

    return doc as unknown as KnowledgeDocument;
  }

  private async processUrlAsync(docId: string, agentId: string, url: string): Promise<void> {
    const db = getDb();

    try {
      const scraped = await scrapeUrl(url);

      if (!scraped.text || scraped.text.length < 50) {
        await db.update(knowledgeDocuments)
          .set({ status: 'error', errorMessage: 'URL yielded too little text content' })
          .where(eq(knowledgeDocuments.id, docId));
        return;
      }

      // Update file size with actual byte length
      await db.update(knowledgeDocuments)
        .set({ fileSize: scraped.byteLength, filename: `🌐 ${scraped.title}` })
        .where(eq(knowledgeDocuments.id, docId));

      // Chunk → embed → store (reuse the same pipeline)
      const chunks = chunkText(scraped.text, { maxTokens: 500, overlapTokens: 50 });

      if (chunks.length === 0) {
        await db.update(knowledgeDocuments)
          .set({ status: 'error', errorMessage: 'No text chunks produced from URL' })
          .where(eq(knowledgeDocuments.id, docId));
        return;
      }

      let embeddings: number[][] = [];
      try {
        embeddings = await generateEmbeddings(chunks.map(c => c.content));
      } catch (embErr: any) {
        console.warn(`Embedding generation failed for URL doc ${docId}:`, embErr.message);
      }

      const chunkRows = chunks.map((chunk, i) => ({
        documentId: docId,
        agentId,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        tokenCount: chunk.tokenCount,
        embedding: embeddings[i] || null,
        metadata: { source: url, section: scraped.title },
      }));

      for (let i = 0; i < chunkRows.length; i += 100) {
        const batch = chunkRows.slice(i, i + 100);
        await db.insert(knowledgeChunks).values(batch);
      }

      await db.update(knowledgeDocuments)
        .set({ chunkCount: chunks.length, status: 'ready' })
        .where(eq(knowledgeDocuments.id, docId));

      console.log(`✅ URL scraped ${url}: ${chunks.length} chunks indexed`);
    } catch (error: any) {
      console.error(`URL scrape error:`, error);
      await db.update(knowledgeDocuments)
        .set({ status: 'error', errorMessage: error.message })
        .where(eq(knowledgeDocuments.id, docId));
    }
  }

  /**
   * List documents for an agent
   */
  async listDocuments(agentId: string): Promise<KnowledgeDocument[]> {
    const db = getDb();
    const rows = await db.select().from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.agentId, agentId))
      .orderBy(desc(knowledgeDocuments.createdAt));
    return rows as unknown as KnowledgeDocument[];
  }

  /**
   * Get a single document
   */
  async getDocument(docId: string): Promise<KnowledgeDocument | null> {
    const db = getDb();
    const [row] = await db.select().from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, docId))
      .limit(1);
    return (row as unknown as KnowledgeDocument) || null;
  }

  /**
   * Delete a document and its chunks
   */
  async deleteDocument(docId: string, userId: string): Promise<boolean> {
    const db = getDb();
    const result = await db.delete(knowledgeDocuments)
      .where(and(
        eq(knowledgeDocuments.id, docId),
        eq(knowledgeDocuments.userId, userId),
      ))
      .returning();
    return result.length > 0;
  }

  /**
   * Semantic search: find most relevant chunks for a query.
   *
   * Strategy:
   * 1. Try pgvector cosine distance if embeddings exist
   * 2. Fall back to in-memory cosine similarity
   * 3. Fall back to keyword search if no embeddings at all
   */
  async search(agentId: string, query: string, topK: number = 5): Promise<SearchResult[]> {
    const db = getDb();

    // Check if we have any chunks with embeddings
    const [embCheck] = await db.select({ count: sql<number>`count(*)` })
      .from(knowledgeChunks)
      .where(and(
        eq(knowledgeChunks.agentId, agentId),
        sql`${knowledgeChunks.embedding} IS NOT NULL`,
      ));

    const hasEmbeddings = Number(embCheck?.count || 0) > 0;

    if (hasEmbeddings) {
      return this.vectorSearch(agentId, query, topK);
    }

    // Fallback: keyword search
    return this.keywordSearch(agentId, query, topK);
  }

  private async vectorSearch(agentId: string, query: string, topK: number): Promise<SearchResult[]> {
    const db = getDb();

    try {
      // Generate query embedding
      const queryEmbedding = await generateQueryEmbedding(query);

      // Use pgvector cosine distance operator
      const results = await db.execute(sql`
        SELECT
          kc.id as chunk_id,
          kc.content,
          kc.document_id,
          kc.metadata,
          kd.filename,
          1 - (kc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as score
        FROM knowledge_chunks kc
        JOIN knowledge_documents kd ON kd.id = kc.document_id
        WHERE kc.agent_id = ${agentId}
          AND kc.embedding IS NOT NULL
        ORDER BY kc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${topK}
      `);

      return (results.rows as any[]).map(row => ({
        chunkId: row.chunk_id,
        content: row.content,
        score: Number(row.score),
        documentId: row.document_id,
        filename: row.filename,
        metadata: row.metadata,
      }));
    } catch (error: any) {
      console.warn('Vector search failed, falling back to keyword:', error.message);
      return this.keywordSearch(agentId, query, topK);
    }
  }

  private async keywordSearch(agentId: string, query: string, topK: number): Promise<SearchResult[]> {
    const db = getDb();

    // Simple keyword search using ILIKE
    const words = query.split(/\s+/).filter(w => w.length > 2).slice(0, 5);
    if (words.length === 0) return [];

    const likeConditions = words.map(w => sql`${knowledgeChunks.content} ILIKE ${'%' + w + '%'}`);
    const combinedCondition = sql.join(likeConditions, sql` OR `);

    const results = await db.execute(sql`
      SELECT
        kc.id as chunk_id,
        kc.content,
        kc.document_id,
        kc.metadata,
        kd.filename
      FROM knowledge_chunks kc
      JOIN knowledge_documents kd ON kd.id = kc.document_id
      WHERE kc.agent_id = ${agentId}
        AND (${combinedCondition})
      LIMIT ${topK}
    `);

    return (results.rows as any[]).map((row, i) => ({
      chunkId: row.chunk_id,
      content: row.content,
      score: 1 - (i * 0.1), // Fake relevance ranking
      documentId: row.document_id,
      filename: row.filename,
      metadata: row.metadata,
    }));
  }

  /**
   * Build RAG context string from search results (for injection into system prompt)
   */
  buildRagContext(results: SearchResult[]): string {
    if (results.length === 0) return '';

    const lines = results.map((r, i) => {
      const source = r.metadata?.source || r.filename;
      const page = r.metadata?.page ? `, page ${r.metadata.page}` : '';
      return `${i + 1}. ${r.content}\n   [source: ${source}${page}]`;
    });

    return `[Relevant Knowledge Base Documents]\n${lines.join('\n\n')}`;
  }

  /**
   * Build structured citation metadata from search results.
   * Returned alongside the SSE stream so the frontend can render source chips.
   */
  buildCitations(results: SearchResult[]): RagCitation[] {
    return results.map((r) => ({
      documentId: r.documentId,
      filename: r.filename,
      page: r.metadata?.page ?? null,
      score: r.score,
      snippet: r.content.slice(0, 200),
    }));
  }

  /**
   * Get total chunk/document stats for an agent
   */
  async getStats(agentId: string): Promise<{ documents: number; chunks: number; totalTokens: number }> {
    const db = getDb();

    const [docCount] = await db.select({ count: sql<number>`count(*)` })
      .from(knowledgeDocuments)
      .where(and(
        eq(knowledgeDocuments.agentId, agentId),
        eq(knowledgeDocuments.status, 'ready'),
      ));

    const [chunkStats] = await db.select({
      count: sql<number>`count(*)`,
      tokens: sql<number>`COALESCE(sum(${knowledgeChunks.tokenCount}), 0)`,
    })
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.agentId, agentId));

    return {
      documents: Number(docCount?.count || 0),
      chunks: Number(chunkStats?.count || 0),
      totalTokens: Number(chunkStats?.tokens || 0),
    };
  }
}

export const knowledgeService = new KnowledgeService();
