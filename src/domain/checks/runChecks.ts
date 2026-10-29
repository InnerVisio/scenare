import { listFields } from '@/domain/script/fields';
import { durationSec, sceneCount, speakers } from '@/domain/script/metrics';
import type { FieldId, ScriptBody } from '@/domain/script/types';
import type { RuleConfig, Severity } from './rules';

export type { RuleConfig, Severity } from './rules';

export interface CheckContext {
  body: ScriptBody;
  goalMetric: 'shares' | 'saves' | 'comments' | null;
  isSeriesEpisode: boolean;
  formatStatus: 'verified' | 'untested' | null;
  isTrialReel: boolean;
  numberChecks: { status: 'pending' | 'confirmed' }[];
  /** Speaker name → hashtag, e.g. `{ Radek: '#radekteichmann' }`. */
  personHashtags: Record<string, string>;
  /** Rule code → checked. */
  manualChecks: Record<string, boolean>;
}

export interface CheckResult {
  code: string;
  label: string;
  severity: Severity;
  status: 'pass' | 'fail' | 'manual_pending' | 'manual_done' | 'empty';
  detail: string;
}

type Outcome = Pick<CheckResult, 'status' | 'detail'>;

const pass = (detail = ''): Outcome => ({ status: 'pass', detail });
const fail = (detail = ''): Outcome => ({ status: 'fail', detail });
const empty = (detail = ''): Outcome => ({ status: 'empty', detail });

function numParam(rule: RuleConfig, key: string, fallback: number): number {
  const v = rule.params?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

const INTRO_RE = /\b(ahoj|jsme|jmenuji se)\b/i;
const CTA_TYPE_LABEL = { share: 'sdílení', save: 'uložení', question: 'otázka' } as const;
const GOAL_LABEL = { shares: 'sdílení', saves: 'uložení', comments: 'otázka' } as const;
const GOAL_CTA = { shares: 'share', saves: 'save', comments: 'question' } as const;

function checkHook({ body }: CheckContext): Outcome {
  const text = body.hooks.find((h) => h.id === 'A')?.text.trim() ?? '';
  if (!text) return fail('chybí text hooku A');
  if (INTRO_RE.test(text)) return fail('hook se představuje');
  return pass();
}

function checkLength({ body, isSeriesEpisode }: CheckContext, rule: RuleConfig): Outcome {
  const d = durationSec(body);
  if (d === null) return empty();
  const min = isSeriesEpisode ? numParam(rule, 'seriesMin', 20) : numParam(rule, 'min', 12);
  const max = isSeriesEpisode ? numParam(rule, 'seriesMax', 30) : numParam(rule, 'max', 25);
  return d >= min && d <= max ? pass(`${d} s`) : fail(`${d} s`);
}

function checkMaxScenes({ body }: CheckContext, rule: RuleConfig): Outcome {
  const n = sceneCount(body);
  return n <= numParam(rule, 'max', 3) ? pass(String(n)) : fail(String(n));
}

function ctaLineText(body: ScriptBody): string | undefined {
  if (!body.cta) return undefined;
  for (const scene of body.scenes) {
    const line = scene.lines.find((l) => l.id === body.cta!.lineId);
    if (line) return line.text;
  }
  return undefined;
}

function checkCta({ body }: CheckContext): Outcome {
  if (!body.cta) return fail('chybí výzva');
  const text = ctaLineText(body);
  if (text === undefined) return fail('výzva nemá řádek');
  if (!text.trim()) return fail('řádek výzvy je prázdný');
  if (/sleduj/i.test(text)) return fail('výzva „sleduj“');
  return pass();
}

function checkCtaGoal({ body, goalMetric }: CheckContext): Outcome {
  if (!goalMetric || !body.cta) return empty();
  if (GOAL_CTA[goalMetric] === body.cta.ctaType) return pass(CTA_TYPE_LABEL[body.cta.ctaType]);
  return fail(`cíl: ${GOAL_LABEL[goalMetric]}, výzva: ${CTA_TYPE_LABEL[body.cta.ctaType]}`);
}

function czechPlural(n: number): string {
  if (n === 1) return 'nepotvrzené';
  if (n >= 2 && n <= 4) return 'nepotvrzená';
  return 'nepotvrzených';
}

function checkNumbers({ numberChecks }: CheckContext): Outcome {
  const pending = numberChecks.filter((c) => c.status !== 'confirmed').length;
  return pending === 0 ? pass('0') : fail(`${pending} ${czechPlural(pending)}`);
}

function checkValue({ body }: CheckContext): Outcome {
  const missing: string[] = [];
  if (!body.viewerLearns.trim()) missing.push('co se divák dozví');
  if (!body.source.trim()) missing.push('zdroj');
  return missing.length === 0 ? pass() : fail(`chybí: ${missing.join(', ')}`);
}

function checkHashtags({ body, personHashtags }: CheckContext): Outcome {
  const tags = new Set(body.hashtags.map((t) => t.trim().toLowerCase()));
  const problems: string[] = [];
  const count = body.hashtags.length;
  if (count < 3 || count > 5) problems.push(`počet ${count} (má být 3–5)`);
  if (!tags.has('#vaskonzultant')) problems.push('Chybí #vaskonzultant');
  for (const speaker of speakers(body)) {
    const tag = personHashtags[speaker];
    if (tag && !tags.has(tag.trim().toLowerCase())) problems.push(`Chybí ${tag}`);
  }
  return problems.length === 0 ? pass(String(count)) : fail(problems.join('; '));
}

function checkTrialReel({ formatStatus, isTrialReel }: CheckContext): Outcome {
  if (formatStatus === null) return empty();
  if (formatStatus === 'verified') return pass('ověřený formát');
  return isTrialReel ? pass('Trial Reel') : fail('nový formát bez Trial Reelu');
}

const AUTO: Record<string, (ctx: CheckContext, rule: RuleConfig) => Outcome> = {
  HOOK: checkHook,
  LENGTH: checkLength,
  MAX_SCENES: checkMaxScenes,
  CTA: checkCta,
  CTA_GOAL: checkCtaGoal,
  NUMBERS: checkNumbers,
  VALUE: checkValue,
  HASHTAGS: checkHashtags,
  TRIAL_REEL: checkTrialReel,
};

function evaluate(ctx: CheckContext, rule: RuleConfig): Outcome {
  if (rule.mode === 'manual') {
    return { status: ctx.manualChecks[rule.code] === true ? 'manual_done' : 'manual_pending', detail: '' };
  }
  const check = Object.hasOwn(AUTO, rule.code) ? AUTO[rule.code] : undefined;
  return check ? check(ctx, rule) : empty();
}

/** Evaluates enabled rules in the given order. Missing data yields `empty`/`fail`, never a throw. */
export function runChecks(ctx: CheckContext, rules: RuleConfig[]): CheckResult[] {
  return rules
    .filter((r) => r.enabled)
    .map((rule) => ({
      code: rule.code,
      label: rule.label,
      severity: rule.severity,
      ...evaluate(ctx, rule),
    }));
}

const NUMBER_RE = /\d[\d\s.,]*(\s?(%|Kč|tis\.?|mil\.?|let|roků))?/g;

function isScannedField(fieldId: FieldId): boolean {
  return fieldId === 'viewerLearns' || fieldId.startsWith('line:') || /^hook:[^:]+:text$/.test(fieldId);
}

/** Numbers in spoken/visible copy (line texts, hook texts, viewerLearns), offsets within the field text. */
export function detectNumbers(
  body: ScriptBody,
): { fieldId: FieldId; from: number; to: number; text: string }[] {
  const found: { fieldId: FieldId; from: number; to: number; text: string }[] = [];
  for (const field of listFields(body)) {
    if (!isScannedField(field.fieldId)) continue;
    for (const m of field.text.matchAll(NUMBER_RE)) {
      // Without a unit the greedy tail swallows trailing spaces and sentence punctuation.
      const text = m[1] === undefined ? m[0].replace(/[\s.,]+$/, '') : m[0].trimEnd();
      found.push({ fieldId: field.fieldId, from: m.index, to: m.index + text.length, text });
    }
  }
  return found;
}
