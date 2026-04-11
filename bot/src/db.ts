import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Initialize the PostgreSQL connection.
 * Call this once at startup before using any DB functions.
 */
export async function initDb(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });

  // Test connection
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    console.log("[db] Connected to PostgreSQL ✓");

    // Create tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        discord_user_id TEXT NOT NULL,
        discord_username TEXT NOT NULL,
        platform TEXT NOT NULL,
        username TEXT NOT NULL,
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (discord_user_id, platform)
      );
    `);
    console.log("[db] Tables ready ✓");
  } finally {
    client.release();
  }
}

/**
 * Get a pool instance (throws if not initialized).
 */
export function getPool(): pg.Pool {
  if (!pool) throw new Error("Database not initialized — call initDb() first");
  return pool;
}

/**
 * Close all connections.
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    console.log("[db] Connection pool closed");
    pool = null;
  }
}
