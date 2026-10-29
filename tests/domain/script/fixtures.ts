import type { ScriptBody } from '@/domain/script/types';

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as object)) deepFreeze(v);
  }
  return value;
}

export function fixture(): ScriptBody {
  return {
    hooks: [
      { id: 'A', hookType: 'otázka', text: 'Hook A text', visual: 'Hook A obraz' },
      { id: 'B', hookType: null, text: 'Hook B text', visual: 'Hook B obraz' },
    ],
    scenes: [
      {
        id: 's1',
        fromSec: 0,
        toSec: 11,
        visual: 'Scéna 1 obraz',
        lines: [
          { id: 'l1', speaker: 'Radek', direction: 'do kamery', text: 'Řádek 1' },
          { id: 'l2', speaker: 'Honza', direction: '', text: 'Řádek 2' },
        ],
      },
      {
        id: 's2',
        fromSec: 11,
        toSec: 19,
        visual: 'Scéna 2 obraz',
        lines: [
          { id: 'l3', speaker: 'Radek', direction: 'nevzhlédne', text: 'Řádek 3' },
          { id: 'l4', speaker: '', direction: '', text: 'Řádek 4' },
        ],
      },
      {
        id: 's3',
        fromSec: 19,
        toSec: 21,
        visual: 'Scéna 3 obraz',
        lines: [{ id: 'l5', speaker: 'Honza', direction: '', text: 'Řádek 5' }],
      },
    ],
    cta: { lineId: 'l5', ctaType: 'share' },
    caption: 'Titulek text',
    hashtags: ['#a'],
    viewerLearns: 'Divák se dozví',
    source: 'Zdroj text',
    differsFromLast3: 'Liší se',
  };
}
