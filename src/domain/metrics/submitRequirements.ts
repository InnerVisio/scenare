// What a script needs before it goes to review, so it is counted correctly in the cycle mix.

export interface SubmitMeta {
  categoryKey: string | null;
  cycleId: string | null;
}

/** Czech accusative names of the missing fields („Před odesláním doplň: kategorii, …“). */
export function missingForSubmit(meta: SubmitMeta): string[] {
  const missing: string[] = [];
  if (!meta.categoryKey) missing.push('kategorii');
  if (!meta.cycleId) missing.push('natáčecí den');
  return missing;
}

export const submitMissingMessage = (missing: string[]) => `Před odesláním doplň: ${missing.join(', ')}.`;
