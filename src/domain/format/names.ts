/**
 * Czech accusative of a first name, good enough for "čeká na Radka" / "čeká na Honzu".
 * Unknown shapes fall back to the nominative (never wrong enough to be confusing).
 */
export function toAccusative(name: string): string {
  const n = name.trim();
  if (/^.{2,}a$/iu.test(n)) return `${n.slice(0, -1)}u`; // Honza → Honzu
  if (/ek$/iu.test(n)) return `${n.slice(0, -2)}ka`; // Radek → Radka
  if (/el$/iu.test(n)) return `${n.slice(0, -2)}la`; // Pavel → Pavla
  if (/[bcčdďfghjklmnňpqrřsštťvwxzž]$/iu.test(n)) return `${n}a`; // Petr → Petra, Jan → Jana
  return n;
}

/** "Honzu", "Honzu a Radka", "Honzu, Radka a Petra". */
export function joinAccusative(names: string[]): string {
  const forms = names.map(toAccusative);
  if (forms.length <= 1) return forms.join('');
  return `${forms.slice(0, -1).join(', ')} a ${forms.at(-1)}`;
}
