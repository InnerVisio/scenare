import { Hammer, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

export function EmptyState({
  title,
  description,
  icon: Icon = Hammer,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-card bg-card px-6 py-12 text-center', className)}>
      <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-nest text-violet">
        <Icon className="size-6" />
      </span>
      <h2 className="text-h2">{title}</h2>
      {description && <p className="max-w-sm text-text2">{description}</p>}
      {action}
    </div>
  );
}
