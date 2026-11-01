import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/db/client';
import { getDashboard, listVideos } from '@/server/queries';
import { decide } from '@/server/approvals';
import { createComment } from '@/server/comments';
import { loadEditorOptions } from '@/server/editorOptions';
import { loadReviewPage } from '@/server/review';
import { loadScriptPage } from '@/server/scripts';
import { loadSeriesDetail, loadSeriesList } from '@/server/series';
import { listLookups } from '@/server/settings';
import { loadShellData } from '@/server/shell';
import { leadershipUsers } from '@/server/loaders';
import { loadActor, type Actor } from '@/server/actor';
import { createVideo, saveDraft, submitForReview } from '@/server/videos';
import { COMPLETE_META, createSubmitted, NOW, setupWorld, type World } from '../server/helpers';

// Counts the SQL statements drizzle sends to PGlite (the same ones postgres-js would send to Neon).
// Every statement is a network round trip on Vercel, so the count is a proxy for page latency.
// BEGIN/COMMIT of transactions are not included (two more round trips per transaction).

let w: World;
let count = 0;

function hook(db: Db) {
  const session = (db as unknown as { session: { logger: unknown; options: { logger?: unknown } } }).session;
  const logger = { logQuery: () => void count++ };
  session.logger = logger;
  session.options.logger = logger;
}

async function measure(fn: () => Promise<unknown>): Promise<number> {
  count = 0;
  await fn();
  return count;
}

const PAGE_CEILING = 10;
const EXTRA = 20;

async function pages(actor: Actor, reviewCode: string): Promise<Record<string, number>> {
  const { db } = w;
  const layout = () => measure(async () => {
    const a = await loadActor(db, actor.id); // requireActor
    return loadShellData(db, a, NOW); // shell data and the bell's notifications
  });
  const withLayout = async (page: (a: Actor) => Promise<unknown>) => (await layout()) + (await measure(() => page(actor)));
  return {
    layout: await layout(),
    'dashboard (/)': await withLayout((a) => getDashboard(db, a, NOW)),
    'kontrola/[code]': await withLayout(async (a) => {
      return loadReviewPage(db, a, reviewCode, { cycleParam: undefined }, NOW);
    }),
    'scenare (list)': await withLayout(async (a) => {
      const options = await loadEditorOptions(db);
      return listVideos(db, a, { cycleId: options.cycles[0]?.key });
    }),
    'scenare/[code]': await withLayout(async (a) => loadScriptPage(db, a, reviewCode, NOW)),
    'serie (list)': await withLayout(async () => Promise.all([loadSeriesList(db), listLookups(db, 'category')])),
    'serie/[code]': await withLayout(async () => {
      const detail = await loadSeriesDetail(db, 'S01');
      await Promise.all([listLookups(db, 'category'), leadershipUsers(db)]);
      return detail;
    }),
    'scenare/[code]/upravit': await withLayout(async (a) => {
      return loadScriptPage(db, a, reviewCode, NOW, { activity: false, options: true });
    }),
  };
}

async function useCases(): Promise<Record<string, number>> {
  const { db, admin, honza } = w;
  const { id: videoId } = await createVideo(db, admin, { title: 'Perf', ...COMPLETE_META }, NOW);
  const saveDraftCount = await measure(() => saveDraft(db, admin, videoId, w.cleanBody(), NOW));
  await submitForReview(db, admin, videoId, {}, NOW);
  const [row] = await db.query.videos.findMany({ where: (v, { eq }) => eq(v.id, videoId) });
  const versionId = (await db.query.scriptVersions.findFirst({ where: (v, { eq }) => eq(v.videoId, row.id) }))!.id;
  const commentCount = await measure(() =>
    createComment(db, honza, { videoId, versionId, type: 'remark', body: 'Perf komentář' }, NOW),
  );
  const decideCount = await measure(() =>
    decide(db, honza, { videoId, versionId, decision: 'return', note: 'Vrátit' }, NOW),
  );
  return { saveDraft: saveDraftCount, createComment: commentCount, decide: decideCount };
}

describe('query count per page and action', () => {
  let before: Record<string, number>;
  let reviewCode: string;

  beforeAll(async () => {
    w = await setupWorld();
    hook(w.db);
    reviewCode = (await createSubmitted(w, 'Perf kontrola')).code;
  });

  it('stays within the ceiling and does not grow with the number of videos and comments', async () => {
    before = { ...(await pages(w.honza, reviewCode)), ...(await useCases()) };

    const { id: videoId } = (await w.db.query.videos.findFirst({ where: (v, { eq }) => eq(v.code, reviewCode) }))!;
    const versionId = (await w.db.query.scriptVersions.findFirst({ where: (v, { eq }) => eq(v.videoId, videoId) }))!.id;
    for (let i = 0; i < EXTRA; i++) {
      await createSubmitted(w, `Extra ${i}`);
      await createComment(w.db, w.honza, { videoId, versionId, type: 'remark', body: `Komentář ${i}` }, NOW);
    }
    const after = { ...(await pages(w.honza, reviewCode)), ...(await useCases()) };

    console.table(Object.fromEntries(Object.keys(before).map((k) => [k, { small: before[k], grown: after[k] }])));
    for (const key of Object.keys(before)) {
      expect(after[key], `${key} grows with data`).toBeLessThanOrEqual(before[key]);
    }
    for (const key of Object.keys(after).filter((k) => k === 'layout' || k.includes('/') || k.includes('('))) {
      if (key === 'layout') continue;
      expect(after[key], `${key} query ceiling`).toBeLessThanOrEqual(PAGE_CEILING);
    }
  });

  it('keeps the ceiling for a non-leadership author too', async () => {
    const counts = await pages(w.admin, reviewCode);
    for (const [key, n] of Object.entries(counts)) {
      if (key !== 'layout') expect(n, `${key} (admin)`).toBeLessThanOrEqual(PAGE_CEILING);
    }
  });
});
