import { Plus } from 'lucide-react';
import { buttonClasses } from '@/ui/Button';
import Link from 'next/link';

/** „+ Nový scénář“: opens the paste-import page (keeping the list's cycle and month, if any). */
export function NewScriptButton({ cycleId, plannedMonth }: { cycleId?: string; plannedMonth?: string }) {
  const query = new URLSearchParams();
  if (cycleId) query.set('cyklus', cycleId);
  if (plannedMonth) query.set('mesic', plannedMonth);
  const qs = query.toString();
  return (
    <Link href={`/scenare/novy${qs ? `?${qs}` : ''}`} className={buttonClasses('primary')}>
      <Plus aria-hidden className="size-5" />
      Nový scénář
    </Link>
  );
}
