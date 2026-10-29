import { formatTime } from '@/domain/format/date';
import { cn } from '@/ui/cn';
import type { SaveState } from './useAutosave';

/** „Ukládám…“, „Uloženo 21:40“ or the coral failure notice with a retry button. */
export function SaveIndicator({
  state,
  savedAt,
  message,
  onRetry,
  className,
}: {
  state: SaveState;
  savedAt: Date | null;
  message: string | null;
  onRetry: () => void;
  className?: string;
}) {
  if (state === 'error') {
    return (
      <p role="status" className={cn('flex flex-wrap items-center gap-x-2 text-sm font-semibold text-danger-text', className)}>
        {message ?? 'Nepodařilo se uložit — zkusím znovu'}
        <button type="button" onClick={onRetry} className="min-h-12 underline underline-offset-2">
          Zkusit teď
        </button>
      </p>
    );
  }
  return (
    <p role="status" className={cn('text-sm font-semibold text-text2', className)}>
      {state === 'saved' ? `Uloženo${savedAt ? ` ${formatTime(savedAt)}` : ''}` : 'Ukládám…'}
    </p>
  );
}
