import { cn } from './cn';

const SIZES = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-12 text-base' } as const;
const TONES = { mint: 'bg-[#CFF3E1] text-[#1C6B49]', lavender: 'bg-[#DCD9FB] text-[#3D33B8]', ink: 'bg-ink text-lime' } as const;

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
