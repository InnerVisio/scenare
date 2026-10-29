import type { FieldId, FieldRef, Scene, ScriptBody } from './types';

type SimpleKey = 'caption' | 'viewerLearns' | 'source' | 'differsFromLast3';

const SIMPLE_LABELS: Record<SimpleKey, string> = {
  caption: 'Titulek',
  viewerLearns: 'Co se divák dozví',
  source: 'Zdroj',
  differsFromLast3: 'Čím se liší od posledních 3 videí',
};

function isSimpleKey(key: string): key is SimpleKey {
  return Object.hasOwn(SIMPLE_LABELS, key);
}

type Parsed =
  | { kind: 'simple'; key: SimpleKey }
  | { kind: 'hook'; id: string; part: 'text' | 'visual' }
  | { kind: 'scene'; id: string }
  | { kind: 'line'; id: string }
  | null;

function parse(fieldId: FieldId): Parsed {
  if (isSimpleKey(fieldId)) return { kind: 'simple', key: fieldId };
  const parts = fieldId.split(':');
  if (parts.length !== 3) return null;
  const [kind, id, part] = parts;
  if (kind === 'hook' && (part === 'text' || part === 'visual')) return { kind: 'hook', id, part };
  if (kind === 'scene' && part === 'visual') return { kind: 'scene', id };
  if (kind === 'line' && part === 'text') return { kind: 'line', id };
  return null;
}

function findLine(body: ScriptBody, lineId: string) {
  for (let i = 0; i < body.scenes.length; i++) {
    const line = body.scenes[i].lines.find((l) => l.id === lineId);
    if (line) return { sceneIndex: i, line };
  }
  return undefined;
}

export function getFieldText(body: ScriptBody, fieldId: FieldId): string | undefined {
  const p = parse(fieldId);
  if (!p) return undefined;
  switch (p.kind) {
    case 'simple':
      return body[p.key];
    case 'hook':
      return body.hooks.find((h) => h.id === p.id)?.[p.part];
    case 'scene':
      return body.scenes.find((s) => s.id === p.id)?.visual;
    case 'line':
      return findLine(body, p.id)?.line.text;
  }
}

/** Immutable update. Throws if the field does not exist. */
export function setFieldText(body: ScriptBody, fieldId: FieldId, text: string): ScriptBody {
  if (getFieldText(body, fieldId) === undefined) {
    throw new Error(`Unknown field: ${fieldId}`);
  }
  const p = parse(fieldId)!;
  switch (p.kind) {
    case 'simple':
      return { ...body, [p.key]: text };
    case 'hook':
      return {
        ...body,
        hooks: body.hooks.map((h) => (h.id === p.id ? { ...h, [p.part]: text } : h)),
      };
    case 'scene':
      return {
        ...body,
        scenes: body.scenes.map((s) => (s.id === p.id ? { ...s, visual: text } : s)),
      };
    case 'line':
      return {
        ...body,
        scenes: body.scenes.map((s) =>
          s.lines.some((l) => l.id === p.id)
            ? { ...s, lines: s.lines.map((l) => (l.id === p.id ? { ...l, text } : l)) }
            : s,
        ),
      };
  }
}

export function fieldLabel(body: ScriptBody, fieldId: FieldId): string {
  const p = parse(fieldId);
  if (p && getFieldText(body, fieldId) !== undefined) {
    switch (p.kind) {
      case 'simple':
        return SIMPLE_LABELS[p.key];
      case 'hook':
        return `Hook ${p.id} · ${p.part === 'text' ? 'text' : 'obraz'}`;
      case 'scene':
        return `Scéna ${body.scenes.findIndex((s) => s.id === p.id) + 1} · obraz`;
      case 'line': {
        const found = findLine(body, p.id)!;
        return `Scéna ${found.sceneIndex + 1} · ${found.line.speaker || 'replika'}`;
      }
    }
  }
  throw new Error(`Unknown field: ${fieldId}`);
}

function sceneFieldIds(scene: Scene): FieldId[] {
  return [`scene:${scene.id}:visual`, ...scene.lines.map((l) => `line:${l.id}:text`)];
}

/** Reading order: viewerLearns, source, hooks, scenes (visual, lines), caption, differsFromLast3. */
export function listFields(body: ScriptBody): FieldRef[] {
  const ids: FieldId[] = [
    'viewerLearns',
    'source',
    ...body.hooks.flatMap((h) => [`hook:${h.id}:text`, `hook:${h.id}:visual`]),
    ...body.scenes.flatMap(sceneFieldIds),
    'caption',
    'differsFromLast3',
  ];
  return ids.map((fieldId) => ({
    fieldId,
    label: fieldLabel(body, fieldId),
    text: getFieldText(body, fieldId) ?? '',
  }));
}
