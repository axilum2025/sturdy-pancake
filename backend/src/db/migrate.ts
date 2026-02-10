// ============================================================
// GiLo AI – Auto-migration (raw SQL CREATE TABLE IF NOT EXISTS)
// Runs at server startup to ensure all tables exist in production.
// This is the compiled-JS-friendly alternative to drizzle-kit push.
// ============================================================

import pg from 'pg';

/**
 * Ensure all application tables exist.
 * Uses CREATE TABLE IF NOT EXISTS so it's safe to run repeatedly.
 */
export async function ensureSchema(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('🔄 Running schema migration...');

    // Enable pgvector extension (needed for knowledge_chunks.embedding)
    await client.query(`CREATE EXTENSION IF NOT EXISTS "vector";`).catch(() => {
      console.warn('⚠️  pgvector extension not available — vector search disabled');
    });

    await client.query(`
      -- ============================================================
      -- Users
      -- ============================================================
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        github_id VARCHAR(255),
        tier VARCHAR(20) NOT NULL DEFAULT 'free',
        subscription JSONB,
        quotas JSONB NOT NULL,
        usage JSONB NOT NULL,
        consent_given INTEGER NOT NULL DEFAULT 0,
        consent_at TIMESTAMPTZ,
        consent_version VARCHAR(20),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ============================================================
      -- Agents
      -- ============================================================
      CREATE TABLE IF NOT EXISTS agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE,
        description TEXT,
        tier VARCHAR(20) NOT NULL DEFAULT 'free',
        config JSONB NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        endpoint VARCHAR(255),
        deployed_at TIMESTAMPTZ,
        total_conversations INTEGER NOT NULL DEFAULT 0,
        total_messages INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ============================================================
      -- Store Agents
      -- ============================================================
      CREATE TABLE IF NOT EXISTS store_agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id VARCHAR(255) NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        creator_name VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        short_description VARCHAR(500) NOT NULL,
        icon TEXT,
        icon_color VARCHAR(20) DEFAULT '#3b82f6',
        features JSONB NOT NULL DEFAULT '[]',
        category VARCHAR(50) NOT NULL DEFAULT 'other',
        tags JSONB NOT NULL DEFAULT '[]',
        config_snapshot JSONB NOT NULL,
        visibility VARCHAR(20) NOT NULL DEFAULT 'public',
        access_token VARCHAR(255),
        access_price INTEGER DEFAULT 0,
        usage_count INTEGER NOT NULL DEFAULT 0,
        remix_count INTEGER NOT NULL DEFAULT 0,
        rating REAL NOT NULL DEFAULT 0,
        rating_count INTEGER NOT NULL DEFAULT 0,
        remixed_from UUID,
        version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
        published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ============================================================
      -- Conversations
      -- ============================================================
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        message_count INTEGER NOT NULL DEFAULT 0
      );

      -- ============================================================
      -- Messages
      -- ============================================================
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ============================================================
      -- Knowledge Documents
      -- ============================================================
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename VARCHAR(500) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size INTEGER NOT NULL,
        chunk_count INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'processing',
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ============================================================
      -- Knowledge Chunks (vector column added separately)
      -- ============================================================
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        token_count INTEGER NOT NULL DEFAULT 0,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ============================================================
      -- API Keys
      -- ============================================================
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        key_prefix VARCHAR(12) NOT NULL,
        last_used_at TIMESTAMPTZ,
        request_count INTEGER NOT NULL DEFAULT 0,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ============================================================
      -- Webhooks
      -- ============================================================
      CREATE TABLE IF NOT EXISTS webhooks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        url VARCHAR(2048) NOT NULL,
        events JSONB NOT NULL DEFAULT '[]',
        secret VARCHAR(255) NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        last_triggered_at TIMESTAMPTZ,
        failure_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ============================================================
      -- Refresh Tokens
      -- ============================================================
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Add vector column separately (may fail if pgvector not available)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding'
        ) THEN
          ALTER TABLE knowledge_chunks ADD COLUMN embedding vector(1536);
        END IF;
      END $$;
    `).catch(() => {
      console.warn('⚠️  Could not add vector column — pgvector extension may not be available');
    });

    console.log('✅ Schema migration complete — all tables ready');
  } catch (error) {
    console.error('❌ Schema migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}
