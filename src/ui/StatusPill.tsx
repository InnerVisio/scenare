import { APPROVAL_STATUS_LABELS, type ApprovalStatus } from '@/domain/workflow/approval';
import { cn } from './cn';

interface Look {
  pill: string;
  dot: string | null;
}

const LOOKS: Record<ApprovalStatus, Look> = {
  draft: { pill: 'bg-grey-soft text-ink2', dot: 'bg-grey-dot' },
  in_review: { pill: 'bg-apricot-soft text-apricot-ink', dot: 'bg-apricot' },
  returned: { pill: 'bg-danger-bg text-danger-text', dot: 'bg-coral' },
  final_review: { pill: 'bg-violet-soft text-violet-ink', dot: 'bg-violet' },
  approved: { pill: 'bg-lime-soft text-lime-ink', dot: 'bg-lime-dot' },
  cancelled: { pill: 'border border-ink/25 bg-card text-text2 line-through', dot: null },
  postponed: { pill: 'border border-ink/25 bg-card text-text2', dot: null },
};

export function StatusPill({ status, className }: { status: ApprovalStatus; className?: string }) {
  const look = LOOKS[status];
  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-sm leading-none font-semibold whitespace-nowrap',
        look.pill,
        className,
      )}
    >
      {look.dot && <span aria-hidden className={cn('size-2 rounded-full', look.dot)} />}
      {APPROVAL_STATUS_LABELS[status]}
    </span>
  );
}
