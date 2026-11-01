'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { PRODUCTION_STATUSES, PRODUCTION_STATUS_LABELS } from '@/domain/workflow/production';
import { Field, Select } from '@/ui/Field';
import { setProductionStatusAction } from '../../nataceni/actions';

/** Production status of one script (Čeká na natáčení → … → Publikováno, Nenatočeno); the server validates the change. */
export function ProductionStatus({ videoId, value, editable }: { videoId: string; value: string; editable: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const label = PRODUCTION_STATUS_LABELS[value as keyof typeof PRODUCTION_STATUS_LABELS] ?? value;
  if (!editable) return <p className="text-sm font-semibold text-text2">Výroba: {label}</p>;
  return (
    <Field label="Stav výroby" error={error} className="sm:max-w-xs">
      <Select
        value={value}
        disabled={pending}
        onChange={(event) =>
          start(async () => {
            setError('');
            const result = await setProductionStatusAction({ videoIds: [videoId], status: event.target.value, shotDate: null });
            if (result.ok) router.refresh();
            else setError(result.message);
          })
        }
      >
        {PRODUCTION_STATUSES.map((st) => (
          <option key={st} value={st}>
            {PRODUCTION_STATUS_LABELS[st]}
          </option>
        ))}
      </Select>
    </Field>
  );
}
