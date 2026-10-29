export type Severity = 'reject' | 'warn' | 'tip';

export interface RuleConfig {
  code: string;
  label: string;
  severity: Severity;
  mode: 'auto' | 'manual';
  enabled: boolean;
  params?: Record<string, unknown>;
}

export const DEFAULT_RULES: RuleConfig[] = [
  { code: 'HOOK', label: 'Hook do 2 s, bez představování', severity: 'reject', mode: 'auto', enabled: true },
  {
    code: 'LENGTH',
    label: 'Délka 12–25 s (díl série 20–30 s)',
    severity: 'reject',
    mode: 'auto',
    enabled: true,
    params: { min: 12, max: 25, seriesMin: 20, seriesMax: 30 },
  },
  {
    code: 'MAX_SCENES',
    label: 'Max. 3 scény',
    severity: 'reject',
    mode: 'auto',
    enabled: true,
    params: { max: 3 },
  },
  { code: 'CTA', label: 'Jedna výzva ze tří, zazní nahlas', severity: 'reject', mode: 'auto', enabled: true },
  { code: 'CTA_GOAL', label: 'Výzva odpovídá cíli videa', severity: 'warn', mode: 'auto', enabled: true },
  { code: 'NUMBERS', label: 'Žádné nepotvrzené číslo', severity: 'reject', mode: 'auto', enabled: true },
  { code: 'VALUE', label: 'Přidaná hodnota + zdroj', severity: 'reject', mode: 'auto', enabled: true },
  { code: 'LOGICAL_DIALOG', label: 'Logický dialog', severity: 'reject', mode: 'manual', enabled: true },
  {
    code: 'PILLAR',
    label: 'Pointa vede k pilíři, ne k produktu',
    severity: 'reject',
    mode: 'manual',
    enabled: true,
  },
  {
    code: 'HASHTAGS',
    label: '3–5 hashtagů, #vaskonzultant + kdo hraje',
    severity: 'warn',
    mode: 'auto',
    enabled: true,
  },
  { code: 'TRIAL_REEL', label: 'Nový formát → Trial Reel', severity: 'warn', mode: 'auto', enabled: true },
  {
    code: 'GDPR',
    label: 'GDPR: žádná jména klientů, data, obrazovky',
    severity: 'reject',
    mode: 'manual',
    enabled: true,
  },
  {
    code: 'STRONGEST_FIRST',
    label: 'Nejsilnější obraz není schovaný na konci',
    severity: 'tip',
    mode: 'manual',
    enabled: true,
  },
];
