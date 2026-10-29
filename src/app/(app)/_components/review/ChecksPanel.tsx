'use client';

import { Check, Minus } from 'lucide-react';
import { startTransition, useOptimistic } from 'react';
import type { CheckResult } from '@/domain/checks/runChecks';
import type { ReviewData } from '@/server/review';
import { Button } from '@/ui/Button';
import { cn, focusRing } from '@/ui/cn';
import { checkSummary } from './model';

function StatusDot({ result }: { result: CheckResult }) {
  if (result.status === 'pass' || result.status === 'manual_done') {
    return (
      <span aria-label="Splněno" className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-lime-soft text-lime-ink">
        <Check aria-hidden className="size-4" strokeWidth={3} />
      </span>
    );
  }
  if (result.status === 'fail') {
    return (
      <span
        aria-label="Nesplněno"
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-lg text-base font-bold',
          result.severity === 'reject' ? 'bg-danger-bg text-danger-text' : 'bg-apricot-soft text-apricot-ink',
        )}
      >
        !
      </span>
    );
  }
  return (
    <span aria-label="Bez údajů" className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-grey-soft text-text2">
      <Minus aria-hidden className="size-4" />
    </span>
  );
}

/** „Kontrolní seznam 6/8“ plus the numbers flagged for confirmation. */
export function ChecksPanel({
  checks,
  numberChecks,
  perms,
  onToggleManual,
  onConfirmNumber,
  hideEmptyNumbers = false,
}: {
  checks: ReviewData['checks'];
  numberChecks: ReviewData['numberChecks'];
  perms: ReviewData['perms'];
  onToggleManual: (code: string, checked: boolean) => Promise<boolean>;
  onConfirmNumber: (id: string) => Promise<boolean>;
  /** The editor has nothing to say about numbers until someone flags one. */
  hideEmptyNumbers?: boolean;
}) {
  const [shown, setOptimistic] = useOptimistic(checks, (current, change: { code: string; checked: boolean }) =>
    current.map((c) => (c.code === change.code ? { ...c, status: change.checked ? ('manual_done' as const) : ('manual_pending' as const) } : c)),
  );
  const { passed, total } = checkSummary(shown);

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Kontrolní seznam" className="rounded-card bg-card p-5 max-lg:bg-nest">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-h2">Kontrolní seznam</h3>
          <p className="font-semibold text-lime-ink" aria-label={`${passed} z ${total} splněno`}>
            {passed} / {total}
          </p>
        </div>
        <ul className="flex flex-col">
          {shown.map((result) => {
            const manual = result.status === 'manual_pending' || result.status === 'manual_done';
            return (
              <li key={result.code} className="flex min-h-12 items-center gap-3 py-1.5">
                {manual ? (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={result.status === 'manual_done'}
                    aria-label={`${result.label} (ručně)`}
                    disabled={!perms.manualCheck}
                    onClick={() => {
                      const checked = result.status !== 'manual_done';
                      startTransition(async () => {
                        setOptimistic({ code: result.code, checked });
                        await onToggleManual(result.code, checked);
                      });
                    }}
                    className={cn(
                      'flex w-full min-h-12 items-center gap-3 rounded-lg text-left disabled:cursor-default',
                      focusRing,
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-lg border-2',
                        result.status === 'manual_done' ? 'border-lime-soft bg-lime-soft text-lime-ink' : 'border-ink/20 bg-card',
                      )}
                    >
                      {result.status === 'manual_done' && <Check className="size-4" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">{result.label} (ručně)</span>
                  </button>
                ) : (
                  <>
                    <StatusDot result={result} />
                    <span className="min-w-0 flex-1">{result.label}</span>
                    {result.detail && <span className="max-w-[40%] text-right text-sm text-text2">{result.detail}</span>}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {!(hideEmptyNumbers && numberChecks.length === 0) && (
        <section aria-label="Čísla k potvrzení" className="rounded-card bg-card p-5 max-lg:bg-nest">
          <h3 className="text-h2 mb-3">Čísla k potvrzení</h3>
          {numberChecks.length === 0 ? (
            <p className="text-text2">Žádná označená čísla. Označ číslo ve scénáři a zvol „Číslo“.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {numberChecks.map((n) => (
                <li key={n.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">„{n.quotedText}“</p>
                    <p className="text-sm text-text2">
                      {n.status === 'confirmed'
                        ? `Potvrdil ${n.confirmedByName ?? ''}`.trim()
                        : `Označil ${n.flaggedByName ?? ''}`.trim()}
                    </p>
                  </div>
                  {n.status === 'confirmed' ? (
                    <span className="rounded-pill bg-lime-soft px-3 py-1.5 text-sm font-semibold text-lime-ink">Potvrzeno</span>
                  ) : (
                    <>
                      <span className="rounded-pill bg-apricot-soft px-3 py-1.5 text-sm font-semibold text-apricot-ink">Čeká</span>
                      {perms.confirmNumber && (
                        <Button variant="primary" onClick={() => void onConfirmNumber(n.id)}>
                          Potvrdit
                        </Button>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
