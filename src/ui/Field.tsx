'use client';

import {
  cloneElement,
  useId,
  useLayoutEffect,
  useRef,
  type InputHTMLAttributes,
  type ReactElement,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn, focusRing } from './cn';

const CONTROL = 'w-full px-4 text-ink placeholder:text-text2/70 disabled:opacity-60';

/** Controls sit on white cards (`bg-nest`); pass a `bg-*` class to sit on something else. */
const surface = (className?: string) => (className && /(^|\s)bg-/.test(className) ? '' : 'bg-nest');

/** A label above its single control (the control gets the label's `id` link, so the label is its whole name). */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-text2">
        {label}
      </label>
      {cloneElement(children, { id })}
      {error ? (
        <span role="alert" className="text-sm font-semibold text-danger-text">
          {error}
        </span>
      ) : (
        hint && <span className="text-sm text-text2">{hint}</span>
      )}
    </div>
  );
}

export function TextInput({ className, pill = false, ...props }: InputHTMLAttributes<HTMLInputElement> & { pill?: boolean }) {
  return <input className={cn(CONTROL, surface(className), 'min-h-12', pill ? 'rounded-pill' : 'rounded-inner', focusRing, className)} {...props} />;
}

export function Select({ className, children, pill = false, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { pill?: boolean }) {
  return (
    <select className={cn(CONTROL, surface(className), 'min-h-12', pill ? 'rounded-pill' : 'rounded-inner', focusRing, className)} {...props}>
      {children}
    </select>
  );
}

/** Textarea that grows with its text. */
export function Textarea({ className, value, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = 'auto';
      if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    // Starts inside collapsed sections where nothing can be measured; re-measure when it appears or resizes.
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} className={cn(CONTROL, surface(className), 'min-h-12 resize-none rounded-inner py-3 leading-snug', focusRing, className)} {...props} />;
}
