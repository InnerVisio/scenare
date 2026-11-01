export const SERIES_STATUSES = ['draft', 'active', 'in_production', 'publishing', 'done', 'closed', 'paused', 'cancelled'] as const;
export type SeriesStatus = (typeof SERIES_STATUSES)[number];

export const SERIES_STATUS_LABELS: Record<SeriesStatus, string> = {
  draft: 'Návrh',
  active: 'Rozpracovaná',
  in_production: 'Ve výrobě',
  publishing: 'V publikaci',
  done: 'Dokončená',
  closed: 'Uzavřená',
  paused: 'Pozastavená',
  cancelled: 'Zrušená',
};

/** Hidden from the list unless „Zobrazit uzavřené a zrušené“ is on. */
export const isArchivedSeries = (status: string): boolean => status === 'closed' || status === 'cancelled';
