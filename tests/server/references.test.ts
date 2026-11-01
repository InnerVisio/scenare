import { beforeAll, describe, expect, it } from 'vitest';
import { can } from '@/domain/policy/can';
import { addReference, removeReference, toReferenceVMs } from '@/server/references';
import { describeActivity } from '@/server/activityText';
import { activityFor, createSubmitted, expectDomainError, getVideo, minutesLater, notifiedUsers, setupWorld, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await setupWorld();
}, 60_000);

const URL1 = 'https://www.tiktok.com/@example/video/1234567890';

describe('addReference', () => {
  it('lets every role add, stores it unversioned, logs and notifies nobody', async () => {
    const { videoId, code } = await createSubmitted(w);
    const production = { ...w.honza, id: 'u-prod', role: 'production' as const };
    expect(can(production, 'reference.add')).toBe(true);

    const { id } = await addReference(w.db, w.honza, { videoId, url: ` ${URL1} `, note: ' Rychlý střih ' }, minutesLater(1));
    const video = await getVideo(w.db, videoId);
    expect(video.references).toEqual([
      { id, url: URL1, note: 'Rychlý střih', sceneId: null, addedBy: w.honza.id, addedAt: minutesLater(1).toISOString() },
    ]);
    const [log] = await activityFor(w.db, videoId, 'reference.added');
    expect(log).toMatchObject({ actorId: w.honza.id, entity: 'reference', entityId: id });
    expect(await notifiedUsers(w.db, log.id)).toEqual([]);
    expect(describeActivity({ ...log, videoCode: code, after: log.after as Record<string, unknown> }, new Map([[w.admin.id, 'Admin']])).text).toBe(
      `Někdo přidal ukázku k ${code}`,
    );
    await addReference(w.db, w.admin, { videoId, url: 'http://youtu.be/abc' }, minutesLater(2));
    expect((await getVideo(w.db, videoId)).references).toHaveLength(2);
  });

  it('rejects bad links and too long texts with Czech messages', async () => {
    const { videoId } = await createSubmitted(w);
    for (const url of ['', 'tiktok.com/x', 'ftp://x.cz/a', 'javascript:alert(1)', 'https://']) {
      await expectDomainError(addReference(w.db, w.admin, { videoId, url }, minutesLater(1)), 'VALIDATION', 'Vlož odkaz začínající https://');
    }
    await expectDomainError(
      addReference(w.db, w.admin, { videoId, url: `https://a.cz/${'x'.repeat(500)}` }, minutesLater(1)),
      'VALIDATION',
      'Odkaz je příliš dlouhý (nejvýše 500 znaků).',
    );
    await expectDomainError(
      addReference(w.db, w.admin, { videoId, url: URL1, note: 'x'.repeat(301) }, minutesLater(1)),
      'VALIDATION',
      'Poznámka je příliš dlouhá (nejvýše 300 znaků).',
    );
    await expectDomainError(addReference(w.db, w.admin, { videoId: 'nope', url: URL1 }, minutesLater(1)), 'NOT_FOUND');
    expect((await getVideo(w.db, videoId)).references).toEqual([]);
  });

  it('allows at most 10 samples per video', async () => {
    const { videoId } = await createSubmitted(w);
    for (let i = 0; i < 10; i++) await addReference(w.db, w.admin, { videoId, url: `${URL1}${i}` }, minutesLater(i));
    await expectDomainError(
      addReference(w.db, w.admin, { videoId, url: URL1 }, minutesLater(20)),
      'VALIDATION',
      'Ke scénáři může být nejvýše 10 ukázek.',
    );
  });

  it('keeps a sceneId only when the scene exists in the current text', async () => {
    const { videoId } = await createSubmitted(w);
    const sceneId = w.cleanBody().scenes[1].id;
    const a = await addReference(w.db, w.admin, { videoId, url: URL1, sceneId }, minutesLater(1));
    const b = await addReference(w.db, w.admin, { videoId, url: URL1, sceneId: 'no-such-scene' }, minutesLater(2));
    const refs = (await getVideo(w.db, videoId)).references;
    expect(refs.find((r) => r.id === a.id)?.sceneId).toBe(sceneId);
    expect(refs.find((r) => r.id === b.id)?.sceneId).toBeNull();
  });
});

describe('removeReference', () => {
  it('is allowed for the author and for an admin, not for anyone else', async () => {
    const { videoId } = await createSubmitted(w);
    const { id } = await addReference(w.db, w.honza, { videoId, url: URL1 }, minutesLater(1));

    await expectDomainError(removeReference(w.db, w.radek, { videoId, referenceId: id }, minutesLater(2)), 'FORBIDDEN');
    expect((await getVideo(w.db, videoId)).references).toHaveLength(1);

    await removeReference(w.db, w.honza, { videoId, referenceId: id }, minutesLater(3));
    expect((await getVideo(w.db, videoId)).references).toEqual([]);
    expect(await activityFor(w.db, videoId, 'reference.removed')).toHaveLength(1);

    const again = await addReference(w.db, w.honza, { videoId, url: URL1 }, minutesLater(4));
    await removeReference(w.db, w.admin, { videoId, referenceId: again.id }, minutesLater(5));
    expect((await getVideo(w.db, videoId)).references).toEqual([]);
    await expectDomainError(removeReference(w.db, w.admin, { videoId, referenceId: again.id }, minutesLater(6)), 'NOT_FOUND', 'Ukázka nenalezena.');
  });
});

describe('toReferenceVMs', () => {
  it('adds platform, author name and the remove right for the viewer', () => {
    const refs = [{ id: 'r1', url: URL1, note: 'n', sceneId: null, addedBy: w.honza.id, addedAt: 'x' }];
    const names = new Map([[w.honza.id, 'Honza']]);
    expect(toReferenceVMs(refs, w.honza, names)[0]).toMatchObject({ label: 'TikTok', addedByName: 'Honza', canRemove: true });
    expect(toReferenceVMs(refs, w.radek, names)[0].canRemove).toBe(false);
    expect(toReferenceVMs(refs, w.admin, names)[0].canRemove).toBe(true);
  });
});
