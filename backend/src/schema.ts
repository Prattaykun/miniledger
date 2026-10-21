import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { config, packageRoot } from './config';
import { pool } from './db';

/** Create the database named in DATABASE_URL when it is not there yet. */
export async function ensureDatabase(databaseUrl: string): Promise<void> {
  const target = new URL(databaseUrl);
  const dbName = decodeURIComponent(target.pathname.replace(/^\//, ''));
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(dbName)) {
    throw new Error(`Refusing to create a database named "${dbName}"`);
  }

  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';
  let client = new Client({ connectionString: adminUrl.toString() });
  try {
    await client.connect();
  } catch {
    adminUrl.pathname = '/miniledger';
    client = new Client({ connectionString: adminUrl.toString() });
    await client.connect();
  }

  try {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await client.end();
  }
}

export async function applyMigrations(): Promise<string[]> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const dir = path.join(packageRoot, 'migrations');
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  const applied: string[] = [];

  for (const file of files) {
    const already = await pool.query('SELECT 1 FROM schema_migrations WHERE id = $1', [file]);
    if (already.rowCount) continue;

    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied.push(file);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return applied;
}

export async function prepareDatabase(): Promise<string[]> {
  await ensureDatabase(config.databaseUrl);
  return applyMigrations();
}
