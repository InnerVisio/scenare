// Wipes and seeds the PGlite directory used by the Playwright web server (see playwright.config.ts).
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith('pglite:')) throw new Error('e2e-prepare needs DATABASE_URL=pglite:<dir>');

rmSync(path.resolve(databaseUrl.slice('pglite:'.length)), { recursive: true, force: true });
execFileSync('npx', ['tsx', 'scripts/seed.ts', '--demo'], { stdio: 'inherit', env: process.env });
