import { eq, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import { pragueDay } from '@/domain/format/date';
import {
  buildCycleStatus,
  buildHistory,
  buildMonthCharacters,
  buildScopedMix,
  historyStart,
  monthRange,
  type CharacterRow,
  type CycleStatus,
  type HistoryRow,
  type OverviewMixRow,
  type OverviewVideo,
} from '@/domain/metrics/overview';
import { computeSeriesMetrics, type SeriesMetrics } from '@/domain/series/metrics';
import { allLookups } from './editorOptions';
import { mixItemsFrom } from './mix';

const HISTORY_MONTHS = 24;

export interface OverviewSeriesRow {
  id: string;
  code: string;
  name: string;
  status: string;
  guarantor: string | null;
  metrics: SeriesMetrics;
}

export interface Overview {
  month: string;
  cycleId: string | null;
  today: string;
  monthlyTarget: number;
  tolerancePp: number;
  cycle: { plan: number; shootDate: string | null; approvalDeadline: string | null; clipTarget: string; daysToShoot: number | null; daysToDeadline: number | null } | null;
  categories: { rows: OverviewMixRow[]; total: OverviewMixRow };
  treatments: { rows: OverviewMixRow[]; total: OverviewMixRow };
  characters: CharacterRow[];
  cycleStatus: CycleStatus | null;
  cycleCategories: { rows: OverviewMixRow[]; total: OverviewMixRow } | null;
  series: OverviewSeriesRow[];
  history: HistoryRow[];
  categoryColumns: { key: string; label: string }[];
  treatmentColumns: { key: string; label: string }[];
}

function minusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

/** The whole „Přehled“ page in 4 parallel queries: videos (with comment / publication facts), settings + cycles, lookups, series. */
export async function getOverview(db: Db, input: { month: string; cycleId: string | null }, now: Date): Promise<Overview> {
  const today = pragueDay(now);
  const [videoRows, cycleRows, lookups, seriesRows] = await Promise.all([
    db
      .select({
        id: s.videos.id,
        cycleId: s.videos.cycleId,
        plannedMonth: s.videos.plannedMonth,
        categoryKey: s.videos.categoryKey,
        treatmentKey: s.videos.treatmentKey,
        profileKey: s.videos.profileKey,
        characterKey: s.videos.characterKey,
        approvalStatus: s.videos.approvalStatus,
        productionStatus: s.videos.productionStatus,
        scriptDueDate: s.videos.scriptDueDate,
        seriesId: s.videos.seriesId,
        openComments: sql<number>`(select count(*)::int from ${s.comments} c where c.video_id = videos.id and c.parent_id is null and c.status = 'open')`,
        publishedMonth: sql<string | null>`(select to_char(min(p.published_at) at time zone 'Europe/Prague', 'YYYY-MM') from ${s.publications} p where p.video_id = videos.id)`,
        publications: sql<number>`(select count(*)::int from ${s.publications} p where p.video_id = videos.id)`,
        publicationsWithoutUrl: sql<number>`(select count(*)::int from ${s.publications} p where p.video_id = videos.id and btrim(p.url) = '')`,
      })
      .from(s.videos),
    db
      .select({
        monthlyTarget: s.settings.monthlyTarget,
        tolerancePp: s.settings.tolerancePp,
        approvalDaysBefore: s.settings.approvalDaysBefore,
        cycle: s.shootingCycles,
      })
      .from(s.settings)
      .leftJoin(s.shootingCycles, sql`true`)
      .where(eq(s.settings.id, 'global')),
    allLookups(db),
    db
      .select({ series: s.series, guarantor: s.users.name })
      .from(s.series)
      .leftJoin(s.users, eq(s.users.id, s.series.guarantorId))
      .orderBy(s.series.code),
  ]);

  const monthlyTarget = cycleRows[0]?.monthlyTarget ?? 16;
  const tolerancePp = cycleRows[0]?.tolerancePp ?? 10;
  const daysBefore = cycleRows[0]?.approvalDaysBefore ?? 7;
  const cycles = cycleRows.flatMap((r) => (r.cycle ? [r.cycle] : []));
  const deadlineOf = new Map(cycles.map((c) => [c.id, c.shootDate ? minusDays(c.shootDate, daysBefore) : null]));

  const videos: OverviewVideo[] = videoRows.map((v) => ({ ...v, approvalDeadline: v.cycleId ? (deadlineOf.get(v.cycleId) ?? null) : null }));
  const { categories, treatments, characters, profiles } = mixItemsFrom(lookups);
  const month = { kind: 'month' as const, month: input.month };

  // Same default as the top bar: the cycle asked for, else the next shoot, else the latest cycle.
  const sorted = [...cycles].sort((a, b) => (a.shootDate ?? '9999').localeCompare(b.shootDate ?? '9999') || a.id.localeCompare(b.id));
  const fallback = sorted.find((c) => c.shootDate !== null && c.shootDate >= today) ?? [...cycles].sort((a, b) => b.id.localeCompare(a.id))[0] ?? null;
  const selected = cycles.find((c) => c.id === input.cycleId) ?? fallback;
  const plan = selected?.plannedVideos || monthlyTarget;
  const approvalDeadline = selected ? (deadlineOf.get(selected.id) ?? null) : null;

  const seriesOut: OverviewSeriesRow[] = seriesRows
    .filter(({ series }) => series.status !== 'closed' && series.status !== 'cancelled')
    .map(({ series, guarantor }) => ({
      id: series.id,
      code: series.code,
      name: series.name,
      status: series.status,
      guarantor,
      metrics: computeSeriesMetrics(series, videoRows.filter((v) => v.seriesId === series.id).map((v) => ({ ...v, openRootComments: v.openComments }))),
    }));

  const start = historyStart(videos, input.month);
  return {
    month: input.month,
    cycleId: selected?.id ?? null,
    today,
    monthlyTarget,
    tolerancePp,
    cycle: selected
      ? {
          plan,
          shootDate: selected.shootDate,
          approvalDeadline,
          clipTarget: selected.clipTarget,
          daysToShoot: selected.shootDate ? daysBetween(today, selected.shootDate) : null,
          daysToDeadline: approvalDeadline ? daysBetween(today, approvalDeadline) : null,
        }
      : null,
    categories: buildScopedMix(videos, categories, monthlyTarget, 'category', month),
    treatments: buildScopedMix(videos, treatments, monthlyTarget, 'treatment', month),
    characters: buildMonthCharacters(
      videos,
      input.month,
      profiles.filter((p) => p.personal),
      characters.filter((c): c is { key: string; label: string; share: number } => c.share !== null),
      tolerancePp,
    ),
    cycleStatus: selected ? buildCycleStatus(videos, selected.id, plan, today) : null,
    cycleCategories: selected ? buildScopedMix(videos, categories, plan, 'category', { kind: 'cycle', cycleId: selected.id }) : null,
    series: seriesOut,
    history: buildHistory(videos, monthRange(start < input.month ? start : input.month, HISTORY_MONTHS), monthlyTarget, categories, treatments),
    categoryColumns: categories.map((c) => ({ key: c.key, label: c.label })),
    treatmentColumns: treatments.map((t) => ({ key: t.key, label: t.label })),
  };
}
