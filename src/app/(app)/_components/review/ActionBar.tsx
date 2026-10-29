'use client';

import { ArrowRight, Undo2 } from 'lucide-react';
import Link from 'next/link';
import type { ApprovalStatus } from '@/domain/workflow/approval';
import { Button, buttonClasses } from '@/ui/Button';
import { cn } from '@/ui/cn';
import { StatusPill } from '@/ui/StatusPill';
import type { ApprovalLine } from './model';

/**
 * Return · Approve · Next. `inline` sits in the centre card on desktop; `fixed` is the phone's bottom bar.
 * Users who cannot decide (admin, or a script that is not under review) get the status and „→“ only.
 */
export function ActionBar({
  variant,
  canDecide,
  status,
  line,
  busy,
  nextHref,
  onApprove,
  onReturn,
}: {
  variant: 'inline' | 'fixed';
  canDecide: boolean;
  status: ApprovalStatus;
  line: ApprovalLine;
  busy: boolean;
  nextHref: string | null;
  onApprove: () => void;
  onReturn: () => void;
}) {
  const fixed = variant === 'fixed';
  const nextClass = cn('shrink-0 px-0!', fixed ? 'size-14 min-w-14' : 'size-12 min-w-12');
  const next = nextHref ? (
    <Link href={nextHref} aria-label="Další scénář" title="Další scénář (J)" className={buttonClasses(fixed ? 'primary' : 'outline', nextClass)}>
      <ArrowRight aria-hidden className="size-5" />
    </Link>
  ) : (
    <Button variant={fixed ? 'primary' : 'outline'} disabled aria-label="Další scénář" className={nextClass}>
      <ArrowRight aria-hidden className="size-5" />
    </Button>
  );

  const buttons = canDecide ? (
    <>
      <Button
        variant="danger"
        onClick={onReturn}
        disabled={busy}
        title="Vrátit k dopracování (R)"
        className={cn(fixed && 'min-h-14 flex-1 px-4 text-lg')}
      >
        {!fixed && <Undo2 aria-hidden className="size-5" />}
        {fixed ? 'Vrátit' : 'Vrátit k dopracování'}
      </Button>
      <Button
        variant="approve"
        onClick={onApprove}
        disabled={busy || line.actorApproved}
        title="Schválit (A)"
        className={cn(fixed && 'min-h-14 flex-[1.4] px-4 text-lg')}
      >
        {line.actorApproved ? 'Schváleno' : 'Schválit'}
      </Button>
    </>
  ) : (
    <StatusPill status={status} />
  );

  if (fixed) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[45] flex flex-col gap-1.5 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] md:left-[100px] lg:hidden">
        {line.text && <p className="text-center text-sm font-semibold text-text2">{line.text}</p>}
        <div className="flex items-center gap-3">
          {buttons}
          <span className="ml-auto" />
          {next}
        </div>
      </div>
    );
  }
  return (
    <div className="hidden flex-col gap-2 lg:flex">
      {line.text && <p className="text-sm font-semibold text-text2">{line.text}</p>}
      <div className="flex items-center gap-3">
        {buttons}
        {next}
      </div>
    </div>
  );
}
