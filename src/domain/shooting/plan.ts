// The shooting-day plan: approved scripts grouped by location and cast, hooks to shoot and warnings. Pure.
import { speakers } from '@/domain/script/metrics';
import type { HookId, ScriptBody } from '@/domain/script/types';
import { countsTowardsMix } from '@/domain/metrics/mix';

export interface ShootingVideo {
  id: string;
  code: string;
  title: string;
  locationKeys: string[];
  /** Planned cast from the script's meta, used when the script has no spoken lines yet. */
  cast: string[];
  props: string;
  formatKey: string | null;
  productionStatus: string;
  body: ScriptBody | null;
}

export interface ShootingItem {
  id: string;
  code: string;
  title: string;
  hooks: HookId[];
  speakers: string[];
  props: string;
  formatKey: string | null;
  productionStatus: string;
}

export interface CastGroup {
  label: string;
  items: ShootingItem[];
}

export interface LocationGroup {
  key: string | null;
  label: string;
  count: number;
  castGroups: CastGroup[];
}

export const NO_LOCATION_LABEL = 'Bez lokace';
export const NO_CAST_LABEL = 'Bez obsazení';

/** Hooks that have something to shoot (a text or a visual). */
export function hooksToShoot(body: ScriptBody): HookId[] {
  return body.hooks.filter((h) => h.text.trim() || h.visual.trim()).map((h) => h.id);
}

const byCs = (a: string, b: string) => a.localeCompare(b, 'cs');

/** Location (first one of the script) → cast (speakers of the script, else its planned cast) → scripts by code. */
export function groupForShooting(videos: ShootingVideo[], locationLabels: ReadonlyMap<string, string>): LocationGroup[] {
  const locations = new Map<string | null, Map<string, ShootingItem[]>>();
  for (const v of videos) {
    const key = v.locationKeys[0] ?? null;
    const fromScript = v.body ? speakers(v.body) : [];
    const cast = [...new Set(fromScript.length > 0 ? fromScript : v.cast.filter(Boolean))].sort(byCs);
    const castLabel = cast.length > 0 ? cast.join(' + ') : NO_CAST_LABEL;
    const item: ShootingItem = {
      id: v.id,
      code: v.code,
      title: v.title,
      hooks: v.body ? hooksToShoot(v.body) : [],
      speakers: cast,
      props: v.props,
      formatKey: v.formatKey,
      productionStatus: v.productionStatus,
    };
    const casts = locations.get(key) ?? new Map<string, ShootingItem[]>();
    casts.set(castLabel, [...(casts.get(castLabel) ?? []), item]);
    locations.set(key, casts);
  }
  const labelOf = (key: string | null) => (key === null ? NO_LOCATION_LABEL : (locationLabels.get(key) ?? key));
  return [...locations.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : byCs(labelOf(a), labelOf(b))))
    .map(([key, casts]) => ({
      key,
      label: labelOf(key),
      count: [...casts.values()].reduce((n, items) => n + items.length, 0),
      castGroups: [...casts.entries()]
        .sort(([a], [b]) => byCs(a, b))
        .map(([label, items]) => ({ label, items: items.sort((a, b) => a.code.localeCompare(b.code)) })),
    }));
}

export interface CrewView {
  hooks: { id: HookId; text: string; visual: string }[];
  lines: { speaker: string; direction: string; text: string }[];
}

/** What the crew gets: the hooks and the spoken lines, nothing else (no comments, caption or internal notes). */
export function crewView(body: ScriptBody): CrewView {
  return {
    hooks: body.hooks.filter((h) => h.text.trim() || h.visual.trim()).map((h) => ({ id: h.id, text: h.text, visual: h.visual })),
    lines: body.scenes.flatMap((scene) =>
      scene.lines.filter((l) => l.text.trim()).map((l) => ({ speaker: l.speaker, direction: l.direction, text: l.text })),
    ),
  };
}

function plural(n: number, one: string, few: string, many: string): string {
  return n === 1 ? one : n >= 2 && n <= 4 ? few : many;
}

/** Warnings above the shooting list: unapproved scripts after the deadline and categories short of approved scripts. */
export function shootingWarnings(input: {
  daysToDeadline: number | null;
  statuses: string[];
  missing: { label: string; missing: number }[];
}): string[] {
  const out: string[] = [];
  if (input.daysToDeadline !== null && input.daysToDeadline < 0) {
    const open = input.statuses.filter((s) => countsTowardsMix(s) && s !== 'approved').length;
    if (open > 0) out.push(`Termín schválení už uplynul a ${open} ${plural(open, 'scénář není schválený', 'scénáře nejsou schválené', 'scénářů není schváleno')}.`);
  }
  const short = input.missing.filter((m) => m.missing > 0);
  if (short.length > 0) out.push(`Chybí schválené scénáře: ${short.map((m) => `${m.label} ${m.missing}`).join(', ')}.`);
  return out;
}
