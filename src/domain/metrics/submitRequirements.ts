// What a script needs before it goes to review, so it is counted correctly in the cycle mix.

export interface SubmitMeta {
  categoryKey: string | null;
  treatmentKey: string | null;
  cycleId: string | null;
  profileKey: string | null;
  characterKey: string | null;
}

/** Czech accusative names of the missing fields („Před odesláním doplň: kategorii, …“). */
export function missingForSubmit(meta: SubmitMeta, profileIsPersonal: boolean): string[] {
  const missing: string[] = [];
  if (!meta.categoryKey) missing.push('kategorii');
  if (!meta.treatmentKey) missing.push('typ zpracování');
  if (!meta.cycleId) missing.push('cyklus');
  if (!meta.profileKey) missing.push('profil');
  if (meta.profileKey && profileIsPersonal && !meta.characterKey) missing.push('charakter (osobní / pracovní)');
  return missing;
}

export const submitMissingMessage = (missing: string[]) => `Před odesláním doplň: ${missing.join(', ')}.`;
