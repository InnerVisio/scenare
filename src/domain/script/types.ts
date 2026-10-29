export type HookId = 'A' | 'B' | 'C';

export interface Hook {
  id: HookId;
  hookType: string | null;
  text: string;
  visual: string;
}

/** `direction` is a short acting note, e.g. "nevzhlédne", "do kamery". */
export interface Line {
  id: string;
  speaker: string;
  direction: string;
  text: string;
}

export interface Scene {
  id: string;
  fromSec: number | null;
  toSec: number | null;
  visual: string;
  lines: Line[];
}

export interface Cta {
  lineId: string;
  ctaType: 'share' | 'save' | 'question';
}

export interface ScriptBody {
  hooks: Hook[];
  scenes: Scene[];
  cta: Cta | null;
  caption: string;
  hashtags: string[];
  viewerLearns: string;
  source: string;
  differsFromLast3: string;
}

/**
 * 'hook:A:text' | 'hook:A:visual' | 'scene:<id>:visual' | 'line:<id>:text'
 * | 'caption' | 'viewerLearns' | 'source' | 'differsFromLast3'
 */
export type FieldId = string;

export interface FieldRef {
  fieldId: FieldId;
  label: string;
  text: string;
}
