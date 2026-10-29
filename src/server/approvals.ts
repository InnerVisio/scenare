import { isDeepStrictEqual } from 'node:util';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import { newId } from '@/domain/ids';
import { can } from '@/domain/policy/can';
import { runChecks } from '@/domain/checks/runChecks';
import { evaluateDecisions, isAwaitingDecision } from '@/domain/workflow/approval';
import { logActivity } from './activity';
import type { Actor } from './actor';
import { buildCheckContext, loadRules } from './checkContext';
import { DomainError } from './errors';
import { approvalSetup, latestVersion, leadershipUsers, loadVideo, statusOf, type Executor, type VideoRow, type VersionRow } from './loaders';

export interface DecideInput {
  videoId: string;
  versionId: string;
  decision: 'approve' | 'return';
  note?: string;
  overrideWarnings?: boolean;
}

export interface DecideResult {
  state: 'approved' | 'returned' | 'pending';
  /** Names of leaders whose approval is still missing. */
  waitingFor: string[];
}

/** 1 → one, 2–4 → few, 5+ → many (Czech noun forms). */
function plural(n: number, one: string, few: string, many: string): string {
  return `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;
}

/** Czech descriptions of everything that should be resolved before approving. */
async function findBlockers(tx: Executor, video: VideoRow, version: VersionRow): Promise<string[]> {
  const blockers: string[] = [];

  const [{ openComments }] = await tx
    .select({ openComments: sql<number>`count(*)::int` })
    .from(s.comments)
    .where(and(eq(s.comments.videoId, video.id), sql`${s.comments.parentId} is null`, eq(s.comments.status, 'open')));
  if (openComments > 0) {
    blockers.push(plural(openComments, 'nevyřešený komentář', 'nevyřešené komentáře', 'nevyřešených komentářů'));
  }

  const [{ pendingNumbers }] = await tx
    .select({ pendingNumbers: sql<number>`count(*)::int` })
    .from(s.numberChecks)
    .where(and(eq(s.numberChecks.videoId, video.id), eq(s.numberChecks.status, 'pending')));
  if (pendingNumbers > 0) {
    blockers.push(plural(pendingNumbers, 'nepotvrzené číslo', 'nepotvrzená čísla', 'nepotvrzených čísel'));
  }

  const results = runChecks(await buildCheckContext(tx, video, version), await loadRules(tx));
  for (const r of results) {
    // NUMBERS is already reported above as a count.
    if (r.severity === 'reject' && r.status === 'fail' && r.code !== 'NUMBERS') {
      blockers.push(r.detail ? `${r.label} – ${r.detail}` : r.label);
    }
  }
  return blockers;
}

export async function decide(db: Db, actor: Actor, input: DecideInput, now: Date): Promise<DecideResult> {
  return db.transaction(async (tx) => {
    const video = await loadVideo(tx, input.videoId, { lock: true });
    if (!can(actor, 'approval.decide')) throw new DomainError('FORBIDDEN', 'K této akci nemáš oprávnění.');

    const [version] = await tx
      .select()
      .from(s.scriptVersions)
      .where(and(eq(s.scriptVersions.id, input.versionId), eq(s.scriptVersions.videoId, video.id)));
    if (!version) throw new DomainError('NOT_FOUND', 'Verze nenalezena.');
    const latest = await latestVersion(tx, video.id);
    if (latest?.id !== version.id) throw new DomainError('STALE', 'Mezitím vznikla nová verze.');

    const status = statusOf(video);
    if (!isAwaitingDecision(status)) {
      throw new DomainError('INVALID_TRANSITION', 'Scénář teď nečeká na rozhodnutí.');
    }

    const existing = await tx
      .select()
      .from(s.approvalDecisions)
      .where(eq(s.approvalDecisions.versionId, version.id))
      .orderBy(asc(s.approvalDecisions.createdAt));

    const decisionId = newId();
    const note = input.note?.trim() ?? '';

    if (input.decision === 'return') {
      if (!note) {
        const [{ own }] = await tx
          .select({ own: sql<number>`count(*)::int` })
          .from(s.comments)
          .where(
            and(
              eq(s.comments.videoId, video.id),
              eq(s.comments.versionId, version.id),
              eq(s.comments.authorId, actor.id),
              sql`${s.comments.parentId} is null`,
            ),
          );
        if (own === 0) throw new DomainError('VALIDATION', 'Napiš, co je potřeba upravit.');
      }
      await tx.insert(s.approvalDecisions).values({
        id: decisionId,
        versionId: version.id,
        userId: actor.id,
        decision: 'return',
        note,
        overrodeWarnings: false,
        createdAt: now,
      });
      await tx.update(s.videos).set({ approvalStatus: 'returned', updatedAt: now }).where(eq(s.videos.id, video.id));
      await logActivity(
        tx,
        {
          actorId: actor.id,
          videoId: video.id,
          entity: 'approval_decision',
          entityId: decisionId,
          action: 'approval.returned',
          before: { status },
          after: { status: 'returned', decision: 'return', note, versionNo: version.versionNo },
        },
        now,
      );
      return { state: 'returned', waitingFor: [] };
    }

    // approve
    const mine = existing.filter((d) => d.userId === actor.id).at(-1);
    if (mine?.decision === 'approve') throw new DomainError('VALIDATION', 'Tento scénář už jsi schválil.');

    const blockers = await findBlockers(tx, video, version);
    if (blockers.length > 0 && !input.overrideWarnings) {
      throw new DomainError('VALIDATION', 'Scénář má nevyřešené body. Schválit i tak?', blockers);
    }
    const overrodeWarnings = blockers.length > 0;

    await tx.insert(s.approvalDecisions).values({
      id: decisionId,
      versionId: version.id,
      userId: actor.id,
      decision: 'approve',
      note,
      overrodeWarnings,
      createdAt: now,
    });
    await logActivity(
      tx,
      {
        actorId: actor.id,
        videoId: video.id,
        entity: 'approval_decision',
        entityId: decisionId,
        action: 'approval.approved',
        after: {
          decision: 'approve',
          versionNo: version.versionNo,
          overrodeWarnings,
          ...(overrodeWarnings ? { warnings: blockers } : {}),
        },
      },
      now,
    );

    const leadership = await leadershipUsers(tx);
    const names = new Map(leadership.map((u) => [u.id, u.name]));
    const { policy, guarantorId } = await approvalSetup(tx, video);
    const evaluation = evaluateDecisions({
      policy,
      leadershipUserIds: leadership.map((u) => u.id),
      seriesGuarantorId: guarantorId,
      decisions: [...existing, { userId: actor.id, decision: 'approve' as const }],
    });
    const nameOf = (id: string) => names.get(id) ?? id;

    if (evaluation.state === 'approved') {
      const approvedBy = evaluation.approvedBy.map(nameOf);
      await tx
        .update(s.videos)
        .set({
          approvalStatus: 'approved',
          approvedBy,
          approvedAt: now,
          // Edits made to the draft while the version was under review stay pending and must be re-submitted.
          editingAfterApproval: !isDeepStrictEqual(video.draft, version.body),
          updatedAt: now,
        })
        .where(eq(s.videos.id, video.id));
      await logActivity(
        tx,
        {
          actorId: actor.id,
          videoId: video.id,
          entity: 'video',
          entityId: video.id,
          action: 'video.approved',
          before: { status },
          after: { status: 'approved', approvedBy, versionNo: version.versionNo },
        },
        now,
      );
      return { state: 'approved', waitingFor: [] };
    }
    return { state: evaluation.state, waitingFor: evaluation.waitingFor.map(nameOf) };
  });
}
