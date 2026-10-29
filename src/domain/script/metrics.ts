import type { ScriptBody } from './types';

/** Max `toSec` over scenes; null if no scene has one. */
export function durationSec(body: ScriptBody): number | null {
  const ends = body.scenes.map((s) => s.toSec).filter((t): t is number => t !== null);
  return ends.length ? Math.max(...ends) : null;
}

export function sceneCount(body: ScriptBody): number {
  return body.scenes.length;
}

/** Unique non-empty speakers in order of appearance. */
export function speakers(body: ScriptBody): string[] {
  const seen = new Set<string>();
  for (const scene of body.scenes) {
    for (const line of scene.lines) {
      if (line.speaker) seen.add(line.speaker);
    }
  }
  return [...seen];
}
