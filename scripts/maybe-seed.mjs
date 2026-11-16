import { spawnSync } from 'node:child_process';

const production = process.env.VERCEL_ENV === 'production';
// Ukázková data se v produkci nikdy nenahrávají; SEED_DEMO=1 platí jen mimo produkci (náhledy).
const demo = !production && process.env.SEED_DEMO === '1';
// Prefer the direct (non-pgbouncer) Neon connection when the integration provides one.
const databaseUrl = process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL;
const env = databaseUrl ? { ...process.env, DATABASE_URL: databaseUrl } : process.env;
console.log(
  demo
    ? 'Seed: základní data (číselníky, nastavení) a ukázková data pro náhled.'
    : 'seed: pouze základní data (číselníky, nastavení); nic se nepřepisuje, ukázková data se nenahrávají.',
);
const result = spawnSync('npx', ['tsx', 'scripts/seed.ts', ...(demo ? ['--demo'] : [])], { stdio: 'inherit', env });
process.exit(result.status ?? 1);
