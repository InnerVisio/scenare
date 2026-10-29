import type { HTMLAttributes } from 'react';
import { cn } from './cn';

type Tone = 'light' | 'dark' | 'lime' | 'nest';

const TONES: Record<Tone, string> = {
  light: 'bg-card text-ink',
  dark: 'bg-ink text-card',
  lime: 'bg-lime text-ink',
  nest: 'bg-nest text-ink',
};

export function Card({
  tone = 'light',
  inner = false,
  className,
  ...props
}: { tone?: Tone; /** Smaller 18 px radius for cards nested in cards. */ inner?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(inner ? 'rounded-inner p-4' : 'rounded-card p-5 md:p-6', TONES[tone], className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-h2', className)} {...props} />;
}
