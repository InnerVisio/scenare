import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as s from '@/db/schema';
import { describeActivity } from '@/server/activityText';
import { addPublication, deletePublication, loadPublicationsPage, updatePublication } from '@/server/publications';
import { loadScriptPage } from '@/server/scripts';
import { expectDomainError, NOW, setupWorld, type World } from './helpers';

let w: World;
const videoOf = async (code: string) => (await w.db.select().from(s.videos).where(eq(s.videos.code, code)))[0];
const fields = { profileKey: 'radek', publishedAt: '2026-11-21T10:00', variant: 'hlavni-verze', url: '', note: '' };

beforeAll(async () => {
  w = await setupWorld();
}, 60_000);

describe('addPublication', () => {
  it('is for admin only and only for approved scripts, with valid fields', async () => {
    const v020 = await videoOf('V020');
    await expectDomainError(addPublication(w.db, w.honza, v020.id, fields, NOW), 'FORBIDDEN');
    await expectDomainError(addPublication(w.db, w.admin, 'nope', fields, NOW), 'NOT_FOUND');
    const draft = await videoOf('V036');
    const unapproved = await expectDomainError(addPublication(w.db, w.admin, draft.id, fields, NOW), 'VALIDATION');
    expect(unapproved.message).toContain('V036 není schválený');
    await expectDomainError(addPublication(w.db, w.admin, v020.id, { ...fields, profileKey: 'nikdo' }, NOW), 'VALIDATION', 'Vyber profil.');
    await expectDomainError(addPublication(w.db, w.admin, v020.id, { ...fields, variant: 'x' }, NOW), 'VALIDATION', 'Vyber variantu publikace.');
    await expectDomainError(addPublication(w.db, w.admin, v020.id, { ...fields, publishedAt: 'včera' }, NOW), 'VALIDATION', 'Zadej datum a čas publikace.');
    await expectDomainError(addPublication(w.db, w.admin, v020.id, { ...fields, url: 'javascript:1' }, NOW), 'VALIDATION', 'Odkaz musí začínat http:// nebo https://.');
    await expectDomainError(addPublication(w.db, w.admin, v020.id, { ...fields, metrics7d: { skipRate: 120 } }, NOW), 'VALIDATION', 'Míra přeskočení musí být od 0 do 100 %.');
    expect((await videoOf('V020')).productionStatus).toBe('waiting');
  });

  it('stores metrics, sets Publikováno with the first publication and logs it', async () => {
    const v020 = await videoOf('V020');
    const { id } = await addPublication(
      w.db,
      w.admin,
      v020.id,
      { ...fields, metrics24h: { views: 1000, reach: 800, shares: '', skipRate: '35,5' } },
      NOW,
    );
    const [row] = await w.db.select().from(s.publications).where(eq(s.publications.id, id));
    expect(row).toMatchObject({ videoId: v020.id, profileKey: 'radek', variant: 'hlavni-verze', url: '', metrics7d: null });
    expect(row.publishedAt.toISOString()).toBe('2026-11-21T09:00:00.000Z');
    expect(row.metrics24h).toEqual({ views: 1000, reach: 800, skipRate: 35.5 });
    expect((await videoOf('V020')).productionStatus).toBe('published');
    const log = await w.db.select().from(s.activityLog).where(eq(s.activityLog.entityId, id));
    expect(log.map((l) => l.action)).toEqual(['publication.added']);
    expect(describeActivity({ action: 'publication.added', actorId: null, entityId: id, videoCode: 'V020', after: null }, new Map()).text).toBe('Systém přidal publikaci k V020');
  });
});

describe('updatePublication / deletePublication', () => {
  it('edits fields and metrics, and deleting the last publication takes Publikováno back', async () => {
    const v020 = await videoOf('V020');
    const second = await addPublication(w.db, w.admin, v020.id, { ...fields, variant: 'hook-b', url: 'https://www.tiktok.com/@gta/video/2' }, NOW);
    const [first] = (await loadScriptPage(w.db, w.admin, 'V020', NOW)).publications.publications.filter((p) => p.id !== second.id);

    await expectDomainError(updatePublication(w.db, w.honza, first.id, { ...fields }, NOW), 'FORBIDDEN');
    await expectDomainError(updatePublication(w.db, w.admin, 'nope', { ...fields }, NOW), 'NOT_FOUND');
    await updatePublication(w.db, w.admin, first.id, { ...fields, url: 'https://www.tiktok.com/@gta/video/1', metrics7d: { reach: 2000, shares: 50 } }, NOW);
    const [updated] = await w.db.select().from(s.publications).where(eq(s.publications.id, first.id));
    expect(updated).toMatchObject({ url: 'https://www.tiktok.com/@gta/video/1', metrics7d: { reach: 2000, shares: 50 }, metrics24h: null });

    await expectDomainError(deletePublication(w.db, w.honza, first.id, NOW), 'FORBIDDEN');
    await deletePublication(w.db, w.admin, first.id, NOW);
    expect((await videoOf('V020')).productionStatus).toBe('published');
    await deletePublication(w.db, w.admin, second.id, NOW);
    expect((await videoOf('V020')).productionStatus).toBe('edited');
    await expectDomainError(deletePublication(w.db, w.admin, second.id, NOW), 'NOT_FOUND');
  });
});

describe('loaders', () => {
  it('lists a month with unique video and publication counts, link filter and A/B groups', async () => {
    const v020 = await videoOf('V020');
    await addPublication(w.db, w.admin, v020.id, { ...fields, variant: 'hook-a', metrics7d: { reach: 1000, shares: 30 } }, NOW);
    await addPublication(w.db, w.admin, v020.id, { ...fields, publishedAt: '2026-11-21T12:00', variant: 'hook-b', url: 'https://www.tiktok.com/@gta/video/3', metrics7d: { reach: 1000, shares: 60 } }, NOW);

    const page = await loadPublicationsPage(w.db, '2026-11', false);
    expect(page.publicationCount).toBe(3); // V021 (seed) + two of V020
    expect(page.videoCount).toBe(2);
    expect(page.withoutUrl).toBe(1);
    expect(page.rows).toHaveLength(3);
    expect(page.groups).toHaveLength(1);
    expect(page.groups[0].code).toBe('V020');
    expect(page.groups[0].rows.map((r) => r.variantLabel)).toEqual(['Hook A', 'Hook B']);
    expect(page.groups[0].rows[1].shareRate7d).toBeCloseTo(0.06);

    const noLink = await loadPublicationsPage(w.db, '2026-11', true);
    expect(noLink.rows.map((r) => r.variant)).toEqual(['hook-a']);
    expect(noLink.publicationCount).toBe(3);

    expect((await loadPublicationsPage(w.db, '2027-05', false)).rows).toEqual([]);
  });

  it('loads one script with its publications and the pickers', async () => {
    const data = (await loadScriptPage(w.db, w.honza, 'V021', NOW)).publications;
    expect(data.publications).toHaveLength(1);
    expect(data.publications[0]).toMatchObject({ profileLabel: 'Radek', variantLabel: 'Hlavní verze' });
    expect(data.profiles.map((p) => p.key)).toContain('radek');
    expect(data.variants).toHaveLength(6);
  });
});
