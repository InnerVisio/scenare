import { SearchX } from 'lucide-react';
import { ButtonLink } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';

export default function ScriptNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Scénář jsme nenašli."
      description="Odkaz je asi starý nebo scénář neexistuje."
      action={<ButtonLink href="/scenare">Zpět na scénáře</ButtonLink>}
    />
  );
}
