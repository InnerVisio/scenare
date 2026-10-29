import { spawnSync } from 'node:child_process';

if (process.env.SEED_DEMO !== '1') {
  console.log('Seed přeskočen (SEED_DEMO není 1).');
  process.exit(0);
}
const result = spawnSync('npx', ['tsx', 'scripts/seed.ts', '--demo'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
