export interface SeriesFacts {
  plannedEpisodes: number | null;
  originalPlannedEpisodes: number | null;
  scopeChangeReason: string;
  status: string;
  closedBy: string | null;
  closedAt: Date | null;
}

/** One episode (video of the series) with the counts the series checks need. */
export interface EpisodeFacts {
  approvalStatus: string;
  productionStatus: string;
  /** Open comments that start a thread (replies are not counted). */
  openRootComments: number;
  publications: number;
  publicationsWithoutUrl: number;
}

export interface SeriesMetrics {
  planned: number;
  withScript: number;
  approved: number;
  shot: number;
  published: number;
  fulfilmentPct: number;
  remaining: number;
  openComments: number;
  publicationsWithoutUrl: number;
  canClose: boolean;
  /** Why the series cannot be closed yet (empty when it can). */
  reasons: string[];
  /** Consistency warnings (§ 8.2). */
  checks: string[];
}

const SHOT = new Set(['shot', 'editing', 'edited', 'published']);

export function computeSeriesMetrics(series: SeriesFacts, episodes: readonly EpisodeFacts[]): SeriesMetrics {
  const scripted = episodes.filter((e) => e.approvalStatus !== 'cancelled');
  const planned = series.plannedEpisodes ?? 0;
  const published = scripted.filter((e) => e.publications > 0).length;
  const openComments = scripted.reduce((n, e) => n + e.openRootComments, 0);
  const publicationsWithoutUrl = scripted.reduce((n, e) => n + e.publicationsWithoutUrl, 0);

  const reasons: string[] = [];
  if (series.plannedEpisodes == null) reasons.push('Není zadaný plán dílů.');
  else if (published < planned) reasons.push(`Publikováno ${published} z ${planned}.`);
  if (openComments > 0) reasons.push(`Otevřené připomínky: ${openComments}.`);
  if (publicationsWithoutUrl > 0) reasons.push(`Publikace bez odkazu: ${publicationsWithoutUrl}.`);
  const canClose = reasons.length === 0;

  const checks: string[] = [];
  if (series.status === 'closed') {
    if (!series.closedBy || !series.closedAt) checks.push('Uzavřeno bez potvrzení, kdo a kdy.');
    if (!canClose) checks.push('Uzavřeno bez splněných podmínek.');
  }
  if (series.plannedEpisodes !== series.originalPlannedEpisodes && !series.scopeChangeReason.trim()) {
    checks.push('Rozsah změněn bez uvedeného důvodu.');
  }
  if (series.plannedEpisodes != null && scripted.length > series.plannedEpisodes) {
    checks.push(`Víc dílů (${scripted.length}) než plán (${series.plannedEpisodes}).`);
  }

  return {
    planned,
    withScript: scripted.length,
    approved: scripted.filter((e) => e.approvalStatus === 'approved').length,
    shot: scripted.filter((e) => SHOT.has(e.productionStatus)).length,
    published,
    fulfilmentPct: planned > 0 ? Math.round((published / planned) * 100) : 0,
    remaining: Math.max(0, planned - published),
    openComments,
    publicationsWithoutUrl,
    canClose,
    reasons,
    checks,
  };
}
