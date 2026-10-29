# Fáze 1 — Kontrola scénářů · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Working MVP where Admin writes structured scripts, sends them for review, and Honza + Radek comment on exact text, suggest changes, return or approve (both required) on desktop and 390 px mobile, with versions, diff and a full activity log.

**Architecture:** Pure domain logic in `src/domain/` (no DB, no framework, 100 % unit-tested) → use cases in `src/server/` (permission check → DB transaction → activity log → notifications) → Next.js App Router pages + server actions in `src/app/` that call only `src/server/`. Postgres via Drizzle; PGlite (in-process Postgres) for dev and tests, real Postgres via `DATABASE_URL` in production.

**Tech Stack:** Node 22, Next.js 15.5 (App Router, React 19), TypeScript strict, Tailwind CSS 4, lucide-react, Drizzle ORM 0.45 + drizzle-kit, @electric-sql/pglite, postgres (postgres-js) for prod, jose (session JWT), diff (word diff), diff-match-patch (fuzzy anchor match), zod (input validation), Vitest 5, Playwright (preinstalled — do NOT run `playwright install`; use `executablePath: '/opt/pw-browsers/chromium'` only if the bundled one is not found).

**Spec:** `docs/superpowers/specs/2026-10-29-gta-scenare-design.md` (read § 2–5, § 7). Design mockups: `docs/design/00-design-system.png`, `01-dashboard-desktop.png`, `02-review-queue-desktop.png`, `03-review-queue-mobile.png`. Client rules: `docs/HANDOFF-vas-konzultant.md` § 4–7.

## Global Constraints

- All UI copy, error messages, empty states and emails in **Czech**. Code, identifiers, commit messages in **English**.
- Dates displayed `29. 10. 2026` (use `Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague' })`), time zone `Europe/Prague`.
- Every function that depends on "now" takes `now: Date` as a parameter; never call `new Date()` inside `src/domain/`.
- Permissions enforced in `src/server/` via `can()` from `src/domain/policy`; UI hiding is cosmetic only.
- Domain status keys are English; Czech labels come from one map (`APPROVAL_STATUS_LABELS` etc.).
- Approval policy default: `all_leadership` (Honza AND Radek). Admin never counts as an approver and cannot approve/return.
- Checks never technically block approval; approving over warnings is allowed and logged (`overrodeWarnings: true`).
- A comment is never deleted or lost by versioning; unmatched anchors become `detached`.
- Design tokens (exact): levandule `#E7E5F3` (app bg), inkoust `#17151F` (text, nav), limetka `#D9F36A` (approve / primary CTA — max one lime button per screen), fialka `#5B4FD6` (selection, links, anchors), karta `#FFFFFF`, vnoření `#F4F3FA`, text2 `#5B5870`, korál `#FF5C8A`, meruňka `#FFB45C`, inkoust2 `#2E2B3D`. Font Plus Jakarta Sans (next/font/google). Radii 28 / 18 / 999 px. Display 48/600, H1 30/600, H2 20/600, script text 17/400 line-height 1.6, label 12/600 uppercase. Touch targets ≥ 48 px. Responsive from 360 px.
- Colors defined as CSS variables (Tailwind 4 `@theme`) so dark mode can be added later; no dark mode now.
- Before every commit: `npm run lint && npm run typecheck && npm test` green.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01EoMYMPcTkZ6BFq393tRQib
  ```

## Review Focus

1. **Suggestion against stale text** — the line was edited after the suggestion was made: accepting must re-locate the quote (remap) or refuse with Czech message „Text se mezitím změnil, návrh nelze použít automaticky.“ — never splice at old offsets. Test in Task 5 (`applySuggestion stale`) and Task 8 (`decideSuggestion on edited draft`).
2. **Both approvers race / partial approval** — Honza approves, Radek returns (or vice versa), or one approves the old version after a new one was submitted: decisions bind to `versionId`; deciding on a non-current version is rejected with „Mezitím vznikla nová verze.“ Tests in Task 3 and Task 8.
3. **Selection spanning two fields or inside the speaker name** — the selection → anchor mapping must clamp to one field's text or produce no anchor; never produce offsets outside `[0, text.length]`. Test in Task 11 (`selectionToAnchor`).
4. **Empty / partial script** — new script with empty scenes, null times, no CTA: duration = null, checks show "nevyplněno" not crash; review page renders. Tests in Task 2 and Task 6.
5. **Duplicate quotes** — the same phrase appears twice in a line (`„Ze zákona.“` twice): remap must prefer the occurrence nearest the old offset. Test in Task 5.

---

## File Structure

```
package.json, tsconfig.json, next.config.ts, eslint.config.mjs, vitest.config.ts, playwright.config.ts, drizzle.config.ts, .env.example, README.md
src/domain/
  ids.ts                     newId()
  script/types.ts            ScriptBody, Hook, Scene, Line, Cta, FieldId
  script/fields.ts           listFields, getFieldText, setFieldText, fieldLabel
  script/metrics.ts          durationSec, sceneCount, speakers
  script/template.ts         emptyScript()
  workflow/approval.ts       statuses, labels, transitions, evaluateDecisions
  workflow/comments.ts       comment statuses, labels, transitions
  policy/can.ts              Role, Action, can()
  anchors/remap.ts           Anchor, remapAnchor, remapAll
  anchors/suggestion.ts      applySuggestion
  diff/diffBodies.ts         FieldDiff, diffBodies
  checks/rules.ts            DEFAULT_RULES, RuleConfig
  checks/runChecks.ts        CheckContext, CheckResult, runChecks, detectNumbers
  format/date.ts             formatDate, formatDateTime, daysUntil
src/db/
  schema.ts                  all tables
  client.ts                  getDb(), createTestDb()
  seed/lookups.ts            default lookup items
  seed/demo.ts               demo users + demo scripts
  seed/index.ts              runSeed(db)
drizzle/                     generated migrations
src/server/
  errors.ts                  DomainError
  actor.ts                   Actor type, loadActor
  activity.ts                logActivity (+ notification fan-out)
  videos.ts                  createVideo, updateVideoMeta, saveDraft, submitForReview, unlockForEdit, setLifecycle
  approvals.ts               decide
  comments.ts                createComment, replyToComment, decideSuggestion, markAddressed, closeComment, reopenComment
  numbers.ts                 flagNumber, confirmNumber
  queries.ts                 listVideos, getVideoDetail, getReviewQueue, getDashboard, listNotifications, markSeen
  settings.ts                lookups + settings + users CRUD
  auth/session.ts            createSession, readSession, requireActor
  auth/magicLink.ts          requestLoginLink, consumeLoginToken
  mail/send.ts               sendMail (dev: console + .data/outbox)
src/ui/                      design-system components
src/app/                     routes
tests/                       mirrors src/ (unit + integration); e2e/ for Playwright
```

---

### Task 1: Project scaffold + tooling + design tokens

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/domain/ids.ts`, `src/domain/format/date.ts`
- Test: `tests/domain/format/date.test.ts`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:e2e`, `db:generate`, `db:seed`; path alias `@/*` → `src/*`; `newId(): string` (12-char URL-safe random via `crypto.randomUUID()` stripped); `formatDate(d: Date): string` → `"29. 10. 2026"`; `formatDateTime(d: Date): string` → `"29. 10. 2026 21:40"`; `daysUntil(target: Date, now: Date): number` (calendar days in Europe/Prague, target 20. 11. from 29. 10. → 22).

- [ ] **Step 1:** Scaffold manually (not create-next-app interactive): next@15.5, react@19, typescript, tailwindcss@4 + @tailwindcss/postcss, eslint + eslint-config-next, vitest, lucide-react, zod. `.gitignore` includes `.data/`, `.next/`, `node_modules/`, `test-results/`.
- [ ] **Step 2:** `globals.css` with Tailwind 4 `@theme` defining every token from Global Constraints as `--color-lavender`, `--color-ink`, `--color-lime`, `--color-violet`, `--color-card`, `--color-nest`, `--color-text2`, `--color-coral`, `--color-apricot`, `--color-ink2`, radii `--radius-card: 28px`, `--radius-inner: 18px`, `--radius-pill: 999px`; body bg lavender, text ink. Layout loads Plus Jakarta Sans (latin + latin-ext), `<html lang="cs">`.
- [ ] **Step 3:** Write failing tests: `formatDate(new Date('2026-10-29T10:00:00Z')) === '29. 10. 2026'`; `formatDateTime(new Date('2026-10-29T20:40:00Z')) === '29. 10. 2026 21:40'`; `daysUntil(new Date('2026-11-20T00:00:00+01:00'), new Date('2026-10-29T09:00:00+01:00')) === 22`; `newId()` matches `/^[A-Za-z0-9_-]{12}$/` and 1000 calls are unique.
- [ ] **Step 4:** Implement, run `npm test` → PASS; `npm run lint && npm run typecheck && npm run build` → success.
- [ ] **Step 5:** Commit `chore: scaffold Next.js app with tooling and design tokens`.

### Task 2: Script model

**Files:**
- Create: `src/domain/script/types.ts`, `fields.ts`, `metrics.ts`, `template.ts`
- Test: `tests/domain/script/*.test.ts`

**Interfaces:**
- Produces:
```ts
export type HookId = 'A' | 'B' | 'C';
export interface Hook { id: HookId; hookType: string | null; text: string; visual: string }
export interface Line { id: string; speaker: string; direction: string; text: string }   // direction e.g. "nevzhlédne", "do kamery"
export interface Scene { id: string; fromSec: number | null; toSec: number | null; visual: string; lines: Line[] }
export interface Cta { lineId: string; ctaType: 'share' | 'save' | 'question' }
export interface ScriptBody { hooks: Hook[]; scenes: Scene[]; cta: Cta | null; caption: string; hashtags: string[]; viewerLearns: string; source: string; differsFromLast3: string }
export type FieldId = string; // 'hook:A:text' | 'hook:A:visual' | 'scene:<id>:visual' | 'line:<id>:text' | 'caption' | 'viewerLearns' | 'source' | 'differsFromLast3'
export interface FieldRef { fieldId: FieldId; label: string; text: string }
listFields(body: ScriptBody): FieldRef[]          // reading order: viewerLearns, source, hooks (text, visual), scenes (visual, then lines), caption, differsFromLast3
getFieldText(body: ScriptBody, fieldId: FieldId): string | undefined
setFieldText(body: ScriptBody, fieldId: FieldId, text: string): ScriptBody   // immutable; throws Error on unknown field
fieldLabel(body: ScriptBody, fieldId: FieldId): string   // Czech: "Hook A · text", "Scéna 2 · obraz", "Scéna 1 · Radek", "Titulek", "Co se divák dozví"
durationSec(body: ScriptBody): number | null      // max toSec over scenes; null if no scene has toSec
sceneCount(body: ScriptBody): number
speakers(body: ScriptBody): string[]              // unique, in order of appearance
emptyScript(): ScriptBody                         // hooks A and B empty; 3 scenes [0–2], [2–null], [null–null], each with one empty line; cta null; hashtags ['#vaskonzultant']
```
- [ ] Tests (write first, see fail, implement, see pass): round-trip `setFieldText`→`getFieldText` for every field kind; `setFieldText` does not mutate input (deep-freeze input); `listFields` order on a fixture with 2 hooks/2 scenes; `durationSec` = 21 for scenes 0–11, 11–19, 19–21; `durationSec(emptyScript())` = 2; `durationSec` with all toSec null = null; `fieldLabel` values above; unknown field throws.
- [ ] Commit `feat(domain): structured script model`.

### Task 3: Approval + comment workflow

**Files:**
- Create: `src/domain/workflow/approval.ts`, `src/domain/workflow/comments.ts`
- Test: `tests/domain/workflow/*.test.ts`

**Interfaces:**
- Produces:
```ts
export const APPROVAL_STATUSES = ['draft','in_review','returned','final_review','approved','postponed','cancelled'] as const;
export type ApprovalStatus = typeof APPROVAL_STATUSES[number];
export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus,string> = { draft:'Rozpracováno', in_review:'K připomínkám', returned:'K dopracování', final_review:'K finálnímu schválení', approved:'Schváleno', postponed:'Odloženo', cancelled:'Zrušeno' };
export type ApprovalPolicy = 'all_leadership' | 'any_leadership' | 'series_guarantor';
export function canSubmit(s: { status: ApprovalStatus; editingAfterApproval: boolean }): boolean   // draft | returned | (approved && editingAfterApproval)
export function statusAfterSubmit(hasPreviousVersion: boolean): 'in_review' | 'final_review'
export function isAwaitingDecision(status: ApprovalStatus): boolean   // in_review | final_review
export interface Decision { userId: string; decision: 'approve' | 'return' }
export function evaluateDecisions(i: { policy: ApprovalPolicy; leadershipUserIds: string[]; seriesGuarantorId: string | null; decisions: Decision[] }): { state: 'approved' | 'returned' | 'pending'; approvedBy: string[]; waitingFor: string[] }
//  latest decision per user wins; any 'return' → returned; all_leadership → all ids approved; any_leadership → ≥1; series_guarantor → guarantor approved (falls back to any_leadership when guarantor null)
export const COMMENT_STATUSES = ['open','addressed','closed'] as const;
export type CommentStatus = typeof COMMENT_STATUSES[number];
export const COMMENT_STATUS_LABELS = { open:'Nevyřešeno', addressed:'Zapracováno', closed:'Uzavřeno' };
export const COMMENT_TYPES = ['remark','expert','change_request','idea','approval'] as const; // Připomínka, Odborné doplnění, Požadavek na úpravu, Nápad, Souhlas / schválení
export function nextCommentStatus(current: CommentStatus, event: 'address' | 'close' | 'reopen'): CommentStatus   // throws DomainTransitionError on invalid: address only from open; close from open|addressed; reopen from addressed|closed
export function initialCommentStatus(type: CommentType): CommentStatus   // 'approval' → closed, else open
export const PRODUCTION_STATUSES / PRODUCTION_STATUS_LABELS  // waiting:'Čeká na natáčení', shot:'Natočeno', editing:'Ve střihu', edited:'Sestříháno', published:'Publikováno', not_shot:'Nenatočeno'
```
- [ ] Tests first: `evaluateDecisions` table — all_leadership with H approve only → pending, waitingFor [R]; H+R approve → approved; H approve, R return → returned; H return then H approve (latest wins) + R approve → approved; any_leadership one approve → approved; series_guarantor; `canSubmit` matrix for all 7 statuses × editingAfterApproval; `statusAfterSubmit`; every comment transition valid/invalid.
- [ ] Commit `feat(domain): approval and comment workflow`.

### Task 4: Policy

**Files:** Create `src/domain/policy/can.ts`; Test `tests/domain/policy/can.test.ts`

**Interfaces:**
```ts
export type Role = 'admin' | 'marketer' | 'leadership' | 'production';
export type Action = 'script.create'|'script.edit'|'script.submit'|'script.unlock'|'script.lifecycle'|'comment.create'|'comment.suggest'|'suggestion.decide'|'comment.address'|'comment.close'|'comment.reopen'|'number.flag'|'number.confirm'|'approval.decide'|'settings.manage'|'production.update';
export function can(user: { id: string; role: Role }, action: Action, ctx?: { ownerId?: string | null }): boolean
```
Matrix (spec § 4.4): admin → all except `approval.decide`, `number.confirm`, `comment.close`, `comment.reopen`. leadership → `comment.create`, `comment.suggest`, `number.flag`, `number.confirm`, `approval.decide`, `comment.close`, `comment.reopen`, `script.lifecycle`. marketer → `script.create`; `script.edit`/`script.submit`/`script.unlock`/`suggestion.decide`/`comment.address` only when `ctx.ownerId === user.id`; `comment.create`, `comment.suggest`, `number.flag`. production → `production.update` only.
- [ ] Test: exhaustive table over 4 roles × 16 actions (+ marketer owner/non-owner). Commit `feat(domain): permission policy`.

### Task 5: Anchors, suggestions, diff

**Files:** Create `src/domain/anchors/remap.ts`, `src/domain/anchors/suggestion.ts`, `src/domain/diff/diffBodies.ts`; Tests `tests/domain/anchors/*.test.ts`, `tests/domain/diff/diffBodies.test.ts`

**Interfaces:**
```ts
export interface Anchor { fieldId: FieldId; from: number; to: number; quotedText: string; state: 'attached' | 'detached' }
export function remapAnchor(anchor: Anchor, body: ScriptBody): Anchor
export function applySuggestion(body: ScriptBody, anchor: Anchor, replacement: string): { ok: true; body: ScriptBody; anchor: Anchor } | { ok: false; reason: 'stale' }
export interface DiffPart { value: string; added?: boolean; removed?: boolean }
export interface FieldDiff { fieldId: FieldId; label: string; change: 'added' | 'removed' | 'changed' | 'same'; parts: DiffPart[] }
export function diffBodies(prev: ScriptBody, next: ScriptBody): FieldDiff[]   // union of fields in next's reading order, removed fields inserted after their predecessor; word diff via `diffWordsWithSpace` from `diff`
```
remapAnchor order: (1) text at `[from,to)` in same field equals quote → unchanged, attached; (2) exact occurrences of quote in same field → pick nearest to old `from`; (3) exact in any other field (first in reading order); (4) fuzzy in same field via `diff-match-patch` `match_main(text, quote.slice(0,32), from)` with `Match_Threshold = 0.4`, only if quote length ≥ 4 → anchor at match with length of quote clamped to text; (5) else `{...anchor, state:'detached'}` (keep fieldId/from/to). Empty quote → detached.
applySuggestion: remap first; if detached → `{ok:false, reason:'stale'}`; else splice replacement, return new anchor covering replacement.
- [ ] Tests: each remap branch; **duplicate quote picks nearest occurrence** (Review Focus 5); field deleted → detached; applySuggestion happy path on `"Stop! Neviděl jsi nabídku jinde?"` → `"Počkej. Kolik ti nabídli jinde?"`; **stale** when quote no longer present (Review Focus 1); diffBodies: changed line produces removed+added parts, new scene → `added`, deleted line → `removed`, identical → all `same`.
- [ ] Commit `feat(domain): comment anchors, suggestions and version diff`.

### Task 6: Script checks

**Files:** Create `src/domain/checks/rules.ts`, `src/domain/checks/runChecks.ts`; Test `tests/domain/checks/runChecks.test.ts`

**Interfaces:**
```ts
export type Severity = 'reject' | 'warn' | 'tip';
export interface RuleConfig { code: string; label: string; severity: Severity; mode: 'auto' | 'manual'; enabled: boolean; params?: Record<string, unknown> }
export const DEFAULT_RULES: RuleConfig[]
export interface CheckContext {
  body: ScriptBody;
  goalMetric: 'shares' | 'saves' | 'comments' | null;
  isSeriesEpisode: boolean;
  formatStatus: 'verified' | 'untested' | null;
  isTrialReel: boolean;
  numberChecks: { status: 'pending' | 'confirmed' }[];
  personHashtags: Record<string, string>;   // speaker name → hashtag, e.g. { Radek: '#radekteichmann', Honza: '#honzagizicky' }
  manualChecks: Record<string, boolean>;    // code → checked
}
export interface CheckResult { code: string; label: string; severity: Severity; status: 'pass' | 'fail' | 'manual_pending' | 'manual_done' | 'empty'; detail: string }
export function runChecks(ctx: CheckContext, rules: RuleConfig[]): CheckResult[]   // only enabled rules, in rules order
export function detectNumbers(body: ScriptBody): { fieldId: FieldId; from: number; to: number; text: string }[]   // /\d[\d\s.,]*(\s?(%|Kč|tis\.?|mil\.?|let|roků))?/g over line texts, hooks, viewerLearns; trims trailing spaces
```
DEFAULT_RULES (code · label · severity · mode · params):
`HOOK` „Hook do 2 s, bez představování“ reject auto (hook A text non-empty; text not matching `/\b(ahoj|jsme|jmenuji se)\b/i`) ·
`LENGTH` „Délka 12–25 s (díl série 20–30 s)“ reject auto `{min:12,max:25,seriesMin:20,seriesMax:30}` ·
`MAX_SCENES` „Max. 3 scény“ reject auto `{max:3}` ·
`CTA` „Jedna výzva ze tří, zazní nahlas“ reject auto (cta set, line exists & non-empty, line text not matching `/sleduj/i`) ·
`CTA_GOAL` „Výzva odpovídá cíli videa“ warn auto (shares→share, saves→save, comments→question; empty when goal null) ·
`NUMBERS` „Žádné nepotvrzené číslo“ reject auto (all numberChecks confirmed; detail `"2 nepotvrzená"`) ·
`VALUE` „Přidaná hodnota + zdroj“ reject auto (viewerLearns and source non-empty) ·
`LOGICAL_DIALOG` „Logický dialog“ reject manual ·
`PILLAR` „Pointa vede k pilíři, ne k produktu“ reject manual ·
`HASHTAGS` „3–5 hashtagů, #vaskonzultant + kdo hraje“ warn auto ·
`TRIAL_REEL` „Nový formát → Trial Reel“ warn auto (untested format ⇒ isTrialReel) ·
`GDPR` „GDPR: žádná jména klientů, data, obrazovky“ reject manual ·
`STRONGEST_FIRST` „Nejsilnější obraz není schovaný na konci“ tip manual.
- [ ] Tests: a passing fixture (the V031 example from `02-review-queue-desktop.png`: scenes 0–11/11–19/19–21, cta share, goal shares, hashtags `#vaskonzultant #radekteichmann #honzagizicky #hypoteka`) → all auto pass; each rule's failing case; `emptyScript()` → no throw, results `empty`/`fail`; detectNumbers finds `"15 let"` and `"2,5 %"`, ignores none.
- [ ] Commit `feat(domain): script content checks`.

### Task 7: Database schema, client, seed

**Files:** Create `src/db/schema.ts`, `src/db/client.ts`, `src/db/seed/{lookups,demo,index}.ts`, `drizzle.config.ts`, `drizzle/*` (generated), `scripts/seed.ts`; Test `tests/db/seed.test.ts`

**Interfaces:**
- Tables per spec § 3.1 with these exact names/columns (snake_case in SQL, camelCase in TS). Ids `text` primary keys via `newId()` except `videos.code` unique `V001`…; `shooting_cycles.id` = `'2026-11'`. JSON columns `jsonb` typed with `$type<ScriptBody>()` / `$type<Anchor>()`.
  - `users(id, name, email unique, role, initials, color, notifyPrefs jsonb, createdAt)`
  - `lookup_items(id, kind, key, label, data jsonb, sortOrder int, archived bool)`; unique `(kind,key)`. kinds: `category, treatment, character, profile, location, format, hook_type, cta_type, comment_type, publication_variant, check_rule`
  - `settings(id='global', monthlyTarget=16, approvalDaysBefore=7, tolerancePp=10, approvalPolicy='all_leadership')`
  - `shooting_cycles(id, shootDate date null, plannedVideos int, coversMonths text[], clipTarget text, note)`
  - `series(id, code unique, name, mainCategoryKey, goal, guarantorId, ownerId, plannedEpisodes, originalPlannedEpisodes, scopeChangeReason, startDate, expectedEnd, note, status, closedBy, closedAt)`
  - `videos(id, code unique, title, seriesId, episodeNo, cycleId, plannedMonth, categoryKey, treatmentKey, profileKey, characterKey, contentType, originalVideoId, intent, goalMetric, mainIdea, formatKey, isTrialReel, locationKeys text[], cast text[], props, ownerId, scriptDueDate, marketerNote, legacyScriptText, externalUrl, approvalStatus, approvedBy text[], approvedAt, leadershipNote, productionStatus, shotAt, rawFootageUrl, finalVideoUrl, verdict, draft jsonb, editingAfterApproval bool, manualChecks jsonb, lifecycleReason, isSample bool, createdAt, updatedAt)`
  - `script_versions(id, videoId, versionNo, body jsonb, meta jsonb, origin, changeSummary, createdBy, createdAt)` unique `(videoId, versionNo)`
  - `approval_decisions(id, versionId, userId, decision, note, overrodeWarnings, createdAt)`
  - `comments(id, videoId, versionId, parentId null, authorId, type, body, mentions text[], assigneeId, status, anchor jsonb null, suggestion jsonb null, createdAt, updatedAt)`
  - `number_checks(id, videoId, fieldId, quotedText, status, flaggedBy, confirmedBy, confirmedAt, createdAt)`
  - `view_marks(userId, videoId, lastSeenVersionId, seenAt)` pk `(userId, videoId)`
  - `activity_log(id, actorId, videoId null, entity, entityId, action, before jsonb, after jsonb, createdAt)`
  - `notifications(id, userId, activityId, readAt null, createdAt)`
  - `publications(id, videoId, profileKey, publishedAt, variant, url, note, metrics24h jsonb, metrics7d jsonb)`
  - `login_tokens(tokenHash pk, userId, expiresAt, usedAt)`
- `client.ts`: `export type Db = PgliteDatabase<typeof schema> | PostgresJsDatabase<typeof schema>`; `getDb(): Promise<Db>` — singleton; `DATABASE_URL` unset or `pglite:<dir>` → PGlite at `.data/pglite` (default), else postgres-js; runs migrations from `./drizzle` on first use. `createTestDb(): Promise<Db>` — in-memory PGlite, migrated, NOT seeded.
- `runSeed(db, { demo: boolean }): Promise<void>` — idempotent (upsert by `(kind,key)`, user email, video code).
- Seed content (`lookups.ts`), keys in kebab-case ASCII:
  - categories (from xlsx, `data: {share, color, description}`): `nabor` „Nábor, vedení lidí a práce s týmem“ 0.3 lavender `#DCD9FB`/text `#3D33B8`; `lifestyle` „Osobní brand & Lifestyle“ 0.4 pink `#FFD9E6`/`#B3264F`; `trendy` „Trendy a reakce na trh“ 0.2 mint `#CFF3E1`/`#1E7A4D`; `produkt` „Produktové a poradenské tipy“ 0.1 yellow `#FFF1B8`/`#7A5A00`; descriptions verbatim from `docs/xlsx-analysis.md` § 2.2. Short labels for tags: Nábor, Lifestyle, Trendy, Produkt (`data.short`).
  - treatments `odborne` 0.3, `instagramove` 0.7; characters `osobni` 0.7, `pracovni` 0.3, `nevztahuje` —.
  - profiles `gta-partners` (personal:false), `honza` (personal:true, hashtag `#honzagizicky`, speaker „Honza“), `radek` (personal:true, hashtag `#radekteichmann`, speaker „Radek“).
  - locations: HANDOFF § 12 five rooms + `mimo-budovu` „Mimo budovu“ + `box` „Box“.
  - formats: all 23 rows of HANDOFF § 5 „Banka formátů“ with `data: {family, description, goal, status: 'verified'|'untested'}` (✅ → verified; „✅ obsah / 🧪 střih“ → untested).
  - hook types: all 9 from HANDOFF § 5 with `data.example`.
  - cta types `share` „Pošli to kolegovi“, `save` „Ulož si to“, `question` „Otázka do komentářů“.
  - comment types (5, labels from Task 3), publication variants (6 from xlsx), check rules = `DEFAULT_RULES`.
- Demo (`demo.ts`, only when `demo:true`, all `isSample:true`): users Admin `admin@gta.local` (admin, „Admin“, A), Honza `honza@gta.local` (leadership, H), Radek `radek@gta.local` (leadership, R); cycle `2026-11` shootDate 2026-11-20 plannedVideos 16 clipTarget „30–40“; 6 scripts in cycle 2026-11 modelled on the mockups: V026 „Dva šéfové, jeden problém“ (final_review), V031 „Klient s chybou: fixace hypotéky“ (in_review, full body exactly as in `02-review-queue-desktop.png`, 3 comments: Radek anchored on „Ze zákona.“ type expert open; Honza suggestion on „Stop! Neviděl jsi nabídku jinde?“ → „Počkej. Kolik ti nabídli jinde?“; Honza general comment addressed with Admin reply), V032 „Pět Radků“ (in_review), V028 „Den za 15 sekund“ (in_review), V033 „Hot take: volná pracovní doba“ (in_review), V036 „Radek vs. Honza: kdo dřív“ (draft). Each non-draft has version v1 (V031 has v1+v2, V026 v1+v2).
- [ ] Test: `createTestDb()` + `runSeed(db,{demo:true})` twice → counts stable (4 categories, 23 formats, 9 hook types, 3 users, 6 videos); V031 has 2 versions and 3 root comments.
- [ ] `npm run db:generate` produces migration; commit `feat(db): schema, migrations and seed data`.

### Task 8: Server use cases (write side)

**Files:** Create `src/server/{errors,actor,activity,videos,approvals,comments,numbers}.ts`; Tests `tests/server/*.test.ts` (integration over `createTestDb()` + seed)

**Interfaces:**
```ts
export class DomainError extends Error { constructor(public code: 'FORBIDDEN'|'NOT_FOUND'|'INVALID_TRANSITION'|'VALIDATION'|'STALE', message: string) }   // message in Czech
export interface Actor { id: string; role: Role; name: string }
// all use cases: (db: Db, actor: Actor, input, now: Date) => Promise<…>; each runs in one transaction, checks can(), writes activity_log via logActivity
logActivity(tx, { actorId, videoId, entity, entityId, action, before?, after? }, now): Promise<string>   // also inserts notifications per rule below
createVideo(db, actor, { title, cycleId?, plannedMonth?, categoryKey?, … }, now): Promise<{ id: string; code: string }>   // next free code V001…, draft = emptyScript(), status draft
updateVideoMeta(db, actor, videoId, patch, now)       // never changes approval
saveDraft(db, actor, videoId, body: ScriptBody, now)   // forbidden when approved && !editingAfterApproval ("Schválený scénář je zamčený. Nejdřív ho odemkni.")
submitForReview(db, actor, videoId, { changeSummary? }, now): Promise<{ versionId: string; versionNo: number }>
  // canSubmit; insert version (origin 'submit', body = draft, meta snapshot); status = statusAfterSubmit; editingAfterApproval=false; approvedBy=[], approvedAt=null; remap anchors of open/addressed comments to new body
unlockForEdit(db, actor, videoId, now)                 // approved → editingAfterApproval = true
setLifecycle(db, actor, videoId, { action: 'postpone'|'cancel'|'restore', reason }, now)   // reason required for postpone/cancel; restore → draft
decide(db, actor, { videoId, versionId, decision, note?, overrideWarnings? }, now): Promise<{ state: 'approved'|'returned'|'pending'; waitingFor: string[] }>
  // must be leadership; status must be awaiting decision; versionId must be latest else STALE „Mezitím vznikla nová verze.“; return requires note or ≥1 comment by actor on that version („Napiš, co je potřeba upravit.“); when blockers exist (open comments, pending numbers, failing reject rules) and !overrideWarnings → VALIDATION code with message „Scénář má nevyřešené body. Schválit i tak?“ (UI shows confirm, resubmits with overrideWarnings); on approved → status approved, approvedBy = names, approvedAt = now
createComment(db, actor, { videoId, versionId, type, body, anchor?: Omit<Anchor,'state'>, suggestion?: { replacement: string }, assigneeId?, mentions? }, now): Promise<{ id: string }>
replyToComment(db, actor, { parentId, body, mentions? }, now)
decideSuggestion(db, actor, { commentId, accept: boolean, reason? }, now)
  // accept: applySuggestion on video.draft (stale → DomainError STALE); comment → addressed; if video approved && !editingAfterApproval && suggestion author is leadership → insert version origin 'accepted_suggestions' with body = new draft and COPY approval decisions to it; status stays approved
  // reject: reason required → reply added with reason; comment → addressed
markAddressed / closeComment / reopenComment(db, actor, { commentId }, now)   // via nextCommentStatus
flagNumber(db, actor, { videoId, fieldId, quotedText }, now); confirmNumber(db, actor, { numberCheckId }, now)
```
Notification fan-out (in `logActivity`): `submitted` → all leadership; `approved`/`returned` → video owner (admin) ; `comment.created`/`reply` → thread author + mentions + video owner, excluding actor; `suggestion.accepted|rejected` → suggestion author.
- [ ] Tests (one file per module), each asserting DB state AND an `activity_log` row: full happy path (create → submit v1 → Radek returns with note → admin accepts suggestion → submit v2 status final_review → Honza approve → pending waitingFor Radek → Radek approve → approved, approvedBy [Honza, Radek]); **decide on old versionId → STALE** (Review Focus 2); return without note/comment → VALIDATION; approve with open comment and no override → VALIDATION, with override → logged `overrodeWarnings`; admin decide → FORBIDDEN; saveDraft on approved locked → FORBIDDEN-or-VALIDATION per message; unlock → save → submit → final_review; **decideSuggestion after the quoted text was edited in draft → STALE** (Review Focus 1); accept suggestion on approved video creates version with copied decisions and stays approved; anchors remapped on submit; notifications created for leadership on submit.
- [ ] Commit `feat(server): script, approval and comment use cases`.

### Task 9: Read queries + auth + mail

**Files:** Create `src/server/queries.ts`, `src/server/auth/{session,magicLink}.ts`, `src/server/mail/send.ts`, `src/app/login/page.tsx`, `src/app/login/actions.ts`, `src/app/auth/[token]/route.ts`, `src/app/dev-login/page.tsx`, `src/middleware.ts`; Tests `tests/server/queries.test.ts`, `tests/server/auth.test.ts`

**Interfaces:**
```ts
listVideos(db, actor, filters: { cycleId?, plannedMonth?, categoryKey?, approvalStatus?, productionStatus?, seriesId?, q? }): Promise<VideoListItem[]>   // { id, code, title, categoryKey, approvalStatus, productionStatus, cycleId, plannedMonth, durationSec, openComments, latestVersionNo, castInitials: string }
getVideoDetail(db, actor, videoId): Promise<VideoDetail>   // video, draft, versions[], latestVersion, decisions for latest, comments (threads, with author names), numberChecks, checks: CheckResult[], activity[], lastSeenVersionNo for actor
getReviewQueue(db, actor, { cycleId? }): Promise<ReviewQueueItem[]>   // awaiting decision, ordered: not yet decided by actor first, then by code; item: { videoId, code, title, categoryKey, versionNo, isFinal, openComments, decidedByActor: boolean }
getDashboard(db, actor, now): Promise<{ awaitingMe: number; cycle: { id, shootDate, approvalDeadline, daysToShoot, daysToDeadline, clipTarget, locations: string[], approvedCount } | null; openComments: { videoCode, author, typeLabel, body }[]; kanban: Record<ApprovalStatus, VideoListItem[]>; returnedToMe: number }`
listNotifications(db, actor, { limit }): Promise<{ id, text, href, readAt, createdAt }[]>   // Czech text, e.g. „Radek vrátil V031 v1 k dopracování“
markSeen(db, actor, { videoId, versionId }, now)
// auth
requestLoginLink(db, email, now): Promise<void>   // unknown email → silently no-op; token 32 random bytes base64url, store sha256, expires now+15 min (phase 2 makes 7-day deep links); sendMail with link `${APP_URL}/auth/${token}`
consumeLoginToken(db, token, now): Promise<{ userId: string } | null>   // single use
createSession(userId) → sets httpOnly cookie `gta_session` (JWT HS256 via jose, AUTH_SECRET, 30 days); readSession(): Promise<{ userId } | null>; requireActor(): Promise<Actor>   // redirects to /login
sendMail({ to, subject, text, html? }): Promise<void>   // dev: console.log + write JSON to .data/outbox/<ts>.json; prod (RESEND_API_KEY set): Resend REST API via fetch
```
`/dev-login` lists users and logs in with one click; returns 404 when `NODE_ENV === 'production'` unless `ALLOW_DEV_LOGIN=1`. Middleware redirects unauthenticated requests (except `/login`, `/auth/*`, `/dev-login`, static) to `/login`.
- [ ] Tests: queue ordering and `decidedByActor`; dashboard numbers on demo seed with `now = 2026-10-29` (daysToShoot 22, approvalDeadline 2026-11-13, awaitingMe for Honza = 5); token single-use and expiry; unknown email no-op.
- [ ] Commit `feat(server): queries, magic-link auth and mail`.

### Task 10: UI shell + design-system components

**Files:** Create `src/ui/{Button,Card,StatusPill,CategoryTag,FormatTag,Avatar,Sidebar,TopBar,Tabs,BottomSheet,EmptyState}.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx` (placeholder), placeholder pages „Připravujeme“ at `src/app/(app)/{serie,nataceni,publikace}/page.tsx`, `src/app/ui-kit/page.tsx` (dev showcase). Routes (ASCII only): `/` Přehled, `/kontrola`, `/kontrola/[code]`, `/scenare`, `/scenare/[code]`, `/scenare/[code]/upravit`, `/serie`, `/nataceni`, `/publikace`, `/nastaveni`, `/notifikace`.

**Interfaces:**
- `Button` variants `approve` (lime, ✓ icon), `primary` (ink), `danger` (coral-tinted pink bg `#FFD9E1`, text `#B3264F`), `outline`, `ghost`, `icon`; min-height 48 px.
- `StatusPill({ status: ApprovalStatus })` — colors per `00-design-system.png`: draft grey dot, in_review apricot, returned coral, final_review violet, approved lime, cancelled strikethrough outline, postponed grey outline.
- `CategoryTag({ categoryKey, label, colors, short? })`.
- `Sidebar` (dark ink rail, lime logo tile, icons lucide: Home, ListChecks (with count badge), FileText, Layers, Video, Send, Settings at bottom; active = white circle) — on < 768 px becomes bottom tab bar hidden on review screen.
- `TopBar({ title, subtitle, monthLabel, cycleLabel })` with month/cycle segmented pill (values in URL `?mesic=2026-11&cyklus=2026-11`), search icon, bell with unread dot, avatar.
- [ ] `/ui-kit` renders every component; Playwright smoke screenshot at 1440 and 390 width without horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`).
- [ ] Commit `feat(ui): app shell and design-system components`.

### Task 11: ScriptView (read / comment / diff / dialog-only)

**Files:** Create `src/app/(app)/_components/script-view/{ScriptView,FieldText,SelectionToolbar,selection}.tsx|ts`; Tests `tests/ui/selection.test.ts` (pure), Playwright component check inside Task 12 e2e

**Interfaces:**
```ts
<ScriptView body={ScriptBody} meta={…} mode="read" | "diff" | "dialog" diffAgainst?={ScriptBody}
  comments={CommentThread[]} activeCommentId? onSelectAnchor?={(a: Omit<Anchor,'state'>, rect: DOMRect) => void} onAnchorClick?={(commentId) => void} />
selectionToAnchor(sel: { startFieldId: string|null; startOffset: number; endFieldId: string|null; endOffset: number }, getText: (fieldId) => string | undefined): Omit<Anchor,'state'> | null
  // null when start/end in different fields or either null; offsets clamped to [0,len]; swaps if reversed; trims whitespace at ends; null if empty
```
- Every commentable text rendered by `FieldText` as `<span data-field-id>` holding only that field's text (speaker name and direction are outside it). Anchored ranges highlighted violet-tint with numbered badge (index in comment list); pending suggestions render old text struck-through coral + new text lime-tinted (exactly as mockup).
- Layout per `02-review-queue-desktop.png`: label „V031 · SÉRIE S03 · DÍL 3“, H1 title, tags (category, format, Trial Reel), metadata tiles (Délka, Cíl videa, Profil, Lokace), dark „CO SE DIVÁK DOZVÍ“ block with Zdroj, „Hook (0–2 s)“ A/B cards with type label, „Scény“ rows with time column (grey), visual line („Obraz: …“, text2), lines `**Speaker** (direction): text`, CTA line with lime pill „Výzva · pošli kolegovi“, „Titulek“ + hashtags in violet.
- `mode="dialog"`: only lines, speaker bold, no visuals/metadata. `mode="diff"`: per-field `diffBodies` parts, green added / red removed, unchanged fields collapsed with „beze změny“.
- `SelectionToolbar`: floating dark pill with **Komentovat** (lime), **Navrhnout**, **Číslo**; positioned above selection; on touch it appears after `selectionchange` settles (300 ms) — no hover dependence.
- [ ] Tests for `selectionToAnchor`: cross-field → null (Review Focus 3); reversed → swapped; offsets beyond length clamped; whitespace-only → null.
- [ ] Commit `feat(ui): script view with anchors, diff and dialog mode`.

### Task 12: Review queue page (desktop + mobile)

**Files:** Create `src/app/(app)/kontrola/page.tsx`, `src/app/(app)/kontrola/[code]/page.tsx`, `src/app/(app)/kontrola/actions.ts`, `src/app/(app)/_components/review/{QueueList,CommentsPanel,CommentCard,Composer,ChecksPanel,VersionsPanel,ActionBar,ConfirmDialog}.tsx`

**Interfaces:**
- `/kontrola` redirects to first queue item `/kontrola/[code]?cyklus=…`; empty queue → EmptyState „Všechno máš zkontrolované.“.
- Server actions wrap Task 8 use cases, map `DomainError` → `{ ok:false, code, message }`; on `VALIDATION` from `decide` with blockers, client opens `ConfirmDialog` „Schválit i tak?“ listing blockers and resubmits with `overrideWarnings: true`.
- Desktop ≥ 1024 px: three columns exactly as `02-review-queue-desktop.png` — dark queue column („KE KONTROLE · 2 / 6“, „Natáčení 20. 11.“, „Termín schválení 13. 11. · za 15 dní“, cards with `V031 · v2 · finální` and comment count, active card lime), center card (tabs `v2 · aktuální` / `Změny od v1` / `Jen dialog`, buttons Vrátit k dopracování · ✓ Schválit · →, then ScriptView), right column tabs Komentáře · N / Kontrola / Verze + Composer „Napiš komentář… @ pro zmínku“.
- Approval progress shown above buttons when pending: „Schváleno 1/2 · čeká na Radka“; when actor already approved: Schválit disabled with „Schválil jsi · čeká na Radka“.
- `CommentCard`: number badge, avatar, name, relative time, status pill (Nevyřešeno apricot / Zapracováno lime / Uzavřeno grey / Návrh změny violet), quoted text, type tag, body, replies, actions by permission: leadership → Odpovědět, Uzavřít / Znovu otevřít; admin → Odpovědět, Přijmout / Odmítnout (suggestions), Zapracováno. Detached comments in section „Odpojené komentáře“ with original quote.
- `ChecksPanel`: „Kontrolní seznam 6/8“ list from `CheckResult[]`, manual ones as checkboxes (leadership + admin can tick; stored in `videos.manualChecks` keyed by version).
- `VersionsPanel`: timeline v1 → v2 with decisions and comment counts; „Porovnat“ selects two versions → center switches to diff.
- Mobile < 1024 px exactly as `03-review-queue-mobile.png`: header ← / „KE KONTROLE · 2 z 6 · natáčení 20. 11.“ / checks badge „6/8“, segmented progress bar, script card full width, `BottomSheet` „Komentáře · 3“ with „1 nevyřešený“ pill (drag/tap to expand), fixed bottom bar **Vrátit** · **✓ Schválit** · **→**. Composer opens inside sheet. Return opens sheet with required note field.
- Keyboard (desktop): `J`/`K` next/prev, `C` comment on current selection (or general), `S` suggestion on selection, `A` approve, `R` return; ignored while typing in inputs.
- Opening an item calls `markSeen`; if actor's last seen version < latest, default tab = `Změny od v{lastSeen}`.
- Auto refresh: `router.refresh()` every 10 s while tab visible and no composer focused.
- [ ] Verify: `npm run dev`, log in via `/dev-login` as Radek, at 390×844 and 1440×900 complete: select text → comment; select → suggest; return; as Admin accept suggestion; submit v2; as Honza and Radek approve. Capture screenshots to `test-results/` and compare against mockups by eye.
- [ ] Commit `feat(review): review queue for desktop and mobile`.

### Task 13: Scripts list, detail, editor

**Files:** Create `src/app/(app)/scenare/page.tsx`, `scenare/[code]/page.tsx`, `scenare/[code]/upravit/page.tsx`, `scenare/actions.ts`, `_components/editor/{ScriptEditor,SceneRow,LineRow,MetaForm,LiveChecks}.tsx`, `scenare/novy/route.ts`

**Interfaces:**
- List: filter bar (cyklus, měsíc, kategorie, stav schválení, stav výroby, hledat), table columns Kód · Název · Kategorie · Stav · Výroba · Cyklus · Délka · Komentáře; row color stripe: red = returned or overdue, apricot = awaiting, lime = approved. Mobile: cards like „Karta scénáře“ in design system. Button „+ Nový scénář“ (admin) → `createVideo` → editor.
- Detail: header with StatusPill and approval progress, actions (Upravit / Odemknout pro úpravu / Odeslat ke kontrole / Odložit / Zrušit / Obnovit — per `can()`), versions timeline + compare any two (diff), activity history list („Radek vrátil v1 k dopracování · 29. 10. 2026 21:40“), ScriptView of latest version.
- Editor: MetaForm (název, kategorie, typ zpracování, profil, charakter, cyklus, plánovaný měsíc, série + díl, formát (shows ✅/🧪 and auto-suggests Trial Reel for 🧪), cíl videa, lokace multi, účinkující, rekvizity, zdroj, co se divák dozví); hooks A/B/C (type select from hook types + text + obraz); scenes list (from/to seconds, obraz, lines with speaker select from speakers + free text, direction, text; add/remove/move up/down; „Výzva“ toggle on a line with cta type select); titulek + hashtags (chips, `#vaskonzultant` prefilled); LiveChecks sidebar (Task 6 results, green/apricot/coral); inline comments shown as highlights computed with `remapAnchor` against draft, with Přijmout/Odmítnout/Odpovědět/Zapracováno. Autosave (debounce 1.5 s, „Uloženo 21:40“ indicator) via `saveDraft`. „Odeslat ke kontrole“ opens dialog with optional „Co jsem změnil“. Locked approved script shows read-only with „Odemknout pro úpravu“. „Duplikovat jako nový díl série“ copies meta + body, increments episodeNo.
- [ ] Verify via dev server at 390 and 1440 widths; commit `feat(scripts): list, detail and structured editor`.

### Task 14: Dashboard, notifications, settings

**Files:** Create `src/app/(app)/page.tsx` (replace placeholder), `_components/dashboard/*.tsx`, `src/app/(app)/notifikace/page.tsx`, bell dropdown in TopBar, `src/app/(app)/nastaveni/{page,actions}.tsx`, `src/server/settings.ts`; Test `tests/server/settings.test.ts`

**Interfaces:**
- Dashboard per `01-dashboard-desktop.png`, phase-1 subset: greeting „Dobré ráno/odpoledne/večer, {name}“ by Prague hour (5–11 ráno, 11–18 odpoledne, else večer) + „Čtvrtek 29. 10. 2026 · do natáčení zbývá 22 dní“; lime card „ČEKÁ NA TVOU KONTROLU · 6 scénářů · pro natáčení 20. 11. · termín schválení 13. 11. (za 15 dní)“ + „Začít kontrolu →“ (leadership) / for admin „VRÁCENO K DOPRACOVÁNÍ“ + „Otevřít“; „Natáčecí den“ card (date, weekday, za N dní, Cíl klipů, Připraveno N scénářů, location chips); dark „Otevřené připomínky“ card (2 latest + „Zobrazit všech N“); kanban „Cyklus 2026–11 · kde co vázne“ columns per status with cards (code, title, category tag, cast), „+N dalších“ after 3; click → detail. Mix/plnění/série cards render „Přehled mixu přijde ve fázi 3“ placeholder card — NOT fake numbers.
- Notifications: bell shows unread count, dropdown with 10 latest, click → href + mark read; `/notifikace` full list.
- Settings (admin only; others → 403 page „Sem nemáš přístup.“): sections Parametry (monthlyTarget, approvalDaysBefore, tolerancePp, approvalPolicy select with Czech labels „Oba z vedení“ / „Kdokoli z vedení“ / „Garant série“), Natáčecí cykly (table + „Přidat další měsíc“), Číselníky (tabs per kind: label, sort, archived, kind-specific data fields: category share+colors+description; format family/description/goal/status), Pravidla kontroly (enable, severity, mode), Uživatelé (name, email, role, initials). Category shares must sum to 100 % ± 0.001 — else Czech validation „Součet podílů musí být 100 %.“
- `src/server/settings.ts`: `listLookups(db, kind)`, `upsertLookup(db, actor, item, now)`, `getSettings(db)`, `updateSettings(db, actor, patch, now)`, `listUsers`, `upsertUser`, `addNextCycle(db, actor, now)` (next month after the latest cycle id, plannedVideos = monthlyTarget).
- [ ] Tests: non-admin → FORBIDDEN; shares validation; addNextCycle after `2026-11` → `2026-12`, after `2026-12` → `2027-01`.
- [ ] Commit `feat: dashboard, notifications and settings`.

### Task 15: End-to-end acceptance + README

**Files:** Create `playwright.config.ts`, `tests/e2e/review-flow.spec.ts`, `README.md` (Czech), `.env.example`

**Interfaces:** Playwright `webServer` runs `npm run build && npm start` with `DATABASE_URL=pglite:.data/e2e` (wiped + seeded with demo before run) and `ALLOW_DEV_LOGIN=1`.
- [ ] e2e (viewport 390×844, then repeated in a desktop project 1440×900): Admin creates script „E2E test“ via editor (2 hooks, 3 scenes 0–2/2–12/12–20, CTA share, goal shares, viewerLearns+source, hashtags) → Odeslat → Radek opens `/kontrola`, selects a word in scene 2 → Komentovat → saves; selects a phrase → Navrhnout → replacement; Vrátit with note → status „K dopracování“ → Admin opens editor, Přijmout suggestion, replies to comment, Zapracováno, Odeslat with summary → status „K finálnímu schválení“ → Honza opens item, default tab is „Změny od v1“ showing the accepted replacement in green → Schválit → shows „čeká na Radka“ → Radek Schválit (confirm dialog if blockers) → status „Schváleno“ → detail page activity history contains, in order: odeslal v1, Radek okomentoval, Radek navrhl změnu, Radek vrátil, Admin přijal návrh, Admin odeslal v2, Honza schválil, Radek schválil. Assert no horizontal scroll at 390 px on every visited page.
- [ ] README (Czech): co to je, požadavky (Node 22), `npm install`, `npm run db:seed -- --demo`, `npm run dev`, přihlášení přes `/dev-login`, testy, proměnné prostředí (`DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `RESEND_API_KEY`, `MAIL_FROM`, `ALLOW_DEV_LOGIN`), nasazení (Vercel + Supabase/Neon: nastavit `DATABASE_URL`, migrace běží při startu).
- [ ] Commit `test: end-to-end review flow and README`.

---

## Self-review notes
- Spec § 4.1 „Schválit s drobnými úpravami“ → Task 8 `decideSuggestion`. § 4.3 anchors → Task 5 + Task 8 submit. § 4.4 → Task 4. § 5 screens → Tasks 10–14. § 7 testing → every task + Task 15. Phase-2+ items (email batching, deep links, metrics, import) intentionally excluded.
- Auth deviates from spec's „Auth.js“: own magic-link + jose session (fewer moving parts, deep-link tokens in phase 2 are trivial). Behavior identical for the user.
