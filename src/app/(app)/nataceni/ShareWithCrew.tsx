'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Field';
import { createCrewLinkAction } from './actions';

/** „Sdílet se štábem“: creates the 14-day read-only link and shows it for copying. */
export function ShareWithCrew({ cycleId }: { cycleId: string }) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto">
      <Button
        variant="outline"
        pending={pending}
        onClick={() =>
          start(async () => {
            setError('');
            setCopied(false);
            const result = await createCrewLinkAction({ cycleId });
            if (result.ok) setUrl(`${window.location.origin}${result.path}`);
            else setError(result.message);
          })
        }
      >
        Sdílet se štábem
      </Button>
      {url && (
        <div className="flex flex-col gap-2">
          <TextInput readOnly value={url} aria-label="Odkaz pro štáb" onFocus={(event) => event.currentTarget.select()} />
          <p className="text-sm text-text2">Odkaz je jen pro čtení a platí 14 dní.</p>
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? 'Zkopírováno' : 'Kopírovat odkaz'}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}
