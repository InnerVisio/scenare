import Link from 'next/link';
import { Check } from 'lucide-react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn, focusRing } from './cn';

export type ButtonVariant = 'approve' | 'primary' | 'danger' | 'outline' | 'ghost' | 'icon';

const BASE =
  'inline-flex min-h-12 select-none items-center justify-center gap-2 rounded-pill font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  approve: 'bg-lime px-6 text-ink hover:brightness-95 active:brightness-90',
  primary: 'bg-ink px-6 text-card hover:bg-ink2',
  danger: 'bg-danger-bg px-6 text-danger-text hover:brightness-95',
  outline: 'border border-ink/15 bg-card px-6 text-ink hover:bg-nest',
  ghost: 'px-4 text-ink hover:bg-ink/5',
  icon: 'size-12 min-w-12 bg-nest p-0 text-ink hover:bg-ink/10',
};

export function buttonClasses(variant: ButtonVariant = 'primary', className?: string): string {
  return cn(BASE, VARIANTS[variant], focusRing, className);
}

interface Shared {
  variant?: ButtonVariant;
  children?: ReactNode;
}

/** `approve` shows a check icon before the label. */
function content(variant: ButtonVariant | undefined, children: ReactNode) {
  return (
    <>
      {variant === 'approve' && <Check aria-hidden className="size-5" strokeWidth={2.5} />}
      {children}
    </>
  );
}

export function Button({
  variant = 'primary',
  className,
  children,
  type = 'button',
  ...props
}: Shared & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={buttonClasses(variant, className)} {...props}>
      {content(variant, children)}
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  className,
  children,
  href,
  ...props
}: Shared & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return (
    <Link href={href} className={buttonClasses(variant, className)} {...props}>
      {content(variant, children)}
    </Link>
  );
}
