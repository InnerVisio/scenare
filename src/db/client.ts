import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

/** One driver-agnostic database type (PGlite or postgres-js); `db.transaction` works on both. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const DEFAULT_PGLITE_DIR = '.data/pglite';
const MIGRATIONS_FOLDER = path.resolve(process.cwd(), 'drizzle');

/** `DATABASE_URL` unset or `pglite:<dir>` → local PGlite directory, otherwise a Postgres URL. */
export function parseDatabaseUrl(
  url: string | undefined,
): { kind: 'pglite'; dir: string } | { kind: 'postgres'; url: string } {
  const value = url?.trim();
  if (!value) return { kind: 'pglite', dir: DEFAULT_PGLITE_DIR };
  if (value.startsWith('pglite:')) {
    return { kind: 'pglite', dir: value.slice('pglite:'.length) || DEFAULT_PGLITE_DIR };
  }
  return { kind: 'postgres', url: value };
}

async function openPglite(dir?: string): Promise<Db> {
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
    import('drizzle-orm/pglite/migrator'),
  ]);
  if (dir) mkdirSync(path.dirname(path.resolve(dir)), { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

async function openPostgres(url: string): Promise<Db> {
  const [{ default: postgres }, { drizzle }, { migrate }] = await Promise.all([
    import('postgres'),
    import('drizzle-orm/postgres-js'),
    import('drizzle-orm/postgres-js/migrator'),
  ]);
  // Migrations need their own single connection; the app pool is created afterwards.
  const migrationClient = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(migrationClient), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await migrationClient.end();
  }
  return drizzle(postgres(url), { schema });
}

const globalForDb = globalThis as unknown as { __scenareDb?: Promise<Db> };

/** Singleton (survives dev hot reloads). Migrates on first use. */
export function getDb(): Promise<Db> {
  if (!globalForDb.__scenareDb) {
    const target = parseDatabaseUrl(process.env.DATABASE_URL);
    const opening = target.kind === 'pglite' ? openPglite(target.dir) : openPostgres(target.url);
    globalForDb.__scenareDb = opening.catch((error) => {
      globalForDb.__scenareDb = undefined;
      throw error;
    });
  }
  return globalForDb.__scenareDb;
}

/** Fresh in-memory PGlite, migrated and NOT seeded. */
export function createTestDb(): Promise<Db> {
  return openPglite();
}
