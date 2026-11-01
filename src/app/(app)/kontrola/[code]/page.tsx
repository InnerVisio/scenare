import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { requireActor } from '@/server/auth/session';
import { DomainError } from '@/server/errors';
import { loadReviewPage } from '@/server/review';
import { ReviewScreen } from '../../_components/review/ReviewScreen';

export const metadata = { title: 'Kontrola scénáře – GTA Scénáře' };
export const dynamic = 'force-dynamic';

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ cyklus?: string | string[] }>;
}) {
  const actor = await requireActor();
  const db = await getDb();
  const { code } = await params;
  const rawCycle = (await searchParams).cyklus;

  let data;
  let cycleId: string | undefined;
  try {
    ({ data, cycleId } = await loadReviewPage(
      db,
      actor,
      decodeURIComponent(code).toUpperCase(),
      { cycleParam: Array.isArray(rawCycle) ? rawCycle[0] : rawCycle },
      new Date(),
    ));
  } catch (error) {
    // A malformed %-escape in the URL (URIError) is just a script that does not exist.
    if (error instanceof URIError || (error instanceof DomainError && error.code === 'NOT_FOUND')) notFound();
    throw error;
  }

  const query = cycleId ? `?cyklus=${cycleId}` : '';
  // Keyed so that moving to another script starts with a fresh view (tabs, composer, selection).
  return <ReviewScreen key={data.video.id} data={data} query={query} />;
}
