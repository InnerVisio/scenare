/** Published / planned; the fill stops at 100 % even when there are more published than planned. */
export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)} aria-label="Publikováno z plánu" className="h-2 w-full overflow-hidden rounded-pill bg-nest">
      <div className="h-full rounded-pill bg-lime-dot" style={{ width: `${pct}%` }} />
    </div>
  );
}
