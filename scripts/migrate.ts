import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL?.trim();
if (!url || url.startsWith('pglite:')) {
  console.error('Migrace: DATABASE_URL musí ukazovat na Postgres (postgres://…).');
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
  console.log('Migrace databáze dokončeny.');
} catch (error) {
  console.error('Migrace databáze selhaly:', error);
  process.exitCode = 1;
} finally {
  await client.end();
}
