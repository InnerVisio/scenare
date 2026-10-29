import { beforeAll, describe, expect, it } from 'vitest';
import { count, eq, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { createTestDb, type Db } from '@/db/client';
import { runSeed } from '@/db/seed';
import { getFieldText } from '@/domain/script/fields';
import * as s from '@/db/schema';

async function n(db: Db, table: PgTable, where?: SQL) {
  const rows = await db.select({ c: count() }).from(table).where(where);
  return Number(rows[0].c);
}

describe('runSeed', () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
    await runSeed(db, { demo: true });
    await runSeed(db, { demo: true });
  }, 60_000);

  it('creates stable lookup counts after running twice', async () => {
    expect(await n(db, s.lookupItems, eq(s.lookupItems.kind, 'category'))).toBe(4);
    expect(await n(db, s.lookupItems, eq(s.lookupItems.kind, 'format'))).toBe(23);
    expect(await n(db, s.lookupItems, eq(s.lookupItems.kind, 'hook_type'))).toBe(9);
    expect(await n(db, s.lookupItems, eq(s.lookupItems.kind, 'location'))).toBe(7);
    expect(await n(db, s.lookupItems, eq(s.lookupItems.kind, 'publication_variant'))).toBe(6);
    expect(await n(db, s.lookupItems, eq(s.lookupItems.kind, 'check_rule'))).toBe(13);
    expect(await n(db, s.users)).toBe(3);
    expect(await n(db, s.videos)).toBe(6);
    expect(await n(db, s.settings)).toBe(1);
  });

  it('seeds V031 with two versions and three root comments', async () => {
    const [v] = await db.select().from(s.videos).where(eq(s.videos.code, 'V031'));
    expect(v.approvalStatus).toBe('final_review');
    expect(v.isSample).toBe(true);
    expect(await n(db, s.scriptVersions, eq(s.scriptVersions.videoId, v.id))).toBe(2);
    expect(await n(db, s.comments, eq(s.comments.videoId, v.id))).toBe(4);
    const roots = await db.select().from(s.comments).where(eq(s.comments.videoId, v.id));
    expect(roots.filter((c) => c.parentId === null)).toHaveLength(3);
  });

  it('anchors V031 comments to real text in version 2', async () => {
    const [v] = await db.select().from(s.videos).where(eq(s.videos.code, 'V031'));
    const versions = await db.select().from(s.scriptVersions).where(eq(s.scriptVersions.videoId, v.id));
    const v2 = versions.find((x) => x.versionNo === 2)!;
    const anchored = (await db.select().from(s.comments).where(eq(s.comments.videoId, v.id))).filter(
      (c) => c.anchor,
    );
    expect(anchored).toHaveLength(2);
    for (const c of anchored) {
      const a = c.anchor!;
      expect(getFieldText(v2.body, a.fieldId)!.slice(a.from, a.to)).toBe(a.quotedText);
      expect(c.versionId).toBe(v2.id);
    }
    const suggestion = anchored.find((c) => c.suggestion)!;
    expect(suggestion.suggestion).toMatchObject({
      replacement: 'Počkej. Kolik ti nabídli jinde?',
      state: 'pending',
    });
  });

  it('seeds the expected statuses', async () => {
    const rows = await db.select().from(s.videos);
    const byCode = Object.fromEntries(rows.map((r) => [r.code, r.approvalStatus]));
    expect(byCode).toEqual({
      V026: 'final_review',
      V031: 'final_review',
      V032: 'in_review',
      V028: 'in_review',
      V033: 'in_review',
      V036: 'draft',
    });
    expect(await n(db, s.scriptVersions)).toBe(7);
    expect(await n(db, s.approvalDecisions)).toBe(2);
  });

  it('seeds lookups without demo data when demo is false', async () => {
    const fresh = await createTestDb();
    await runSeed(fresh, { demo: false });
    expect(await n(fresh, s.lookupItems, eq(s.lookupItems.kind, 'category'))).toBe(4);
    expect(await n(fresh, s.videos)).toBe(0);
    expect(await n(fresh, s.users)).toBe(0);
    expect(await n(fresh, s.settings)).toBe(1);
  }, 60_000);
});
