'use server';

import { z } from 'zod';
import { createPersonalLoginLink } from '@/server/auth/magicLink';
import { sendTestMail } from '@/server/notify/testMail';
import { addShootingDay, disableTeamLink, regenerateTeamLink, deleteShootingDay, updateSettings, updateShootingDay, upsertLookups, upsertUser } from '@/server/settings';
import { runAction } from '../_actions/run';

// Thin wrappers around the admin use cases in `src/server/settings.ts`.

const settingsSchema = z.object({
  monthlyTarget: z.number().int(),
  approvalDaysBefore: z.number().int(),
  tolerancePp: z.number().int(),
  approvalPolicy: z.enum(['all_leadership', 'any_leadership', 'series_guarantor']),
});

const lookupSchema = z.object({
  items: z
    .array(
      z.object({
        kind: z.string().min(1).max(64),
        key: z.string().min(1).max(64),
        label: z.string().max(200),
        sortOrder: z.number(),
        archived: z.boolean(),
        data: z.record(z.string(), z.unknown()),
      }),
    )
    .max(200),
});

const userSchema = z.object({
  id: z.string().max(64).optional(),
  name: z.string().max(120),
  email: z.string().max(200),
  role: z.enum(['admin', 'marketer', 'leadership', 'production']),
  initials: z.string().max(10),
  notifyEmail: z.boolean().optional(),
});

export async function saveSettings(input: unknown) {
  return runAction(input, settingsSchema, (db, actor, patch, now) => updateSettings(db, actor, patch, now));
}

export async function saveLookups(input: unknown) {
  return runAction(input, lookupSchema, (db, actor, { items }, now) => upsertLookups(db, actor, items, now));
}

export async function saveUser(input: unknown) {
  return runAction(input, userSchema, (db, actor, user, now) => upsertUser(db, actor, user, now));
}

const dayFields = {
  plannedVideos: z.number().int().optional(),
  note: z.string().max(300).optional(),
};

export async function addShootingDayAction(input: unknown) {
  return runAction(input, z.object({ shootDate: z.string().max(10), ...dayFields }), (db, actor, day, now) => addShootingDay(db, actor, day, now));
}

export async function updateShootingDayAction(input: unknown) {
  return runAction(
    input,
    z.object({ id: z.string().min(1).max(32), shootDate: z.string().max(10).optional(), ...dayFields }),
    (db, actor, { id, ...patch }, now) => updateShootingDay(db, actor, id, patch, now),
  );
}

export async function deleteShootingDayAction(input: unknown) {
  return runAction(input, z.object({ id: z.string().min(1).max(32), moveTo: z.string().min(1).max(32).nullable() }), (db, actor, { id, moveTo }, now) => deleteShootingDay(db, actor, id, { moveTo }, now));
}

export async function sendTestMailToMe() {
  return runAction({}, z.object({}), (db, actor, _input, now) => sendTestMail(db, actor, now), { revalidate: false });
}

export async function createLoginLink(input: unknown) {
  return runAction(
    input,
    z.object({ userId: z.string().min(1).max(64) }),
    (db, actor, { userId }, now) => createPersonalLoginLink(db, actor, userId, now),
    { revalidate: false },
  );
}

export async function regenerateTeamLinkAction() {
  return runAction({}, z.object({}), (db, actor, _input, now) => regenerateTeamLink(db, actor, now));
}

export async function disableTeamLinkAction() {
  return runAction({}, z.object({}), (db, actor, _input, now) => disableTeamLink(db, actor, now));
}
