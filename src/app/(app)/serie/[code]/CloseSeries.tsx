'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/ui/Button';
import { closeSeriesAction } from '../actions';

/** „Uzavřít sérii“: enabled only when the series can be closed; otherwise the reasons are written under it. */
export function CloseSeries({ seriesId, canClose, reasons }: { seriesId: string; canClose: boolean; reasons: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const reasonId = `close-reasons-${seriesId}`;
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        disabled={!canClose}
        pending={pending}
        aria-describedby={canClose ? undefined : reasonId}
        onClick={() =>
          start(async () => {
            const result = await closeSeriesAction({ seriesId });
            if (result.ok) router.refresh();
            else setError(result.message);
          })
        }
      >
        Uzavřít sérii
      </Button>
      {!canClose && (
        <p id={reasonId} className="text-sm text-text2">
          Sérii zatím nelze uzavřít. {reasons.join(' ')}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}
