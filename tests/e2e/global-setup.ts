import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';

/** Fresh, seeded PGlite directory for every run. Runs before the web server starts. */
export default function globalSetup() {
  const dir = path.resolve('.data/e2e');
  rmSync(dir, { recursive: true, force: true });
  execFileSync('npx', ['tsx', 'scripts/seed.ts', '--demo'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'pglite:.data/e2e' },
  });
}
