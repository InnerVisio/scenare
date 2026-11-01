import { eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import { newId } from '@/domain/ids';
import { can } from '@/domain/policy/can';
import {
  detectPlatform,
  MAX_REFERENCES,
  MAX_REFERENCE_NOTE,
  MAX_REFERENCE_URL,
  type Platform,
  type VideoReference,
} from '@/domain/references';
import { logActivity } from './activity';
import type { Actor } from './actor';
import { DomainError } from './errors';
import { loadVideo, referenceBody } from './loaders';

const forbidden = () => new DomainError('FORBIDDEN', 'K této akci nemáš oprávnění.');

function validUrl(raw: string): string {
  const url = raw.trim();
  let ok = false;
  try {
    ok = /^https?:$/.test(new URL(url).protocol) && /^https?:\/\//i.test(url);
  } catch {
    ok = false;
  }
  if (!ok) throw new DomainError('VALIDATION', 'Vlož odkaz začínající https://');
  if (url.length > MAX_REFERENCE_URL) {
    throw new DomainError('VALIDATION', `Odkaz je příliš dlouhý (nejvýše ${MAX_REFERENCE_URL} znaků).`);
  }
  return url;
}

/** Attach a sample video to a script (`sceneId: null`) or to one of its scenes. Open to every signed-in user. */
export async function addReference(
  db: Db,
  actor: Actor,
  input: { videoId: string; url: string; note?: string; sceneId?: string | null },
  now: Date,
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const video = await loadVideo(tx, input.videoId, { lock: true });
    if (!can(actor, 'reference.add')) throw forbidden();

    const url = validUrl(input.url);
    const note = (input.note ?? '').trim();
    if (note.length > MAX_REFERENCE_NOTE) {
      throw new DomainError('VALIDATION', `Poznámka je příliš dlouhá (nejvýše ${MAX_REFERENCE_NOTE} znaků).`);
    }
    if (video.references.length >= MAX_REFERENCES) {
      throw new DomainError('VALIDATION', `Ke scénáři může být nejvýše ${MAX_REFERENCES} ukázek.`);
    }

    // A scene that is not in the current text (deleted, or never saved) turns into a whole-video sample.
    let sceneId = input.sceneId ?? null;
    if (sceneId !== null) {
      const body = await referenceBody(tx, video);
      if (!body?.scenes.some((scene) => scene.id === sceneId)) sceneId = null;
    }

    const reference: VideoReference = { id: newId(), url, note, sceneId, addedBy: actor.id, addedAt: now.toISOString() };
    await tx
      .update(s.videos)
      .set({ references: [...video.references, reference] })
      .where(eq(s.videos.id, video.id));
    await logActivity(
      tx,
      {
        actorId: actor.id,
        videoId: video.id,
        entity: 'reference',
        entityId: reference.id,
        action: 'reference.added',
        after: { url, sceneId },
      },
      now,
    );
    return { id: reference.id };
  });
}

/** Remove a sample: its author or an admin. */
export async function removeReference(
  db: Db,
  actor: Actor,
  input: { videoId: string; referenceId: string },
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const video = await loadVideo(tx, input.videoId, { lock: true });
    const reference = video.references.find((r) => r.id === input.referenceId);
    if (!reference) throw new DomainError('NOT_FOUND', 'Ukázka nenalezena.');
    if (!can(actor, 'reference.remove', { ownerId: reference.addedBy })) throw forbidden();

    await tx
      .update(s.videos)
      .set({ references: video.references.filter((r) => r.id !== reference.id) })
      .where(eq(s.videos.id, video.id));
    await logActivity(
      tx,
      {
        actorId: actor.id,
        videoId: video.id,
        entity: 'reference',
        entityId: reference.id,
        action: 'reference.removed',
        before: { url: reference.url, sceneId: reference.sceneId },
      },
      now,
    );
  });
}

/** A sample as the screens show it. */
export interface ReferenceVM extends Platform {
  id: string;
  url: string;
  note: string;
  sceneId: string | null;
  addedByName: string;
  canRemove: boolean;
}

/** View models from the video's own column; names come from users the page already loaded. */
export function toReferenceVMs(
  references: readonly VideoReference[],
  actor: Actor,
  userName: ReadonlyMap<string, string>,
): ReferenceVM[] {
  return references.map((r) => ({
    ...detectPlatform(r.url),
    id: r.id,
    url: r.url,
    note: r.note,
    sceneId: r.sceneId,
    addedByName: userName.get(r.addedBy) ?? 'Někdo',
    canRemove: can(actor, 'reference.remove', { ownerId: r.addedBy }),
  }));
}
