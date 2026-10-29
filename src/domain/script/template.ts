import { newId } from '@/domain/ids';
import type { Scene, ScriptBody } from './types';

function emptyScene(fromSec: number | null, toSec: number | null): Scene {
  return {
    id: newId(),
    fromSec,
    toSec,
    visual: '',
    lines: [{ id: newId(), speaker: '', direction: '', text: '' }],
  };
}

export function emptyScript(): ScriptBody {
  return {
    hooks: [
      { id: 'A', hookType: null, text: '', visual: '' },
      { id: 'B', hookType: null, text: '', visual: '' },
    ],
    scenes: [emptyScene(0, 2), emptyScene(2, null), emptyScene(null, null)],
    cta: null,
    caption: '',
    hashtags: ['#vaskonzultant'],
    viewerLearns: '',
    source: '',
    differsFromLast3: '',
  };
}
