import { cn } from './cn';

/** Pastel fill with a dark text of the same hue; always shown with text, never as a bare colour. */
export function CategoryTag({
  categoryKey,
  label,
  colors,
  short,
  className,
}: {
  categoryKey: string;
  label: string;
  colors: { color: string; textColor: string };
  /** Short label used in dense lists (cards, kanban). */
  short?: string;
  className?: string;
}) {
  return (
    <span
      data-category={categoryKey}
      title={short ? label : undefined}
      style={{ backgroundColor: colors.color, color: colors.textColor }}
      className={cn('inline-flex items-center rounded-pill px-3 py-1.5 text-sm leading-none font-semibold', className)}
    >
      {short ?? label}
    </span>
  );
}
