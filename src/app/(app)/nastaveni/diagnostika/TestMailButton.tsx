'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/ui/Button';
import { sendTestMailToMe } from '../actions';

export function TestMailButton() {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        pending={pending}
        onClick={() =>
          start(async () => {
            const result = await sendTestMailToMe();
            setStatus(result.ok ? { ok: true, text: 'Odesláno.' } : { ok: false, text: result.message ?? 'Odeslání se nepovedlo.' });
          })
        }
      >
        Poslat testovací e-mail mně
      </Button>
      <p role="status" className={status && !status.ok ? 'text-sm font-semibold text-danger-text' : 'text-sm font-semibold text-text2'}>
        {status?.text}
      </p>
    </div>
  );
}
