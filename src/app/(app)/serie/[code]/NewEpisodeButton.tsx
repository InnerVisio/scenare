'use client';

import { Plus } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/ui/Button';
import { createEpisodeAction } from '../actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" pending={pending}>
      <Plus aria-hidden className="size-5" />
      {pending ? 'Vytvářím' : 'Nový díl'}
    </Button>
  );
}

export function NewEpisodeButton({ seriesId }: { seriesId: string }) {
  return (
    <form action={() => createEpisodeAction({ seriesId })}>
      <Submit />
    </form>
  );
}
