'use client';

import { Plus } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/ui/Button';
import { createScriptAction } from './actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      <Plus aria-hidden className="size-5" />
      {pending ? 'Vytvářím…' : 'Nový scénář'}
    </Button>
  );
}

/** „+ Nový scénář“: creates an empty draft (in the filtered cycle and month, if any) and opens the editor. */
export function NewScriptButton({ cycleId, plannedMonth }: { cycleId?: string; plannedMonth?: string }) {
  return (
    <form action={() => createScriptAction({ cycleId: cycleId ?? null, plannedMonth: plannedMonth ?? null })}>
      <Submit />
    </form>
  );
}
