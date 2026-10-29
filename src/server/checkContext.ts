import { and, asc, eq } from 'drizzle-orm';
import * as s from '@/db/schema';
import { DEFAULT_RULES, type RuleConfig, type Severity } from '@/domain/checks/rules';
import type { CheckContext } from '@/domain/checks/runChecks';
import type { Executor, VersionRow, VideoRow } from './loaders';

const SEVERITIES: readonly Severity[] = ['reject', 'warn', 'tip'];

async function lookups(tx: Executor, kind: string) {
  return tx
    .select()
    .from(s.lookupItems)
    .where(and(eq(s.lookupItems.kind, kind), eq(s.lookupItems.archived, false)))
    .orderBy(asc(s.lookupItems.sortOrder), asc(s.lookupItems.key));
}

/** Configured `check_rule` lookups, or `DEFAULT_RULES` if none exist. */
export async function loadRules(tx: Executor): Promise<RuleConfig[]> {
  const rows = await lookups(tx, 'check_rule');
  if (rows.length === 0) return DEFAULT_RULES;
  return rows.map((row) => {
    const d = row.data;
    const severity = SEVERITIES.find((v) => v === d.severity) ?? 'warn';
    const params = d.params && typeof d.params === 'object' ? (d.params as Record<string, unknown>) : undefined;
    return {
      code: row.key,
      label: row.label,
      severity,
      mode: d.mode === 'manual' ? 'manual' : 'auto',
      enabled: d.enabled !== false,
      ...(params ? { params } : {}),
    };
  });
}

/** Everything `runChecks` needs for one version of a video. */
export async function buildCheckContext(
  tx: Executor,
  video: VideoRow,
  version: Pick<VersionRow, 'id' | 'body'>,
): Promise<CheckContext> {
  let formatStatus: CheckContext['formatStatus'] = null;
  if (video.formatKey) {
    const [format] = await tx
      .select()
      .from(s.lookupItems)
      .where(and(eq(s.lookupItems.kind, 'format'), eq(s.lookupItems.key, video.formatKey)));
    formatStatus = format?.data.status === 'verified' ? 'verified' : 'untested';
  }

  const personHashtags: Record<string, string> = {};
  for (const profile of await lookups(tx, 'profile')) {
    const { speaker, hashtag } = profile.data;
    if (typeof speaker === 'string' && speaker && typeof hashtag === 'string' && hashtag) {
      personHashtags[speaker] = hashtag;
    }
  }

  const numberChecks = await tx
    .select({ status: s.numberChecks.status })
    .from(s.numberChecks)
    .where(eq(s.numberChecks.videoId, video.id));

  return {
    body: version.body,
    goalMetric: video.goalMetric,
    isSeriesEpisode: video.seriesId != null,
    formatStatus,
    isTrialReel: video.isTrialReel,
    numberChecks,
    personHashtags,
    manualChecks: video.manualChecks?.[version.id] ?? {},
  };
}
