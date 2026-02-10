// ============================================================
// GiLo AI – Database Connection (PostgreSQL + Drizzle ORM)
// ============================================================

import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import { ensureSchema } from './migrate';

const { Pool } = pg;

export type Database = NodePgDatabase<typeof schema>;

let db: Database | null = null;
let pool: pg.Pool | null = null;

/**
 * Initialize the database connection.
 * Must be called before the server starts accepting requests.
 */
export async function initDb(): Promise<Database> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  pool = new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Test connection
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('✅ PostgreSQL connected');
  } finally {
    client.release();
  }

  // Auto-create tables if they don't exist (production-safe)
  await ensureSchema(pool);

  db = drizzle(pool, { schema });
  return db;
}

/**
 * Get the database instance.
 * Throws if initDb() hasn't been called yet.
 */
export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

/**
 * Close the database connection gracefully.
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    console.log('🔌 PostgreSQL disconnected');
    db = null;
    pool = null;
  }
}

export { schema };
