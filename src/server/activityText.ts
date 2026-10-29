import type { Role } from '@/domain/policy/can';

export interface ActivityTextRow {
  action: string;
  actorId: string | null;
  /** Id of the changed entity; for comment actions it is the comment id. */
  entityId: string;
  /** Code of the video the activity belongs to (e.g. "V031"). */
  videoCode: string | null;
  after: Record<string, unknown> | null;
}

const COMMENT_ACTIONS = new Set([
  'comment.created',
  'comment.replied',
  'comment.addressed',
  'comment.closed',
  'comment.reopened',
  'suggestion.accepted',
  'suggestion.rejected',
]);
const LEADERSHIP_REVIEW_ACTIONS = new Set(['version.submitted']);

function versionSuffix(after: Record<string, unknown> | null): string {
  const no = after?.versionNo;
  return typeof no === 'number' ? ` v${no}` : '';
}

/**
 * Czech sentence and link for one activity row.
 * `names` maps user ids to display names; `viewer` is the person reading it (leadership is sent to
 * the review screen for submissions and comments, everyone else to the script).
 */
export function describeActivity(
  row: ActivityTextRow,
  names: ReadonlyMap<string, string>,
  viewer?: { role: Role },
): { text: string; href: string } {
  const who = row.actorId ? (names.get(row.actorId) ?? 'Někdo') : 'Systém';
  const code = row.videoCode ?? 'scénáři';
  const v = versionSuffix(row.after);
  const after = row.after;

  let text: string;
  switch (row.action) {
    case 'video.created':
      text = `${who} vytvořil scénář ${code}`;
      break;
    case 'video.meta_updated':
      text = `${who} upravil údaje scénáře ${code}`;
      break;
    case 'version.submitted':
      text = `${who} odeslal ${code}${v} ke kontrole`;
      break;
    case 'approval.returned':
      text = `${who} vrátil ${code}${v} k dopracování`;
      break;
    case 'approval.approved':
      text = `${who} schválil ${code}${v}`;
      break;
    case 'video.approved': {
      const approvedBy = Array.isArray(after?.approvedBy) ? after.approvedBy.length : 0;
      text = approvedBy === 2 ? `${code} je schválený oběma` : `${code} je schválený`;
      break;
    }
    case 'video.unlocked':
      text = `${who} odemkl schválený scénář ${code} k úpravám`;
      break;
    case 'video.postponed':
      text = `${who} odložil ${code}`;
      break;
    case 'video.cancelled':
      text = `${who} zrušil ${code}`;
      break;
    case 'video.restored':
      text = `${who} obnovil ${code}`;
      break;
    case 'comment.created':
      text = after?.hasSuggestion ? `${who} navrhl změnu ve ${code}` : `${who} okomentoval ${code}`;
      break;
    case 'comment.replied':
      text = `${who} odpověděl na komentář ve ${code}`;
      break;
    case 'suggestion.accepted':
      text = `${who} přijal návrh ve ${code}`;
      break;
    case 'suggestion.rejected':
      text = `${who} odmítl návrh ve ${code}`;
      break;
    case 'comment.addressed':
      text = `${who} označil komentář jako zapracovaný ve ${code}`;
      break;
    case 'comment.closed':
      text = `${who} uzavřel komentář ve ${code}`;
      break;
    case 'comment.reopened':
      text = `${who} znovu otevřel komentář ve ${code}`;
      break;
    case 'number.flagged':
      text = `${who} označil číslo k ověření ve ${code}`;
      break;
    case 'number.confirmed':
      text = `${who} potvrdil číslo ve ${code}`;
      break;
    default:
      text = `Změna ve ${code}`;
  }

  if (!row.videoCode) return { text, href: '/' };
  const leadership = viewer?.role === 'leadership';
  const review = leadership && (LEADERSHIP_REVIEW_ACTIONS.has(row.action) || COMMENT_ACTIONS.has(row.action));
  const base = `${review ? '/kontrola' : '/scenare'}/${row.videoCode}`;
  return { text, href: COMMENT_ACTIONS.has(row.action) ? `${base}#komentar-${row.entityId}` : base };
}
