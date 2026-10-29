import { newId } from '@/domain/ids';
import type { Cta, Hook, HookId, Line, Scene, ScriptBody } from '@/domain/script/types';

// Pure helpers behind the script editor: every function returns a new value and never mutates its input.

// ---- hashtags -----------------------------------------------------------------------------------

/** „#VášKonzultant “ → „#váškonzultant“; null when nothing usable is left. */
export function normalizeHashtag(raw: string): string | null {
  const word = raw.toLocaleLowerCase('cs').replace(/[^\p{L}\p{N}_]/gu, '');
  return word ? `#${word}` : null;
}

/** Adds every tag typed in `raw` (split on spaces and commas), skipping duplicates. */
export function addHashtags(tags: string[], raw: string): string[] {
  const next = [...tags];
  for (const part of raw.split(/[\s,]+/)) {
    const tag = normalizeHashtag(part);
    if (tag && !next.includes(tag)) next.push(tag);
  }
  return next;
}

/** Adds the names typed in `raw` (separated by commas), skipping ones already there. */
export function addNames(names: string[], raw: string): string[] {
  const next = [...names];
  for (const part of raw.split(',')) {
    const name = part.trim();
    if (name && !next.some((n) => n.toLocaleLowerCase('cs') === name.toLocaleLowerCase('cs'))) next.push(name);
  }
  return next;
}

// ---- call to action and lines -------------------------------------------------------------------

/** Marks `lineId` as the call to action, moves the mark there from another line, or removes it. */
export function toggleCta(body: ScriptBody, lineId: string, defaultType: Cta['ctaType']): ScriptBody {
  if (body.cta?.lineId === lineId) return { ...body, cta: null };
  return { ...body, cta: { lineId, ctaType: body.cta?.ctaType ?? defaultType } };
}

function swap<T>(items: T[], index: number, dir: -1 | 1): T[] {
  const other = index + dir;
  if (index < 0 || other < 0 || other >= items.length) return items;
  const next = [...items];
  [next[index], next[other]] = [next[other], next[index]];
  return next;
}

/** Moves a line up or down inside its scene; at the edge it stays. */
export function moveLine(body: ScriptBody, lineId: string, dir: -1 | 1): ScriptBody {
  return {
    ...body,
    scenes: body.scenes.map((scene) => {
      const index = scene.lines.findIndex((l) => l.id === lineId);
      return index === -1 ? scene : { ...scene, lines: swap(scene.lines, index, dir) };
    }),
  };
}

// ---- reducer ------------------------------------------------------------------------------------

type SimpleKey = 'caption' | 'viewerLearns' | 'source' | 'differsFromLast3';

export type BodyAction =
  | { type: 'replace'; body: ScriptBody }
  | { type: 'field'; key: SimpleKey; value: string }
  | { type: 'hashtags'; value: string[] }
  | { type: 'hook'; id: HookId; patch: Partial<Omit<Hook, 'id'>> }
  | { type: 'addHook' }
  | { type: 'removeHook'; id: HookId }
  | { type: 'scene'; sceneId: string; patch: Partial<Pick<Scene, 'fromSec' | 'toSec' | 'visual'>> }
  | { type: 'addScene' }
  | { type: 'removeScene'; sceneId: string }
  | { type: 'moveScene'; sceneId: string; dir: -1 | 1 }
  | { type: 'line'; lineId: string; patch: Partial<Pick<Line, 'speaker' | 'direction' | 'text'>> }
  | { type: 'addLine'; sceneId: string }
  | { type: 'removeLine'; lineId: string }
  | { type: 'moveLine'; lineId: string; dir: -1 | 1 }
  | { type: 'toggleCta'; lineId: string; defaultType: Cta['ctaType'] }
  | { type: 'ctaType'; ctaType: Cta['ctaType'] };

const HOOK_IDS: HookId[] = ['A', 'B', 'C'];

const newLine = (): Line => ({ id: newId(), speaker: '', direction: '', text: '' });

/** The call to action only survives while its line does. */
function dropOrphanCta(body: ScriptBody): ScriptBody {
  const lineId = body.cta?.lineId;
  if (!lineId || body.scenes.some((s) => s.lines.some((l) => l.id === lineId))) return body;
  return { ...body, cta: null };
}

export function bodyReducer(body: ScriptBody, action: BodyAction): ScriptBody {
  switch (action.type) {
    case 'replace':
      return action.body;
    case 'field':
      return { ...body, [action.key]: action.value };
    case 'hashtags':
      return { ...body, hashtags: action.value };
    case 'hook':
      return { ...body, hooks: body.hooks.map((h) => (h.id === action.id ? { ...h, ...action.patch } : h)) };
    case 'addHook': {
      const free = HOOK_IDS.find((id) => !body.hooks.some((h) => h.id === id));
      if (!free) return body;
      const hooks = [...body.hooks, { id: free, hookType: null, text: '', visual: '' }];
      return { ...body, hooks: hooks.sort((a, b) => a.id.localeCompare(b.id)) };
    }
    case 'removeHook':
      return action.id === 'A' ? body : { ...body, hooks: body.hooks.filter((h) => h.id !== action.id) };
    case 'scene':
      return { ...body, scenes: body.scenes.map((s) => (s.id === action.sceneId ? { ...s, ...action.patch } : s)) };
    case 'addScene': {
      const fromSec = body.scenes.at(-1)?.toSec ?? null;
      return { ...body, scenes: [...body.scenes, { id: newId(), fromSec, toSec: null, visual: '', lines: [newLine()] }] };
    }
    case 'removeScene':
      return dropOrphanCta({ ...body, scenes: body.scenes.filter((s) => s.id !== action.sceneId) });
    case 'moveScene':
      return { ...body, scenes: swap(body.scenes, body.scenes.findIndex((s) => s.id === action.sceneId), action.dir) };
    case 'line':
      return {
        ...body,
        scenes: body.scenes.map((s) => ({ ...s, lines: s.lines.map((l) => (l.id === action.lineId ? { ...l, ...action.patch } : l)) })),
      };
    case 'addLine':
      return { ...body, scenes: body.scenes.map((s) => (s.id === action.sceneId ? { ...s, lines: [...s.lines, newLine()] } : s)) };
    case 'removeLine':
      return dropOrphanCta({
        ...body,
        scenes: body.scenes.map((s) => ({ ...s, lines: s.lines.filter((l) => l.id !== action.lineId) })),
      });
    case 'moveLine':
      return moveLine(body, action.lineId, action.dir);
    case 'toggleCta':
      return toggleCta(body, action.lineId, action.defaultType);
    case 'ctaType':
      return body.cta ? { ...body, cta: { ...body.cta, ctaType: action.ctaType } } : body;
  }
}

// ---- speakers -----------------------------------------------------------------------------------

/** Names offered for a line's speaker: the leaders, the client, then whoever already speaks in the script. */
export function speakerSuggestions(profileSpeakers: string[], body: ScriptBody): string[] {
  const used = body.scenes.flatMap((s) => s.lines.map((l) => l.speaker.trim())).filter(Boolean);
  return [...new Set([...profileSpeakers, 'Klient', ...used])];
}

// ---- meta ---------------------------------------------------------------------------------------

export interface MetaFormat {
  key: string;
  status: 'verified' | 'untested';
}

/** Picks a format; an untested one suggests a Trial Reel (the author may untick it). */
export function applyFormat<T extends { formatKey: string | null; isTrialReel: boolean }>(
  values: T,
  formatKey: string | null,
  formats: MetaFormat[],
): T {
  const untested = formats.find((f) => f.key === formatKey)?.status === 'untested';
  return { ...values, formatKey, isTrialReel: untested ? true : values.isTrialReel };
}

/** The fields of `current` that differ from `saved` (arrays by value). A blank title is never sent. */
export function metaPatch<T extends object>(current: T, saved: T): Partial<T> {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(current) as (keyof T & string)[]) {
    if (JSON.stringify(current[key]) === JSON.stringify(saved[key])) continue;
    if (key === 'title' && String(current[key]).trim() === '') continue;
    patch[key] = current[key];
  }
  return patch as Partial<T>;
}
