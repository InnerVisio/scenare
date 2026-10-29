export const PRODUCTION_STATUSES = [
  'waiting',
  'shot',
  'editing',
  'edited',
  'published',
  'not_shot',
] as const;

export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export const PRODUCTION_STATUS_LABELS: Record<ProductionStatus, string> = {
  waiting: 'Čeká na natáčení',
  shot: 'Natočeno',
  editing: 'Ve střihu',
  edited: 'Sestříháno',
  published: 'Publikováno',
  not_shot: 'Nenatočeno',
};
