import { spawnSync } from 'node:child_process';

if (process.env.SEED_DEMO !== '1') {
  console.log('Seed přeskočen (SEED_DEMO není 1).');
  process.exit(0);
}
// Prefer the direct (non-pgbouncer) Neon connection when the integration provides one.
const databaseUrl = process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL;
const env = databaseUrl ? { ...process.env, DATABASE_URL: databaseUrl } : process.env;
const result = spawnSync('npx', ['tsx', 'scripts/seed.ts', '--demo'], { stdio: 'inherit', env });
process.exit(result.status ?? 1);
