import { describe, expect, it } from 'vitest';
import {
  addHashtags,
  addNames,
  applyFormat,
  bodyReducer,
  metaPatch,
  moveLine,
  normalizeHashtag,
  speakerSuggestions,
  toggleCta,
} from '@/app/(app)/_components/editor/reducers';
import { emptyScript } from '@/domain/script/template';
import { deepFreeze, fixture } from '../domain/script/fixtures';

const body = () => deepFreeze(fixture());
const lineIds = (b: ReturnType<typeof fixture>, sceneId: string) => b.scenes.find((s) => s.id === sceneId)!.lines.map((l) => l.id);

describe('normalizeHashtag', () => {
  it('adds the hash, lowercases and strips spaces and punctuation', () => {
    expect(normalizeHashtag('VášKonzultant')).toBe('#váškonzultant');
    expect(normalizeHashtag('  #Honza Gizicky ')).toBe('#honzagizicky');
    expect(normalizeHashtag('##hot-take!')).toBe('#hottake');
  });
  it('returns null for nothing usable', () => {
    expect(normalizeHashtag('')).toBeNull();
    expect(normalizeHashtag(' # ')).toBeNull();
    expect(normalizeHashtag('!!')).toBeNull();
  });
});

describe('addHashtags', () => {
  it('splits on spaces and commas, normalises and skips duplicates', () => {
    expect(addHashtags(['#vaskonzultant'], 'Fixace, #fixace hypotéka #VASKONZULTANT')).toEqual([
      '#vaskonzultant',
      '#fixace',
      '#hypotéka',
    ]);
  });
  it('returns the same list for empty input', () => {
    const tags = ['#a'];
    expect(addHashtags(tags, '  , ')).toEqual(['#a']);
  });
});

describe('addNames', () => {
  it('splits on commas only and ignores duplicates in any case', () => {
    expect(addNames(['Radek'], 'Petr (klient), radek, Asistentka Jana')).toEqual(['Radek', 'Petr (klient)', 'Asistentka Jana']);
    expect(addNames(['Radek'], ' , ')).toEqual(['Radek']);
  });
});

describe('toggleCta', () => {
  it('marks a line, moves the call to another line and unmarks the same line', () => {
    const b = body();
    const on = toggleCta(b, 'l1', 'share');
    expect(on.cta).toEqual({ lineId: 'l1', ctaType: 'share' });
    const moved = toggleCta(on, 'l3', 'save');
    // the type chosen so far stays when the call moves
    expect(moved.cta).toEqual({ lineId: 'l3', ctaType: 'share' });
    expect(toggleCta(moved, 'l3', 'save').cta).toBeNull();
  });
  it('does not mutate its input', () => {
    const b = body();
    toggleCta(b, 'l1', 'share');
    expect(b.cta).toEqual(fixture().cta);
  });
});

describe('moveLine', () => {
  it('swaps with the neighbour inside the scene', () => {
    expect(lineIds(moveLine(body(), 'l1', 1), 's1')).toEqual(['l2', 'l1']);
    expect(lineIds(moveLine(body(), 'l2', -1), 's1')).toEqual(['l2', 'l1']);
  });
  it('does nothing at the edges and never crosses scenes', () => {
    const b = body();
    expect(moveLine(b, 'l1', -1)).toEqual(b);
    expect(lineIds(moveLine(b, 'l2', 1), 's1')).toEqual(['l1', 'l2']);
    expect(lineIds(moveLine(b, 'l2', 1), 's2')).toEqual(['l3', 'l4']);
  });
});

describe('bodyReducer', () => {
  it('edits hook, scene, line and simple fields', () => {
    let b = bodyReducer(body(), { type: 'hook', id: 'A', patch: { text: 'Nový', hookType: 'cislo' } });
    expect(b.hooks[0]).toMatchObject({ text: 'Nový', hookType: 'cislo', visual: 'Hook A obraz' });
    b = bodyReducer(b, { type: 'scene', sceneId: 's2', patch: { toSec: 20 } });
    expect(b.scenes[1]).toMatchObject({ fromSec: 11, toSec: 20 });
    b = bodyReducer(b, { type: 'line', lineId: 'l4', patch: { speaker: 'Klient' } });
    expect(b.scenes[1].lines[1].speaker).toBe('Klient');
    b = bodyReducer(b, { type: 'field', key: 'caption', value: 'Titulek' });
    expect(b.caption).toBe('Titulek');
  });

  it('adds hooks B then C, never above three, and removes only B or C', () => {
    let b = bodyReducer(emptyScript(), { type: 'removeHook', id: 'B' });
    expect(b.hooks.map((h) => h.id)).toEqual(['A']);
    b = bodyReducer(b, { type: 'addHook' });
    b = bodyReducer(b, { type: 'addHook' });
    expect(b.hooks.map((h) => h.id)).toEqual(['A', 'B', 'C']);
    expect(bodyReducer(b, { type: 'addHook' }).hooks).toHaveLength(3);
    expect(bodyReducer(b, { type: 'removeHook', id: 'A' }).hooks).toHaveLength(3);
    expect(bodyReducer(b, { type: 'removeHook', id: 'B' }).hooks.map((h) => h.id)).toEqual(['A', 'C']);
  });

  it('adds a scene that starts where the last one ended, and a line with a fresh id', () => {
    let b = bodyReducer(body(), { type: 'addScene' });
    const added = b.scenes.at(-1)!;
    expect(added).toMatchObject({ fromSec: 21, toSec: null, visual: '' });
    expect(added.lines).toHaveLength(1);
    b = bodyReducer(b, { type: 'addLine', sceneId: 's1' });
    expect(b.scenes[0].lines).toHaveLength(3);
    expect(new Set(b.scenes.flatMap((s) => s.lines.map((l) => l.id))).size).toBe(b.scenes.flatMap((s) => s.lines).length);
  });

  it('removing the line or scene that carries the call to action clears it', () => {
    const b = toggleCta(body(), 'l3', 'share');
    expect(bodyReducer(b, { type: 'removeLine', lineId: 'l3' }).cta).toBeNull();
    expect(bodyReducer(b, { type: 'removeLine', lineId: 'l1' }).cta).toEqual(b.cta);
    expect(bodyReducer(b, { type: 'removeScene', sceneId: 's2' }).cta).toBeNull();
    expect(bodyReducer(b, { type: 'removeScene', sceneId: 's1' }).scenes.map((s) => s.id)).toEqual(['s2', 's3']);
  });

  it('moves scenes and changes the call type', () => {
    const b = bodyReducer(body(), { type: 'moveScene', sceneId: 's1', dir: 1 });
    expect(b.scenes.map((s) => s.id)).toEqual(['s2', 's1', 's3']);
    expect(bodyReducer(b, { type: 'moveScene', sceneId: 's2', dir: -1 }).scenes[0].id).toBe('s2');
    const withCta = toggleCta(body(), 'l1', 'share');
    expect(bodyReducer(withCta, { type: 'ctaType', ctaType: 'question' }).cta).toEqual({ lineId: 'l1', ctaType: 'question' });
    expect(bodyReducer(emptyScript(), { type: 'ctaType', ctaType: 'save' }).cta).toBeNull();
  });
});

describe('speakerSuggestions', () => {
  it('lists profile speakers, the client, then speakers already used, without duplicates', () => {
    const b = fixture();
    b.scenes[0].lines[0].speaker = 'Petr (klient)';
    expect(speakerSuggestions(['Radek', 'Honza'], b)).toEqual(['Radek', 'Honza', 'Klient', 'Petr (klient)']);
  });
});

describe('applyFormat', () => {
  const formats = [
    { key: 'a', status: 'verified' as const },
    { key: 'b', status: 'untested' as const },
  ];
  it('suggests Trial Reel for an untested format and leaves it alone for a verified one', () => {
    expect(applyFormat({ formatKey: null, isTrialReel: false }, 'b', formats)).toEqual({ formatKey: 'b', isTrialReel: true });
    expect(applyFormat({ formatKey: 'b', isTrialReel: true }, 'a', formats)).toEqual({ formatKey: 'a', isTrialReel: true });
    expect(applyFormat({ formatKey: 'a', isTrialReel: false }, null, formats)).toEqual({ formatKey: null, isTrialReel: false });
  });
});

describe('metaPatch', () => {
  const saved = {
    title: 'A', categoryKey: null, treatmentKey: null, profileKey: null, characterKey: null, cycleId: null, plannedMonth: null,
    seriesId: null, episodeNo: null, formatKey: null, isTrialReel: false, goalMetric: null, locationKeys: ['x'], cast: [],
    props: '', intent: '', mainIdea: '',
  };
  it('contains only the changed fields (arrays compared by value)', () => {
    expect(metaPatch({ ...saved, title: 'B', locationKeys: ['x'], cast: ['Radek'] }, saved)).toEqual({ title: 'B', cast: ['Radek'] });
    expect(metaPatch(saved, saved)).toEqual({});
  });
  it('leaves out a blank title', () => {
    expect(metaPatch({ ...saved, title: '  ', props: 'p' }, saved)).toEqual({ props: 'p' });
  });
});
