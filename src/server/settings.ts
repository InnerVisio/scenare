import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import { newId } from '@/domain/ids';
import { can, type Role } from '@/domain/policy/can';
import type { ApprovalPolicy } from '@/domain/workflow/approval';
import type { Actor } from './actor';
import { DomainError } from './errors';

const SETTINGS_ID = 'global';
const ROLES: readonly Role[] = ['admin', 'marketer', 'leadership', 'production'];
const POLICIES: readonly ApprovalPolicy[] = ['all_leadership', 'any_leadership', 'series_guarantor'];
const SHARE_TOLERANCE = 0.001;

function assertAdmin(actor: Actor): void {
  if (!can(actor, 'settings.manage')) throw new DomainError('FORBIDDEN', 'Sem nemáš přístup.');
}

const invalid = (message: string) => new DomainError('VALIDATION', message);

// ---------------------------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------------------------

export interface Settings {
  monthlyTarget: number;
  approvalDaysBefore: number;
  tolerancePp: number;
  approvalPolicy: ApprovalPolicy;
}

export async function getSettings(db: Db): Promise<Settings> {
  const [row] = await db.select().from(s.settings).where(eq(s.settings.id, SETTINGS_ID));
  return {
    monthlyTarget: row?.monthlyTarget ?? 16,
    approvalDaysBefore: row?.approvalDaysBefore ?? 7,
    tolerancePp: row?.tolerancePp ?? 10,
    approvalPolicy: POLICIES.find((p) => p === row?.approvalPolicy) ?? 'all_leadership',
  };
}

function intInRange(value: number | undefined, min: number, max: number, label: string): void {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < min || value > max) throw invalid(`${label} musí být celé číslo od ${min} do ${max}.`);
}

export async function updateSettings(db: Db, actor: Actor, patch: Partial<Settings>, now: Date): Promise<void> {
  void now; // reserved for activity logging
  assertAdmin(actor);
  intInRange(patch.monthlyTarget, 1, 200, 'Měsíční cíl');
  intInRange(patch.approvalDaysBefore, 0, 90, 'Počet dní před natáčením');
  intInRange(patch.tolerancePp, 0, 100, 'Tolerance');
  if (patch.approvalPolicy !== undefined && !POLICIES.includes(patch.approvalPolicy)) throw invalid('Neplatná politika schvalování.');
  const values = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  await db
    .insert(s.settings)
    .values({ id: SETTINGS_ID, ...values })
    .onConflictDoUpdate({ target: s.settings.id, set: values });
}

// ---------------------------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------------------------

export interface LookupInput {
  kind: string;
  key: string;
  label: string;
  sortOrder: number;
  archived: boolean;
  data: Record<string, unknown>;
}

export type LookupRow = LookupInput & { id: string };

export async function listLookups(db: Db, kind: string): Promise<LookupRow[]> {
  return db
    .select()
    .from(s.lookupItems)
    .where(eq(s.lookupItems.kind, kind))
    .orderBy(asc(s.lookupItems.sortOrder), asc(s.lookupItems.key));
}

/** Saves several lookups of any kinds in one go; category shares are checked as a whole afterwards. */
export async function upsertLookups(db: Db, actor: Actor, items: LookupInput[], now: Date): Promise<void> {
  void now; // reserved for activity logging
  assertAdmin(actor);
  for (const item of items) {
    if (!item.kind.trim() || !item.key.trim()) throw invalid('Chybí druh nebo klíč položky.');
    if (!item.label.trim()) throw invalid('Název nesmí být prázdný.');
  }
  await db.transaction(async (tx) => {
    for (const item of items) {
      const values = {
        label: item.label.trim(),
        sortOrder: Math.trunc(item.sortOrder) || 0,
        archived: item.archived,
        data: item.data,
      };
      await tx
        .insert(s.lookupItems)
        .values({ id: newId(), kind: item.kind, key: item.key, ...values })
        .onConflictDoUpdate({ target: [s.lookupItems.kind, s.lookupItems.key], set: values });
    }
    if (items.some((i) => i.kind === 'category')) {
      const categories = await tx
        .select()
        .from(s.lookupItems)
        .where(and(eq(s.lookupItems.kind, 'category'), eq(s.lookupItems.archived, false)));
      const sum = categories.reduce((total, c) => total + (typeof c.data.share === 'number' ? c.data.share : 0), 0);
      if (Math.abs(sum - 1) > SHARE_TOLERANCE) throw invalid('Součet podílů musí být 100 %.');
    }
  });
}

export async function upsertLookup(db: Db, actor: Actor, item: LookupInput, now: Date): Promise<void> {
  await upsertLookups(db, actor, [item], now);
}

// ---------------------------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------------------------

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
}

export interface UserInput extends Omit<UserRow, 'id'> {
  id?: string;
}

export async function listUsers(db: Db): Promise<UserRow[]> {
  const rows = await db.select().from(s.users).orderBy(asc(s.users.name));
  return rows.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, initials: u.initials }));
}

export async function upsertUser(db: Db, actor: Actor, input: UserInput, now: Date): Promise<{ id: string }> {
  void now; // reserved for activity logging
  assertAdmin(actor);
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const initials = input.initials.trim();
  if (!name) throw invalid('Jméno nesmí být prázdné.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalid('Zadej platný e-mail.');
  if (!initials || initials.length > 3) throw invalid('Iniciály mají mít 1 až 3 znaky.');
  if (!ROLES.includes(input.role)) throw invalid('Neplatná role.');

  const values = { name, email, role: input.role, initials };
  const [taken] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email));
  if (taken && taken.id !== input.id) throw invalid('Tenhle e-mail už používá jiný uživatel.');

  if (input.id) {
    const updated = await db.update(s.users).set(values).where(eq(s.users.id, input.id)).returning({ id: s.users.id });
    if (updated.length === 0) throw new DomainError('NOT_FOUND', 'Uživatel nenalezen.');
    return { id: input.id };
  }
  const id = newId();
  await db.insert(s.users).values({ id, ...values });
  return { id };
}

// ---------------------------------------------------------------------------------------------
// Cycles
// ---------------------------------------------------------------------------------------------

/** Month after `YYYY-MM`, rolling over the year. */
export function nextMonth(id: string): string {
  const [year, month] = id.split('-').map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
}

export async function listCycles(db: Db) {
  return db.select().from(s.shootingCycles).orderBy(asc(s.shootingCycles.id));
}

export async function addNextCycle(db: Db, actor: Actor, now: Date): Promise<{ id: string }> {
  void now; // reserved for activity logging
  assertAdmin(actor);
  const settings = await getSettings(db);
  const cycles = await listCycles(db);
  const latest = cycles.at(-1);
  if (!latest) throw invalid('Nejdřív je potřeba první natáčecí cyklus.');
  const id = nextMonth(latest.id);
  await db.insert(s.shootingCycles).values({ id, plannedVideos: settings.monthlyTarget, coversMonths: [id] });
  return { id };
}
