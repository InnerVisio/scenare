import type { ScriptBody } from '@/domain/script/types';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '@/db/client';
import * as s from '@/db/schema';
import { runSeed } from '@/db/seed';
import { loadActor } from '@/server/actor';
import { getOverview } from '@/server/overview';
import { getDashboard } from '@/server/queries';
import { createVideo, saveDraft, setLifecycle, submitManyForReview } from '@/server/videos';
import { NOW, setupWorld } from './helpers';
import { readFileSync } from 'node:fs';
import path from 'node:path';

async function freshWorld() {
  const db = await createTestDb();
  await runSeed(db, { demo: false });
  await db.insert(s.users).values({ id: 'u-admin', name: 'Admin', email: 'admin@gta.local', role: 'admin', initials: 'A', color: '#DCD9FB' });
  const [u] = await db.select().from(s.users).where(eq(s.users.email, 'admin@gta.local'));
  await db.insert(s.shootingCycles).values({ id: '2026-11', shootDate: '2026-11-20', plannedVideos: 16, coversMonths: ['2026-11'] });
  return { db, admin: await loadActor(db, u.id) };
}

describe('seed without demo', () => {
  it('creates users and lookups but no videos, and keeps edited settings', async () => {
    const { db } = await freshWorld();
    await db.update(s.settings).set({ monthlyTarget: 20 });
    await runSeed(db, { demo: false });
    expect(await db.select().from(s.videos)).toHaveLength(0);
    expect((await db.select().from(s.users)).length).toBe(1);
    expect((await db.select().from(s.settings))[0].monthlyTarget).toBe(20);
  });
});

describe('remove_demo_data migration', () => {
  it('removes only the exact demo pairs', async () => {
    const w = await setupWorld();
    const [real] = [await createVideo(w.db, w.admin, { title: 'Moje vlastní', cycleId: '2026-11' }, NOW)];
    // A real script reusing a demo code with a different title cannot happen (unique code), so rename a demo row instead.
    await w.db.update(s.videos).set({ title: 'Přejmenovaný' }).where(eq(s.videos.code, 'V033'));
    const sql = readFileSync(path.resolve(process.cwd(), 'drizzle/0005_remove_demo_data.sql'), 'utf8');
    for (const stmt of sql.split('--> statement-breakpoint')) await w.db.execute(stmt as never);
    const codes = (await w.db.select().from(s.videos)).map((v) => v.code).sort();
    expect(codes).toEqual(['V033', real.code].sort());
    expect(await w.db.select().from(s.series)).toHaveLength(0); // S01 had only demo episodes
  });
});

describe('bulk submit', () => {
  it('submits the complete ones and reports the rest in Czech', async () => {
    const { db, admin } = await freshWorld();
    const ok = await createVideo(db, admin, { title: 'Hotový', cycleId: '2026-11', categoryKey: 'nabor' }, NOW);
    const bad = await createVideo(db, admin, { title: 'Bez kategorie', cycleId: '2026-11' }, NOW);
    for (const v of [ok, bad]) {
      const [row] = await db.select().from(s.videos).where(eq(s.videos.id, v.id));
      await saveDraft(db, admin, v.id, row.draft as ScriptBody, NOW);
    }
    const res = await submitManyForReview(db, admin, [ok.id, bad.id], NOW);
    expect(res.submitted.map((x) => x.code)).toEqual([ok.code]);
    expect(res.failed).toEqual([`${bad.code}: doplň kategorii`]);
    const [row] = await db.select().from(s.videos).where(eq(s.videos.id, ok.id));
    expect(row.approvalStatus).toBe('in_review');
  });
});

describe('4-category split on a fresh DB', () => {
  it('counts plan 5/6/3/2, proposed 2/3/0/0, approved 1/0/0/0, unassigned 1', async () => {
    const { db, admin } = await freshWorld();
    await db.update(s.settings).set({ monthlyTarget: 16 });
    const make = async (title: string, categoryKey: string | undefined, status: string) => {
      const v = await createVideo(db, admin, { title, cycleId: '2026-11', plannedMonth: '2026-11', ...(categoryKey ? { categoryKey } : {}) }, NOW);
      await db.update(s.videos).set({ approvalStatus: status }).where(eq(s.videos.id, v.id));
    };
    await make('N1', 'nabor', 'approved');
    await make('N2', 'nabor', 'draft');
    for (const n of ['L1', 'L2', 'L3']) await make(n, 'lifestyle', 'in_review');
    await make('T1', 'trendy', 'postponed');
    await make('U1', undefined, 'draft');

    const mix = (await getDashboard(db, admin, NOW)).mix!;
    const col = (f: (r: (typeof mix.categories.rows)[number]) => number) => mix.categories.rows.map(f);
    expect(col((r) => r.plan)).toEqual([5, 6, 3, 2]);
    expect(col((r) => r.proposed)).toEqual([2, 3, 0, 0]);
    expect(col((r) => r.approved)).toEqual([1, 0, 0, 0]);
    expect(col((r) => r.missing)).toEqual([4, 6, 3, 2]);
    expect(mix.unassigned).toBe(1);

    const o = await getOverview(db, { month: '2026-11', cycleId: '2026-11' }, NOW);
    expect(o.categories.rows.map((r) => r.plan)).toEqual([5, 6, 3, 2]);
    expect(o.categories.rows.map((r) => r.proposed)).toEqual([2, 3, 0, 0]);
    void setLifecycle;
  });
});
