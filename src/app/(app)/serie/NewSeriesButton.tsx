'use client';

import { Plus } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/ui/Button';
import { createSeriesAction } from './actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" pending={pending}>
      <Plus aria-hidden className="size-5" />
      {pending ? 'Vytvářím' : 'Nová série'}
    </Button>
  );
}

export function NewSeriesButton() {
  return (
    <form action={() => createSeriesAction()}>
      <Submit />
    </form>
  );
}
