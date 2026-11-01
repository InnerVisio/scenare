'use server';

import { z } from 'zod';
import type { ActionResult } from '@/server/actionResult';
import { addPublication, deletePublication, updatePublication } from '@/server/publications';
import { runAction } from '../_actions/run';

const id = z.string().min(1).max(64);
const metrics = z.record(z.string().max(32), z.union([z.string().max(32), z.number()])).nullable().optional();
const fields = z.object({
  profileKey: z.string().min(1).max(64),
  publishedAt: z.string().min(1).max(40),
  variant: z.string().min(1).max(64),
  url: z.string().max(1000),
  note: z.string().max(2000),
  metrics24h: metrics,
  metrics7d: metrics,
});

export async function addPublicationAction(input: { videoId: string } & z.input<typeof fields>): Promise<ActionResult> {
  return runAction(input, fields.extend({ videoId: id }), async (db, actor, { videoId, ...rest }, now) => {
    await addPublication(db, actor, videoId, rest, now);
  });
}

export async function updatePublicationAction(input: { publicationId: string } & z.input<typeof fields>): Promise<ActionResult> {
  return runAction(input, fields.extend({ publicationId: id }), (db, actor, { publicationId, ...rest }, now) => updatePublication(db, actor, publicationId, rest, now));
}

export async function deletePublicationAction(input: { publicationId: string }): Promise<ActionResult> {
  return runAction(input, z.object({ publicationId: id }), (db, actor, i, now) => deletePublication(db, actor, i.publicationId, now));
}
