import { sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import { newId } from '@/domain/ids';
import { seedDemo } from './demo';
import { LOOKUP_SEEDS } from './lookups';

export interface SeedOptions {
  demo: boolean;
}

/** Idempotent: lookups upsert by (kind, key), settings by id, demo rows by deterministic id / code / e-mail. */
export async function runSeed(db: Db, options: SeedOptions): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(s.lookupItems)
      .values(LOOKUP_SEEDS.map((item) => ({ id: newId(), ...item })))
      .onConflictDoUpdate({
        target: [s.lookupItems.kind, s.lookupItems.key],
        set: {
          label: sql`excluded.label`,
          data: sql`excluded.data`,
          sortOrder: sql`excluded.sort_order`,
        },
      });
    await tx.insert(s.settings).values({ id: 'global' }).onConflictDoNothing();
  });

  if (options.demo) await seedDemo(db);
}
