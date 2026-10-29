'use server';

import { z } from 'zod';
import { addNextCycle, updateSettings, upsertLookups, upsertUser } from '@/server/settings';
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

export async function addCycle() {
  return runAction({}, z.object({}), (db, actor, _input, now) => addNextCycle(db, actor, now));
}
