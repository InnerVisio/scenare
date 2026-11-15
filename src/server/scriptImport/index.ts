import { can } from '@/domain/policy/can';
import { basicParse, emptyMeta, splitScripts, suggestProfile, type ImportResult } from '@/domain/script/import';
import type { Actor } from '@/server/actor';
import type { EditorOptions } from '@/server/editorOptions';
import { loadEditorOptions } from '@/server/editorOptions';
import { DomainError } from '@/server/errors';
import type { Db } from '@/db/client';

export const MIN_LENGTH = 20;
export const MAX_LENGTH = 20_000;
export const MAX_SCRIPTS = 20;

export type ParsedScript = ImportResult;

const GOAL = { share: 'shares', save: 'saves', question: 'comments' } as const;

/** Pure: one pasted script → structure and meta suggestions (profile from who speaks, goal from the call to action). */
export function parseOne(text: string, options: Pick<EditorOptions, 'profiles'>): ParsedScript {
  const { body, title, warnings } = basicParse(text);
  const meta = emptyMeta(title);
  meta.profileKey = suggestProfile(body, options.profiles);
  if (body.cta) meta.goalMetric = GOAL[body.cta.ctaType];
  return { body, meta, warnings };
}

/** „Rozdělit scénář“: splits the paste into one or more scripts. Admin only; writes nothing. */
export async function parseScriptsText(db: Db, actor: Actor, text: string): Promise<ParsedScript[]> {
  if (!can(actor, 'script.create')) throw new DomainError('FORBIDDEN', 'K této akci nemáš oprávnění.');
  const trimmed = text.trim();
  if (trimmed.length < MIN_LENGTH) throw new DomainError('VALIDATION', `Vlož aspoň ${MIN_LENGTH} znaků textu scénáře.`);
  if (trimmed.length > MAX_LENGTH) throw new DomainError('VALIDATION', `Text je moc dlouhý (nejvýš ${MAX_LENGTH.toLocaleString('cs')} znaků).`);
  const options = await loadEditorOptions(db);
  const parts = splitScripts(trimmed);
  if (parts.length > MAX_SCRIPTS) throw new DomainError('VALIDATION', `Najednou jde vložit nejvýš ${MAX_SCRIPTS} scénářů.`);
  return parts.map((part) => parseOne(part, options));
}
