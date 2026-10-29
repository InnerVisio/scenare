import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { requireActor } from '@/server/auth/session';
import { DomainError } from '@/server/errors';
import { loadReview, resolveCycleFilter } from '@/server/review';
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
  const cycleId = await resolveCycleFilter(db, (await searchParams).cyklus);

  let data;
  try {
    data = await loadReview(db, actor, decodeURIComponent(code).toUpperCase(), { cycleId }, new Date());
  } catch (error) {
    if (error instanceof DomainError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }

  const query = cycleId ? `?cyklus=${cycleId}` : '';
  // Keyed so that moving to another script starts with a fresh view (tabs, composer, selection).
  return <ReviewScreen key={data.video.id} data={data} query={query} />;
}
