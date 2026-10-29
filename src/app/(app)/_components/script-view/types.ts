import type { Anchor } from '@/domain/anchors/remap';

/** The slice of a comment thread the script view needs (a full `Thread` fits this shape). */
export interface AnchoredThread {
  id: string;
  /** 1-based number shown in the badge. */
  index: number;
  anchor: Anchor | null;
  suggestion: { replacement: string; state: 'pending' | 'accepted' | 'rejected' } | null;
  status: string;
  isDetached: boolean;
}

export type NewAnchor = Omit<Anchor, 'state'>;

export type ScriptViewMode = 'read' | 'diff' | 'dialog';

export interface ScriptMeta {
  code: string;
  versionNo: number;
  title: string;
  /** e.g. "Série S03 · díl 3". */
  seriesLabel?: string;
  categoryTag: { key: string; label: string; colors: { color: string; textColor: string } };
  formatLabel?: string;
  isTrialReel: boolean;
  durationSec: number | null;
  goalLabel?: string;
  profileLabel?: string;
  locationLabels: string[];
  /** e.g. "pošli kolegovi"; shown in the pill „Výzva · …“ above the CTA line. */
  ctaLabel?: string;
}
