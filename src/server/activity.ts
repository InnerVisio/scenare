import { eq } from 'drizzle-orm';
import * as s from '@/db/schema';
import { newId } from '@/domain/ids';
import { leadershipUsers, type CommentRow, type Executor } from './loaders';

export interface ActivityInput {
  actorId: string | null;
  videoId: string | null;
  entity: string;
  entityId: string;
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

const OWNER_ONLY = new Set(['approval.approved', 'approval.returned', 'video.approved', 'comment.closed', 'comment.reopened']);
const ROOT_AUTHOR_ONLY = new Set(['suggestion.accepted', 'suggestion.rejected', 'comment.addressed']);

async function findComment(tx: Executor, id: string): Promise<CommentRow | undefined> {
  const [row] = await tx.select().from(s.comments).where(eq(s.comments.id, id));
  return row;
}

/** Who should be told about this activity (before removing the actor). */
async function recipientsFor(tx: Executor, input: ActivityInput): Promise<string[]> {
  const ownerId = async (): Promise<string[]> => {
    if (!input.videoId) return [];
    const [video] = await tx.select({ ownerId: s.videos.ownerId }).from(s.videos).where(eq(s.videos.id, input.videoId));
    return video?.ownerId ? [video.ownerId] : [];
  };

  if (input.action === 'version.submitted') return (await leadershipUsers(tx)).map((u) => u.id);
  if (OWNER_ONLY.has(input.action)) return ownerId();

  if (input.action === 'comment.created' || input.action === 'comment.replied') {
    const comment = await findComment(tx, input.entityId);
    if (!comment) return [];
    const rootAuthor =
      input.action === 'comment.replied' && comment.parentId
        ? [(await findComment(tx, comment.parentId))?.authorId].filter((id): id is string => !!id)
        : [];
    return [...rootAuthor, ...(await ownerId()), ...comment.mentions];
  }

  if (ROOT_AUTHOR_ONLY.has(input.action)) {
    const comment = await findComment(tx, input.entityId);
    return comment ? [comment.authorId] : [];
  }

  return [];
}

/**
 * Appends an activity_log row and fans out notifications (never to the actor, de-duplicated).
 * Must be called inside the same transaction as the change it records.
 */
export async function logActivity(tx: Executor, input: ActivityInput, now: Date): Promise<string> {
  const id = newId();
  await tx.insert(s.activityLog).values({
    id,
    actorId: input.actorId,
    videoId: input.videoId,
    entity: input.entity,
    entityId: input.entityId,
    action: input.action,
    before: input.before ?? null,
    after: input.after ?? null,
    createdAt: now,
  });

  const recipients = [...new Set(await recipientsFor(tx, input))].filter((userId) => userId !== input.actorId);
  if (recipients.length > 0) {
    await tx
      .insert(s.notifications)
      .values(recipients.map((userId) => ({ id: newId(), userId, activityId: id, createdAt: now })));
  }
  return id;
}
