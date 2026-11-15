import { newId } from '@/domain/ids';
import type { Hook, Line, Scene, ScriptBody } from './types';

/** Suggested meta of an imported script; every key is validated against the pickers' options. */
export interface ImportMeta {
  title: string;
  categoryKey: string | null;
  treatmentKey: string | null;
  profileKey: string | null;
  characterKey: string | null;
  formatKey: string | null;
  goalMetric: 'shares' | 'saves' | 'comments' | null;
  locationKeys: string[];
}

export interface ImportResult {
  body: ScriptBody;
  meta: ImportMeta;
  warnings: string[];
}

export const MAX_SCENES = 12;
export const NO_TIMES_WARNING = 'Doplň časy scén v editoru.';
export const NO_HOOK_WARNING = 'Nenašel jsem hook — doplň ho v editoru.';

export const emptyMeta = (title = ''): ImportMeta => ({
  title,
  categoryKey: null,
  treatmentKey: null,
  profileKey: null,
  characterKey: null,
  formatKey: null,
  goalMetric: null,
  locationKeys: [],
});

/** Same rule as the editor's hashtag input (kept here so the domain does not depend on the app layer). */
export function toHashtag(raw: string): string | null {
  const word = raw.toLocaleLowerCase('cs').replace(/[^\p{L}\p{N}_]/gu, '');
  return word ? `#${word}` : null;
}

export function ctaTypeOf(text: string): 'share' | 'save' | 'question' | null {
  if (/ulož si/i.test(text)) return 'save';
  if (/sdílej|pošli to/i.test(text)) return 'share';
  if (/napiš do komentářů|napiš mi|komentuj/i.test(text)) return 'question';
  return null;
}

const blankLine = (): Line => ({ id: newId(), speaker: '', direction: '', text: '' });

/** At most 12 scenes (the rest joins the last one), no scene without a line, at least one hook. Returns the warnings it adds. */
export function finishBody(body: ScriptBody): string[] {
  const warnings: string[] = [];
  if (body.scenes.length > MAX_SCENES) {
    const rest = body.scenes.splice(MAX_SCENES - 1);
    const merged = rest[0]!;
    for (const scene of rest.slice(1)) {
      merged.lines.push(...scene.lines);
      merged.visual = [merged.visual, scene.visual].filter(Boolean).join('\n');
      merged.toSec = scene.toSec ?? merged.toSec;
    }
    body.scenes.push(merged);
    warnings.push(`Scén bylo víc než ${MAX_SCENES}, poslední jsem sloučil dohromady.`);
  }
  for (const scene of body.scenes) if (scene.lines.length === 0) scene.lines.push(blankLine());
  if (body.hooks.length === 0) {
    body.hooks.push({ id: 'A', hookType: null, text: '', visual: '' });
    warnings.push(NO_HOOK_WARNING);
  }
  if (body.scenes.length > 0 && body.scenes.every((s) => s.fromSec === null && s.toSec === null)) warnings.push(NO_TIMES_WARNING);
  return warnings;
}

// ---- line recognition ------------------------------------------------------------------------

const DASH = '[–—-]';
const SECONDS_RANGE = new RegExp(String.raw`(\d{1,3})\s*${DASH}\s*(\d{1,3})\s*(?:s|sek)\b`, 'i');
const BRACKET_RANGE = new RegExp(String.raw`[\[(]\s*(\d{1,3})\s*${DASH}\s*(\d{1,3})\s*(?:s|sek)?\s*[\])]`, 'i');
const CLOCK_RANGE = new RegExp(String.raw`(\d{1,2}):(\d{2})\s*${DASH}\s*(\d{1,2}):(\d{2})`);
const clamp = (n: number) => Math.min(600, n);

interface TimeMatch {
  from: number;
  to: number;
  rest: string;
}

/** A time range at the start of `line` (or anywhere in it when `anywhere`); `rest` is the line without it. */
function extractTime(line: string, anywhere: boolean): TimeMatch | null {
  const attempts: [RegExp, (m: RegExpMatchArray) => [number, number]][] = [
    [CLOCK_RANGE, (m) => [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])]],
    [BRACKET_RANGE, (m) => [Number(m[1]), Number(m[2])]],
    [SECONDS_RANGE, (m) => [Number(m[1]), Number(m[2])]],
  ];
  for (const [re, pick] of attempts) {
    const m = line.match(re);
    if (!m || m.index === undefined) continue;
    if (!anywhere && line.slice(0, m.index).replace(/[\[(\s]/g, '') !== '') continue;
    const [from, to] = pick(m);
    const rest = (line.slice(0, m.index) + line.slice(m.index + m[0].length)).replace(/\(\s*\)|\[\s*\]/g, '').replace(/^[\s:–—.)-]+/, '').trim();
    return { from: clamp(from), to: clamp(to), rest };
  }
  return null;
}

interface Heading {
  from: number | null;
  to: number | null;
  rest: string;
}

function parseHeading(line: string): Heading | null {
  const scene = line.match(/^(?:sc[ée]na|scene)\s*\d+\s*(.*)$/i);
  if (scene) {
    const t = extractTime(scene[1]!, true);
    return t ? { from: t.from, to: t.to, rest: t.rest } : { from: null, to: null, rest: scene[1]!.replace(/^[\s:–—.)-]+/, '') };
  }
  const t = extractTime(line, false);
  if (t) return { from: t.from, to: t.to, rest: t.rest };
  return null;
}

const HOOK = /^(?:hook\s*[A-C1-3]?|h[1-3])\s*[:.)–—-]\s*(.*)$|^hook\s+[A-C1-3]?\s*(.*)$/i;
const SPEAKER = /^(?:[^\p{L}\p{N}[(#]+)?(\p{Lu}[\p{L}\p{N}.']*(?:\s+\p{Lu}[\p{L}\p{N}.']*){0,2}?)\s*(?:\(([^)]*)\))?\s*(?::\s*|\s[–—-]\s+)(\S.*)$/u;
const HASHTAG = /#[\p{L}\p{N}_]+/gu;
const CUT = /^střih\b[.:]?\s*(.*)$/i;
const QUOTED = /^(?:„|“|”|"|,,|‚|')\s*(.*?)\s*(?:“|”|"|’’|''|’|')$/su;
const SEPARATOR = /^\s*(?:-{3,}|\*{3,}|={3,})\s*$/;
const NUMBERED = /^\s*\d+[.)]\s+\S/;

/** Strips ONE pair of outer quotes of any style; the wording inside stays as written. */
export function stripQuotes(text: string): string {
  const m = text.match(QUOTED);
  return m ? m[1]! : text;
}

const capitalise = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => (w === w.toUpperCase() ? w.charAt(0) + w.slice(1).toLocaleLowerCase('cs') : w))
    .join(' ');

/** Splits a paste with several scripts at numbered titles („1. Název“) and at `---` / `***` / `===` lines. */
export function splitScripts(text: string): string[] {
  const chunks: string[][] = [[]];
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (SEPARATOR.test(line)) chunks.push([]);
    else if (NUMBERED.test(line)) chunks.push([line]);
    else chunks[chunks.length - 1]!.push(line);
  }
  return chunks.map((c) => c.join('\n').trim()).filter((c) => c !== '');
}

/** Splits ONE script into the structure with simple rules (no AI). Never throws. */
export function basicParse(text: string): { body: ScriptBody; title: string; warnings: string[] } {
  const rawLines = text.replace(/\r\n?/g, '\n').trim().split('\n').map((l) => l.trim());

  const hooks: Hook[] = [];
  const scenes: Scene[] = [];
  const hashtags: string[] = [];
  let title = '';
  let titulek = '';
  let caption: string[] = [];
  let viewerLearns = '';
  let source = '';
  let ctaLine: { lineId: string; ctaType: 'share' | 'save' | 'question' } | null = null;
  let mode: 'none' | 'caption' | 'hook' | 'learns' | 'source' = 'none';
  let scene: Scene | null = null;
  let newBlock = false;
  let seenAny = false;
  let first = true;

  const startScene = (from: number | null, to: number | null): Scene => {
    if (scene && scene.lines.length === 0 && scene.visual === '') {
      scene.fromSec = from;
      scene.toSec = to;
      return scene;
    }
    scene = { id: newId(), fromSec: from, toSec: to, visual: '', lines: [] };
    scenes.push(scene);
    return scene;
  };
  const current = (): Scene => (scene && (!newBlock || scene.lines.length === 0) ? scene : startScene(null, null));
  const addVisual = (target: { visual: string }, value: string) => {
    target.visual = target.visual ? `${target.visual}\n${value}` : value;
  };

  for (const original of rawLines) {
    let line = original;
    const isFirst = first && line !== '';
    if (line !== '') first = false;
    if (line === '') {
      mode = 'none';
      if (seenAny) newBlock = true;
      continue;
    }
    const tags = line.match(HASHTAG);
    if (tags) {
      for (const raw of tags) {
        const tag = toHashtag(raw);
        if (tag && !hashtags.includes(tag)) hashtags.push(tag);
      }
      line = line.replace(HASHTAG, ' ').replace(/\s{2,}/g, ' ').trim();
      if (line === '') continue;
    }

    const label = line.match(/^(popisek|caption|divák se dozví|zdroj|název|titulek)\s*:\s*(.*)$/i);
    if (label) {
      const [, name, rest] = label as unknown as [string, string, string];
      const key = name.toLowerCase();
      seenAny = true;
      if (key === 'popisek' || key === 'caption') {
        caption = rest ? [rest] : [];
        mode = 'caption';
      } else if (key === 'zdroj') {
        source = rest;
        mode = rest ? 'none' : 'source';
      } else if (key === 'název') {
        if (!title) title = stripQuotes(rest);
      } else if (key === 'titulek') {
        titulek = rest;
      } else {
        viewerLearns = rest;
        mode = rest ? 'none' : 'learns';
      }
      continue;
    }
    if (mode === 'caption') {
      caption.push(line);
      continue;
    }
    if (mode === 'learns' || mode === 'source') {
      if (mode === 'learns') viewerLearns = line;
      else source = line;
      mode = 'none';
      continue;
    }

    const hook = line.match(HOOK);
    if (hook && hooks.length < 3) {
      hooks.push({ id: (['A', 'B', 'C'] as const)[hooks.length]!, hookType: null, text: (hook[1] ?? hook[2] ?? '').trim(), visual: '' });
      mode = 'hook';
      seenAny = true;
      continue;
    }
    if (mode === 'hook' && !SPEAKER.test(line) && !parseHeading(line) && !CUT.test(line)) {
      addVisual(hooks[hooks.length - 1]!, stripBrackets(line));
      continue;
    }
    mode = 'none';

    const numbered = isFirst ? line.match(/^\d+[.)]\s+(.*)$/) : null;
    if (numbered) {
      title = stripQuotes(numbered[1]!.trim());
      seenAny = true;
      continue;
    }

    const cut = line.match(CUT);
    const heading = cut ? null : parseHeading(line);
    if (cut || heading) {
      const target = startScene(heading?.from ?? null, heading?.to ?? null);
      newBlock = false;
      seenAny = true;
      line = cut ? cut[1]! : heading!.rest;
      if (line === '') continue;
      if (!SPEAKER.test(line)) {
        addVisual(target, stripBrackets(line));
        continue;
      }
    } else if (isFirst && !SPEAKER.test(line) && line.length <= 100 && !/[.!?…]$/.test(line) && !/^[[(]/.test(line)) {
      title = line;
      seenAny = true;
      continue;
    }
    seenAny = true;

    const speaker = line.match(SPEAKER);
    const target = current();
    newBlock = false;
    if (!speaker) {
      addVisual(target, stripBrackets(line));
      continue;
    }
    let spoken = speaker[3]!.trim();
    let direction = (speaker[2] ?? '').trim();
    const inline = spoken.match(/^\(([^)]*)\)\s*(.*)$/s);
    if (inline) {
      direction = direction || inline[1]!.trim();
      spoken = inline[2]!;
    }
    const entry: Line = { id: newId(), speaker: capitalise(speaker[1]!.trim()), direction, text: stripQuotes(spoken.trim()) };
    target.lines.push(entry);
    const type = ctaTypeOf(entry.text);
    if (type) ctaLine = { lineId: entry.id, ctaType: type };
  }

  const firstSpoken = scenes.flatMap((s) => s.lines).find((l) => l.text !== '');
  if (hooks.length === 0 && (firstSpoken || titulek)) {
    hooks.push({ id: 'A', hookType: null, text: firstSpoken?.text ?? '', visual: titulek });
  } else if (hooks.length > 0 && titulek && !hooks[0]!.visual) {
    hooks[0]!.visual = titulek;
  }
  if (!title) title = (titulek || firstSpoken?.text || '').slice(0, 80).trim();

  const body: ScriptBody = {
    hooks,
    scenes,
    cta: ctaLine,
    caption: caption.join('\n'),
    hashtags,
    viewerLearns,
    source,
    differsFromLast3: '',
  };
  const warnings = finishBody(body);
  return { body, title, warnings };
}

function stripBrackets(line: string): string {
  const m = line.match(/^[[(]\s*(.*?)\s*[\])]$/);
  return m ? m[1]! : line;
}

/** Profile of the speaker with the most lines among the profiles' speakers; a profile hashtag breaks ties and is a fallback. */
export function suggestProfile(body: ScriptBody, profiles: { key: string; speaker: string | null; hashtag: string | null }[]): string | null {
  const counts = new Map<string, number>();
  for (const line of body.scenes.flatMap((s) => s.lines)) {
    const name = line.speaker.toLocaleLowerCase('cs');
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const tagged = (p: { hashtag: string | null }) => (p.hashtag && body.hashtags.includes(toHashtag(p.hashtag) ?? '') ? 1 : 0);
  const scored = profiles
    .map((p) => ({ key: p.key, lines: p.speaker ? (counts.get(p.speaker.toLocaleLowerCase('cs')) ?? 0) : 0, tag: tagged(p) }))
    .filter((p) => p.lines > 0 || p.tag > 0)
    .sort((a, b) => b.lines - a.lines || b.tag - a.tag);
  return scored[0]?.key ?? null;
}
