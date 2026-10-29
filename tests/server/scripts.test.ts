import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as s from '@/db/schema';
import { loadScriptPage } from '@/server/scripts';
import { saveDraft, unlockForEdit } from '@/server/videos';
import { createSubmitted, expectDomainError, NOW, setupWorld, withLineText, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await setupWorld();
});

describe('loadScriptPage', () => {
  it('gives the author of a draft the editing actions and the draft as body', async () => {
    const page = await loadScriptPage(w.db, w.admin, 'V036', NOW);
    expect(page.video).toMatchObject({ code: 'V036', status: 'draft' });
    expect(page.latest).toBeNull();
    expect(page.draftAhead).toBe(false);
    expect(page.body).toEqual(page.draft);
    expect(page.actions).toEqual({ edit: true, unlock: false, submit: true, pause: true, restore: false, duplicate: false, openInReview: false });
    expect(page.values).toMatchObject({ title: 'Radek vs. Honza: kdo dřív', categoryKey: 'lifestyle', formatKey: 'radek-vs-honza', goalMetric: 'shares' });
    expect(page.checkInput.personHashtags).toEqual({ Honza: '#honzagizicky', Radek: '#radekteichmann' });
    expect(page.checkInput.formatStatuses['kancelarsky-sketch']).toBe('verified');
    expect(page.checkInput.rules.length).toBeGreaterThan(5);
  });

  it('shows leadership the review shortcut but no editing', async () => {
    const page = await loadScriptPage(w.db, w.honza, 'V031', NOW);
    expect(page.actions).toMatchObject({ edit: false, submit: false, openInReview: true, pause: true });
    expect(page.versions.map((v) => v.no)).toEqual([1, 2]);
    expect(page.latest?.no).toBe(2);
    expect(page.approval).toMatchObject({ state: 'pending' });
    expect(page.activity.length).toBeGreaterThan(0);
  });

  it('flags a draft that is ahead of the latest version', async () => {
    const { videoId, code } = await createSubmitted(w, 'Předběhnutý');
    expect((await loadScriptPage(w.db, w.admin, code, NOW)).draftAhead).toBe(false);
    const [video] = await w.db.select().from(s.videos).where(eq(s.videos.id, videoId));
    await saveDraft(w.db, w.admin, videoId, withLineText(video.draft!, video.draft!.scenes[0].lines[0].id, 'Jiný text'), NOW);
    const page = await loadScriptPage(w.db, w.admin, code, NOW);
    expect(page.draftAhead).toBe(true);
    expect(page.actions.edit).toBe(false); // in review: wait for the decision
  });

  it('offers unlock on an approved, locked script and edit once unlocked', async () => {
    const { videoId, code } = await createSubmitted(w, 'Schválený');
    await w.db.update(s.videos).set({ approvalStatus: 'approved' }).where(eq(s.videos.id, videoId));
    expect((await loadScriptPage(w.db, w.admin, code, NOW)).actions).toMatchObject({ unlock: true, edit: false, submit: false });
    await unlockForEdit(w.db, w.admin, videoId, NOW);
    expect((await loadScriptPage(w.db, w.admin, code, NOW)).actions).toMatchObject({ unlock: false, edit: true, submit: true });
  });

  it('offers restore on a postponed script and duplicate only inside a series', async () => {
    const { videoId, code } = await createSubmitted(w, 'Odložený');
    await w.db.update(s.videos).set({ approvalStatus: 'postponed' }).where(eq(s.videos.id, videoId));
    expect((await loadScriptPage(w.db, w.admin, code, NOW)).actions).toMatchObject({ restore: true, pause: false, edit: false });
    await w.db.insert(s.series).values({ id: 'ser-x', code: 'S90', name: 'X' });
    await w.db.update(s.videos).set({ seriesId: 'ser-x' }).where(eq(s.videos.id, videoId));
    expect((await loadScriptPage(w.db, w.admin, code, NOW)).actions.duplicate).toBe(true);
    expect((await loadScriptPage(w.db, w.honza, code, NOW)).actions.duplicate).toBe(false);
  });

  it('throws NOT_FOUND for an unknown code', async () => {
    await expectDomainError(loadScriptPage(w.db, w.admin, 'V999', NOW), 'NOT_FOUND', 'Scénář nenalezen.');
  });
});
