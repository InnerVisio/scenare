import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import { newId } from '@/domain/ids';
import { seedDemo } from './demo';
import { LOOKUP_SEEDS } from './lookups';

export interface SeedOptions {
  demo: boolean;
}

/** Idempotent and non-destructive: only missing lookups (by kind+key), settings and demo rows are inserted; existing rows are never overwritten. */
export async function runSeed(db: Db, options: SeedOptions): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(s.lookupItems)
      .values(LOOKUP_SEEDS.map((item) => ({ id: newId(), ...item })))
      .onConflictDoNothing({ target: [s.lookupItems.kind, s.lookupItems.key] });
    await tx.insert(s.settings).values({ id: 'global' }).onConflictDoNothing();
  });

  if (options.demo) await seedDemo(db);
}
