import { and, asc, desc, eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import type { ApprovalPolicy, ApprovalStatus } from '@/domain/workflow/approval';
import { DomainError } from './errors';

/** The transaction handle passed to `db.transaction` callbacks. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Anything that can run queries: the database or a transaction. */
export type Executor = Db | Tx;

export type VideoRow = typeof s.videos.$inferSelect;
export type VersionRow = typeof s.scriptVersions.$inferSelect;
export type CommentRow = typeof s.comments.$inferSelect;

export const statusOf = (video: Pick<VideoRow, 'approvalStatus'>) => video.approvalStatus as ApprovalStatus;

/** `lock` takes a row lock so concurrent writers on one script are serialised until commit. */
export async function loadVideo(tx: Executor, id: string, opts: { lock?: boolean } = {}): Promise<VideoRow> {
  const query = tx.select().from(s.videos).where(eq(s.videos.id, id));
  const [video] = await (opts.lock ? query.for('update') : query);
  if (!video) throw new DomainError('NOT_FOUND', 'Scénář nenalezen.');
  return video;
}

export async function latestVersion(tx: Executor, videoId: string): Promise<VersionRow | undefined> {
  const [version] = await tx
    .select()
    .from(s.scriptVersions)
    .where(eq(s.scriptVersions.videoId, videoId))
    .orderBy(desc(s.scriptVersions.versionNo))
    .limit(1);
  return version;
}

export async function loadComment(tx: Executor, id: string): Promise<CommentRow> {
  const [comment] = await tx.select().from(s.comments).where(eq(s.comments.id, id));
  if (!comment) throw new DomainError('NOT_FOUND', 'Komentář nenalezen.');
  return comment;
}

/** Leadership users ordered by name (Honza, Radek). */
export async function leadershipUsers(tx: Executor): Promise<{ id: string; name: string }[]> {
  return tx
    .select({ id: s.users.id, name: s.users.name })
    .from(s.users)
    .where(eq(s.users.role, 'leadership'))
    .orderBy(asc(s.users.name));
}

/** Approval policy from settings plus the series guarantor (only if that user is leadership). */
export async function approvalSetup(
  tx: Executor,
  video: Pick<VideoRow, 'seriesId'>,
): Promise<{ policy: ApprovalPolicy; guarantorId: string | null }> {
  const [settings] = await tx.select().from(s.settings).where(eq(s.settings.id, 'global'));
  const policy = (settings?.approvalPolicy ?? 'all_leadership') as ApprovalPolicy;
  let guarantorId: string | null = null;
  if (video.seriesId) {
    const [row] = await tx
      .select({ id: s.users.id })
      .from(s.series)
      .innerJoin(s.users, eq(s.users.id, s.series.guarantorId))
      .where(and(eq(s.series.id, video.seriesId), eq(s.users.role, 'leadership')));
    guarantorId = row?.id ?? null;
  }
  return { policy, guarantorId };
}

/** Body that new comments and number flags refer to: latest version, or the draft before the first submit. */
export async function referenceBody(tx: Executor, video: VideoRow) {
  return (await latestVersion(tx, video.id))?.body ?? video.draft ?? null;
}
