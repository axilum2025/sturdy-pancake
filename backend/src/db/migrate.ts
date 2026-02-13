// ============================================================
// GiLo AI – Auto-migration (raw SQL CREATE TABLE IF NOT EXISTS)
// Runs at server startup to ensure all tables exist in production.
// This is the compiled-JS-friendly alternative to drizzle-kit push.
// ============================================================

import pg from 'pg';

/**
 * Run a single SQL statement safely using its own connection.
 * Each statement gets a fresh connection to avoid transaction poisoning
 * (e.g. if CREATE EXTENSION fails, it doesn't break subsequent queries).
 */
async function runSafe(pool: pg.Pool, label: string, sql: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query(sql);
    return true;
  } catch (error: any) {
    console.warn(`⚠️  Migration step "${label}" failed:`, error.message);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Ensure all application tables exist.
 * Each table is created in its own connection to avoid transaction poisoning.
 * Uses CREATE TABLE IF NOT EXISTS so it's safe to run repeatedly.
 */
export async function ensureSchema(pool: pg.Pool): Promise<void> {
  console.log('🔄 Running schema migration...');

  // 1. Try to enable pgvector (optional — will be missing on most Azure Postgres)
  await runSafe(pool, 'pgvector extension', `CREATE EXTENSION IF NOT EXISTS "vector";`);

  // 2. Users table (no FK dependencies)
  await runSafe(pool, 'users', `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(50),
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
  `);

  // 2b. Add display_name column if missing (existing DBs)
  await runSafe(pool, 'users_add_display_name', `
    ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(50);
  `);

  // 3. Agents table (depends on users)
  await runSafe(pool, 'agents', `
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
  `);

  // 3b. Add missing columns to agents table (handles pre-existing tables)
  await runSafe(pool, 'agents.slug', `
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE;
  `);

  // 4. Store Agents
  await runSafe(pool, 'store_agents', `
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
      features JSONB NOT NULL DEFAULT '[]'::jsonb,
      category VARCHAR(50) NOT NULL DEFAULT 'other',
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
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
  `);

  // 4b. Store Agent Ratings (depends on store_agents, users)
  await runSafe(pool, 'store_agent_ratings', `
    CREATE TABLE IF NOT EXISTS store_agent_ratings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      store_agent_id UUID NOT NULL REFERENCES store_agents(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(store_agent_id, user_id)
    );
  `);

  // 5. Conversations (depends on agents, users)
  await runSafe(pool, 'conversations', `
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      message_count INTEGER NOT NULL DEFAULT 0
    );
  `);

  // 6. Messages (depends on conversations)
  await runSafe(pool, 'messages', `
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // 7. Knowledge Documents (depends on agents, users)
  await runSafe(pool, 'knowledge_documents', `
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
  `);

  // 8. Knowledge Chunks (depends on knowledge_documents, agents)
  await runSafe(pool, 'knowledge_chunks', `
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
  `);

  // 9. Vector column for knowledge_chunks (optional, depends on pgvector)
  await runSafe(pool, 'knowledge_chunks.embedding', `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding'
      ) THEN
        ALTER TABLE knowledge_chunks ADD COLUMN embedding vector(1536);
      END IF;
    END $$;
  `);

  // 10. API Keys (depends on agents, users)
  await runSafe(pool, 'api_keys', `
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
  `);

  // 11. Webhooks (depends on agents, users)
  await runSafe(pool, 'webhooks', `
    CREATE TABLE IF NOT EXISTS webhooks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      url VARCHAR(2048) NOT NULL,
      events JSONB NOT NULL DEFAULT '[]'::jsonb,
      secret VARCHAR(255) NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      last_triggered_at TIMESTAMPTZ,
      failure_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // 12. Refresh Tokens (depends on users)
  await runSafe(pool, 'refresh_tokens', `
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Final verification: check that critical tables exist
  const verifyClient = await pool.connect();
  try {
    const result = await verifyClient.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('users', 'agents', 'conversations', 'messages')
      ORDER BY table_name;
    `);
    const tables = result.rows.map((r: any) => r.table_name);
    console.log('✅ Schema migration complete. Tables found:', tables.join(', '));

    if (!tables.includes('agents')) {
      console.error('❌ CRITICAL: agents table was NOT created!');
      throw new Error('Migration failed: agents table not created');
    }
  } finally {
    verifyClient.release();
  }
}
