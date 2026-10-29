import { getDb } from '../src/db/client';
import { runSeed } from '../src/db/seed';

const demo = process.argv.includes('--demo');
const db = await getDb();
await runSeed(db, { demo });
console.log(`Seed hotový${demo ? ' (včetně ukázkových dat)' : ''}.`);
process.exit(0);
