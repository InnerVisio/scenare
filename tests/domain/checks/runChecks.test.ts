import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '@/domain/checks/rules';
import { detectNumbers, runChecks, type CheckResult } from '@/domain/checks/runChecks';
import { setFieldText } from '@/domain/script/fields';
import { emptyScript } from '@/domain/script/template';
import type { ScriptBody } from '@/domain/script/types';
import { deepFreeze } from '../script/fixtures';
import { v031Body, v031Context } from './fixtures';

function result(code: string, results: CheckResult[]): CheckResult {
  const r = results.find((x) => x.code === code);
  if (!r) throw new Error(`no result for ${code}`);
  return r;
}

function run(code: string, ctx = v031Context()): CheckResult {
  return result(code, runChecks(ctx, DEFAULT_RULES));
}

function withBody(edit: (b: ScriptBody) => void) {
  const body = v031Body();
  edit(body);
  return v031Context({ body });
}

describe('DEFAULT_RULES', () => {
  it('has the 13 rules in the specified order, all enabled', () => {
    expect(DEFAULT_RULES.map((r) => r.code)).toEqual([
      'HOOK', 'LENGTH', 'MAX_SCENES', 'CTA', 'CTA_GOAL', 'NUMBERS', 'VALUE',
      'LOGICAL_DIALOG', 'PILLAR', 'HASHTAGS', 'TRIAL_REEL', 'GDPR', 'STRONGEST_FIRST',
    ]);
    expect(DEFAULT_RULES.every((r) => r.enabled)).toBe(true);
  });
  it('has the specified labels, severities and modes', () => {
    const by = Object.fromEntries(DEFAULT_RULES.map((r) => [r.code, r]));
    expect(by.HOOK).toMatchObject({ label: 'Hook do 2 s, bez představování', severity: 'reject', mode: 'auto' });
    expect(by.LENGTH).toMatchObject({
      label: 'Délka 12–25 s (díl série 20–30 s)',
      severity: 'reject',
      params: { min: 12, max: 25, seriesMin: 20, seriesMax: 30 },
    });
    expect(by.MAX_SCENES).toMatchObject({ severity: 'reject', params: { max: 3 } });
    expect(by.CTA_GOAL.severity).toBe('warn');
    expect(by.HASHTAGS.severity).toBe('warn');
    expect(by.TRIAL_REEL.severity).toBe('warn');
    expect(by.STRONGEST_FIRST).toMatchObject({ severity: 'tip', mode: 'manual' });
    for (const code of ['LOGICAL_DIALOG', 'PILLAR', 'GDPR']) {
      expect(by[code]).toMatchObject({ severity: 'reject', mode: 'manual' });
    }
  });
});

describe('runChecks - passing V031 fixture', () => {
  it('passes every auto rule', () => {
    const results = runChecks(v031Context(), DEFAULT_RULES);
    const auto = DEFAULT_RULES.filter((r) => r.mode === 'auto').map((r) => r.code);
    for (const code of auto) expect(result(code, results).status, code).toBe('pass');
  });
  it('shows details', () => {
    const results = runChecks(v031Context(), DEFAULT_RULES);
    expect(result('LENGTH', results).detail).toBe('21 s');
    expect(result('MAX_SCENES', results).detail).toBe('3');
    expect(result('CTA_GOAL', results).detail).toBe('sdílení');
    expect(result('NUMBERS', results).detail).toBe('0');
  });
  it('returns manual rules as manual_pending, manual_done when checked', () => {
    expect(run('GDPR').status).toBe('manual_pending');
    expect(run('GDPR', v031Context({ manualChecks: { GDPR: true } })).status).toBe('manual_done');
    expect(run('GDPR', v031Context({ manualChecks: { GDPR: false } })).status).toBe('manual_pending');
  });
  it('carries code, label and severity from the rule', () => {
    const r = run('HOOK');
    expect(r).toMatchObject({ code: 'HOOK', label: 'Hook do 2 s, bez představování', severity: 'reject' });
  });
  it('only returns enabled rules, in rules order', () => {
    const rules = [
      { ...DEFAULT_RULES[2] },
      { ...DEFAULT_RULES[0], enabled: false },
      { ...DEFAULT_RULES[1] },
    ];
    expect(runChecks(v031Context(), rules).map((r) => r.code)).toEqual(['MAX_SCENES', 'LENGTH']);
  });
  it('does not mutate its inputs', () => {
    const ctx = deepFreeze(v031Context());
    expect(() => runChecks(ctx, deepFreeze(DEFAULT_RULES.map((r) => ({ ...r }))))).not.toThrow();
  });
});

describe('HOOK', () => {
  it('fails when hook A is empty', () => {
    expect(run('HOOK', withBody((b) => (b.hooks[0].text = ''))).status).toBe('fail');
  });
  it('fails when hook A is missing', () => {
    expect(run('HOOK', withBody((b) => (b.hooks = b.hooks.filter((h) => h.id !== 'A')))).status).toBe('fail');
  });
  it.each(['Ahoj, tady Radek.', 'My jsme poradci.', 'Jmenuji se Radek a radím.'])(
    'fails on introduction: %s',
    (text) => {
      expect(run('HOOK', withBody((b) => (b.hooks[0].text = text))).status).toBe('fail');
    },
  );
});

describe('LENGTH', () => {
  it('fails when too short', () => {
    const ctx = withBody((b) => b.scenes.forEach((s) => (s.toSec = 8)));
    const r = run('LENGTH', ctx);
    expect(r.status).toBe('fail');
    expect(r.detail).toBe('8 s');
  });
  it('fails when too long', () => {
    expect(run('LENGTH', withBody((b) => (b.scenes[2].toSec = 26))).status).toBe('fail');
  });
  it('accepts 12 and 25 s inclusive', () => {
    expect(run('LENGTH', withBody((b) => (b.scenes[2].toSec = 12))).status).toBe('pass');
    expect(run('LENGTH', withBody((b) => (b.scenes[2].toSec = 25))).status).toBe('pass');
  });
  it('uses 20–30 s for series episodes', () => {
    const ctx = v031Context({ isSeriesEpisode: true });
    expect(run('LENGTH', ctx).status).toBe('pass');
    const longer = withBody((b) => (b.scenes[2].toSec = 28));
    expect(run('LENGTH', { ...longer, isSeriesEpisode: true }).status).toBe('pass');
    expect(run('LENGTH', withBody((b) => (b.scenes[2].toSec = 19))).status).toBe('pass');
    expect(run('LENGTH', { ...withBody((b) => (b.scenes[2].toSec = 19)), isSeriesEpisode: true }).status).toBe('fail');
  });
  it('is empty when duration is unknown', () => {
    const r = run('LENGTH', withBody((b) => b.scenes.forEach((s) => (s.toSec = null))));
    expect(r.status).toBe('empty');
  });
});

describe('MAX_SCENES', () => {
  it('fails with 4 scenes', () => {
    const ctx = withBody((b) => b.scenes.push({ ...b.scenes[2], id: 's4' }));
    const r = run('MAX_SCENES', ctx);
    expect(r.status).toBe('fail');
    expect(r.detail).toBe('4');
  });
});

describe('CTA', () => {
  it('fails without a cta', () => {
    expect(run('CTA', withBody((b) => (b.cta = null))).status).toBe('fail');
  });
  it('fails when the cta line does not exist', () => {
    expect(run('CTA', withBody((b) => (b.cta = { lineId: 'nope', ctaType: 'share' }))).status).toBe('fail');
  });
  it('fails when the cta line is empty', () => {
    expect(run('CTA', withBody((b) => (b.scenes[2].lines[1].text = '  '))).status).toBe('fail');
  });
  it('fails when the cta says "sleduj"', () => {
    expect(run('CTA', withBody((b) => (b.scenes[2].lines[1].text = 'Sleduj nás pro víc.'))).status).toBe('fail');
  });
});

describe('CTA_GOAL', () => {
  it.each([
    ['shares', 'share', 'pass'],
    ['saves', 'save', 'pass'],
    ['comments', 'question', 'pass'],
    ['shares', 'save', 'fail'],
    ['saves', 'question', 'fail'],
    ['comments', 'share', 'fail'],
  ] as const)('goal %s with cta %s is %s', (goalMetric, ctaType, status) => {
    const ctx = withBody((b) => (b.cta = { lineId: 'l6', ctaType }));
    expect(run('CTA_GOAL', { ...ctx, goalMetric }).status).toBe(status);
  });
  it('is empty when goal is null', () => {
    expect(run('CTA_GOAL', v031Context({ goalMetric: null })).status).toBe('empty');
  });
  it('is empty when cta is null', () => {
    expect(run('CTA_GOAL', withBody((b) => (b.cta = null))).status).toBe('empty');
  });
});

describe('NUMBERS', () => {
  it('fails with pending checks and reports the count', () => {
    const ctx = v031Context({ numberChecks: [{ status: 'pending' }, { status: 'confirmed' }, { status: 'pending' }] });
    const r = run('NUMBERS', ctx);
    expect(r.status).toBe('fail');
    expect(r.detail).toBe('2 nepotvrzená');
  });
  it('passes when all are confirmed', () => {
    expect(run('NUMBERS', v031Context({ numberChecks: [{ status: 'confirmed' }] })).status).toBe('pass');
  });
});

describe('VALUE', () => {
  it('fails without viewerLearns', () => {
    expect(run('VALUE', withBody((b) => (b.viewerLearns = ''))).status).toBe('fail');
  });
  it('fails without source', () => {
    expect(run('VALUE', withBody((b) => (b.source = '   '))).status).toBe('fail');
  });
});

describe('HASHTAGS', () => {
  it('fails with fewer than 3', () => {
    expect(run('HASHTAGS', withBody((b) => (b.hashtags = ['#vaskonzultant', '#radekteichmann']))).status).toBe('fail');
  });
  it('fails with more than 5', () => {
    const ctx = withBody((b) => (b.hashtags = [...b.hashtags, '#a', '#b']));
    expect(run('HASHTAGS', ctx).status).toBe('fail');
  });
  it('fails without #vaskonzultant and says so', () => {
    const ctx = withBody((b) => (b.hashtags = ['#radekteichmann', '#honzagizicky', '#hypoteka']));
    const r = run('HASHTAGS', ctx);
    expect(r.status).toBe('fail');
    expect(r.detail).toContain('#vaskonzultant');
  });
  it('fails when a speaker hashtag is missing and names it', () => {
    const ctx = withBody((b) => (b.hashtags = ['#vaskonzultant', '#honzagizicky', '#hypoteka']));
    const r = run('HASHTAGS', ctx);
    expect(r.status).toBe('fail');
    expect(r.detail).toContain('Chybí #radekteichmann');
  });
  it('compares case-insensitively', () => {
    const ctx = withBody((b) => (b.hashtags = ['#VaSkonzultant', '#RadekTeichmann', '#honzagizicky']));
    expect(run('HASHTAGS', ctx).status).toBe('pass');
  });
  it('ignores speakers without a configured hashtag (Klient)', () => {
    expect(run('HASHTAGS').status).toBe('pass');
  });
  it('ignores configured people who do not speak', () => {
    const ctx = v031Context({ personHashtags: { Radek: '#radekteichmann', Honza: '#honzagizicky', Jarda: '#jarda' } });
    expect(run('HASHTAGS', ctx).status).toBe('pass');
  });
});

describe('TRIAL_REEL', () => {
  it('passes for a verified format', () => {
    expect(run('TRIAL_REEL', v031Context({ formatStatus: 'verified' })).status).toBe('pass');
  });
  it('passes for an untested format posted as Trial Reel', () => {
    expect(run('TRIAL_REEL', v031Context({ formatStatus: 'untested', isTrialReel: true })).status).toBe('pass');
  });
  it('fails for an untested format that is not a Trial Reel', () => {
    expect(run('TRIAL_REEL', v031Context({ formatStatus: 'untested', isTrialReel: false })).status).toBe('fail');
  });
  it('is empty when the format is unknown', () => {
    expect(run('TRIAL_REEL', v031Context({ formatStatus: null })).status).toBe('empty');
  });
});

describe('empty / partial script (Review Focus 4)', () => {
  it('does not throw on emptyScript and reports empty/fail', () => {
    const ctx = v031Context({
      body: emptyScript(),
      goalMetric: null,
      formatStatus: null,
      personHashtags: {},
    });
    const results = runChecks(ctx, DEFAULT_RULES);
    expect(results).toHaveLength(DEFAULT_RULES.length);
    expect(result('HOOK', results).status).toBe('fail');
    expect(result('LENGTH', results).status).toBe('fail'); // 2 s
    expect(result('CTA', results).status).toBe('fail');
    expect(result('CTA_GOAL', results).status).toBe('empty');
    expect(result('VALUE', results).status).toBe('fail');
    expect(result('TRIAL_REEL', results).status).toBe('empty');
    expect(result('NUMBERS', results).status).toBe('pass');
    for (const r of results) {
      expect(['pass', 'fail', 'manual_pending', 'manual_done', 'empty']).toContain(r.status);
    }
  });
  it('reports LENGTH empty when no scene has an end time', () => {
    const body = emptyScript();
    body.scenes = body.scenes.map((s) => ({ ...s, toSec: null }));
    expect(run('LENGTH', v031Context({ body })).status).toBe('empty');
  });
  it('does not throw with no scenes or hooks', () => {
    const body = emptyScript();
    body.scenes = [];
    body.hooks = [];
    expect(() => runChecks(v031Context({ body }), DEFAULT_RULES)).not.toThrow();
  });
});

describe('detectNumbers', () => {
  it('finds "15 let" and "2,5 %" with offsets inside the field text', () => {
    let body = setFieldText(v031Body(), 'line:l1:text', 'Mám hypotéku už 15 let a úrok 2,5 % mi nevadí.');
    const found = detectNumbers(body);
    const l1 = found.filter((n) => n.fieldId === 'line:l1:text');
    expect(l1.map((n) => n.text)).toEqual(['15 let', '2,5 %']);
    const text = 'Mám hypotéku už 15 let a úrok 2,5 % mi nevadí.';
    for (const n of l1) expect(text.slice(n.from, n.to)).toBe(n.text);
    body = setFieldText(body, 'line:l1:text', 'bez čísel');
    expect(detectNumbers(body).filter((n) => n.fieldId === 'line:l1:text')).toEqual([]);
  });
  it('trims trailing spaces and sentence punctuation', () => {
    const body = setFieldText(v031Body(), 'line:l1:text', 'Stojí to 4 500 Kč, fakt.');
    expect(detectNumbers(body).map((n) => n.text)).toEqual(['4 500 Kč']);
    const b2 = setFieldText(v031Body(), 'line:l1:text', 'Rok 2024 a pak 5 ');
    expect(detectNumbers(b2).map((n) => n.text)).toEqual(['2024', '5']);
  });
  it('scans lines, hooks and viewerLearns but not captions, sources or visuals', () => {
    let body = v031Body();
    body = setFieldText(body, 'hook:A:text', 'Ušetři 100 tis. Kč');
    body = setFieldText(body, 'viewerLearns', 'Za 3 roky');
    body = setFieldText(body, 'caption', 'Titulek 999');
    body = setFieldText(body, 'source', 'Zdroj 888');
    body = setFieldText(body, 'scene:s1:visual', 'Obraz 777');
    body = setFieldText(body, 'hook:A:visual', 'Obraz 666');
    const fields = detectNumbers(body).map((n) => n.fieldId);
    expect(fields).toContain('hook:A:text');
    expect(fields).toContain('viewerLearns');
    expect(fields).not.toContain('caption');
    expect(fields).not.toContain('source');
    expect(fields).not.toContain('scene:s1:visual');
    expect(fields).not.toContain('hook:A:visual');
  });
  it('returns results in reading order', () => {
    let body = v031Body();
    body = setFieldText(body, 'line:l3:text', 'Třeba 5 let');
    body = setFieldText(body, 'viewerLearns', 'Za 3 roky');
    body = setFieldText(body, 'hook:A:text', 'Jen 10 %');
    expect(detectNumbers(body).map((n) => n.fieldId)).toEqual(['viewerLearns', 'hook:A:text', 'line:l3:text']);
  });
  it('returns [] for an empty script', () => {
    expect(detectNumbers(emptyScript())).toEqual([]);
  });
});
