import { cn } from './cn';

const SIZES = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-12 text-base' } as const;
const TONES = { mint: 'bg-mint text-mint-ink', lavender: 'bg-violet-tint text-violet-ink', ink: 'bg-ink text-lime' } as const;

export function Avatar({
  initials,
  size = 'md',
  tone = 'mint',
  className,
}: {
  initials: string;
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', SIZES[size], TONES[tone], className)}
    >
      {initials}
    </span>
  );
}
