import { EmptyState } from './EmptyState';
import { TopBar } from './TopBar';

/** Stand-in for screens built in later tasks. */
export function PlaceholderPage({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <TopBar title={title} subtitle={subtitle} />
      <EmptyState title="Připravujeme" description="Tuhle obrazovku právě dokončujeme." />
    </>
  );
}
