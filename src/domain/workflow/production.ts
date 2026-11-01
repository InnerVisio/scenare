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

/** Czech validation message when moving a script to production status `to`, otherwise null. */
export function checkProductionChange(input: { code: string; to: string; approvalStatus: string; publications: number }): string | null {
  const { code, to } = input;
  if (!(PRODUCTION_STATUSES as readonly string[]).includes(to)) return 'Neznámý stav výroby.';
  if (to !== 'waiting' && input.approvalStatus !== 'approved') {
    return `${code} není schválený, výrobu lze měnit jen u schválených scénářů.`;
  }
  if (to === 'published' && input.publications === 0) return `${code}: stav Publikováno vyžaduje alespoň jednu publikaci.`;
  return null;
}
