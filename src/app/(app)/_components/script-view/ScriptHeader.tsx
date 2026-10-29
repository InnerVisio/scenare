import { CategoryTag } from '@/ui/CategoryTag';
import { FormatTag } from '@/ui/FormatTag';
import type { ScriptMeta } from './types';

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-inner bg-nest px-4 py-3">
      <p className="text-sm text-text2">{label}</p>
      <p className="text-h2 break-words">{value}</p>
    </div>
  );
}

export function ScriptHeader({ meta }: { meta: ScriptMeta }) {
  const duration = meta.durationSec === null ? '—' : `${meta.durationSec} s`;
  return (
    <header className="flex flex-col gap-3">
      <p className="text-sm font-semibold tracking-[0.08em] text-text2 uppercase md:text-lg">
        <span className="md:hidden">
          {meta.code} · V{meta.versionNo}
          {meta.durationSec !== null && ` · ${meta.durationSec} s`}
        </span>
        <span className="hidden md:inline">
          {meta.code} · {meta.seriesLabel ?? `V${meta.versionNo}`}
        </span>
      </p>
      <h1 className="text-h1 text-balance">{meta.title}</h1>
      <div className="flex flex-wrap gap-2">
        <CategoryTag categoryKey={meta.categoryTag.key} label={meta.categoryTag.label} colors={meta.categoryTag.colors} />
        {meta.formatLabel && (
          <span className="hidden items-center rounded-pill bg-nest px-3 py-1.5 text-sm leading-none font-semibold text-ink md:inline-flex">
            {meta.formatLabel}
          </span>
        )}
        {meta.isTrialReel && <FormatTag kind="test">Nový test · Trial Reel</FormatTag>}
        {/* On phones the tiles below are left out; the goal stays visible as a chip. */}
        {meta.goalLabel && (
          <span className="inline-flex items-center rounded-pill bg-lime-soft px-3 py-1.5 text-sm leading-none font-semibold text-lime-ink md:hidden">
            Cíl: {meta.goalLabel.toLocaleLowerCase('cs')}
          </span>
        )}
      </div>
      <div className="hidden grid-cols-3 gap-3 md:grid">
        <Tile label="Délka" value={duration} />
        <Tile label="Cíl videa" value={meta.goalLabel ?? '—'} />
        <Tile label="Profil" value={meta.profileLabel ?? '—'} />
        <Tile label="Lokace" value={meta.locationLabels.length > 0 ? meta.locationLabels.join(', ') : '—'} />
      </div>
    </header>
  );
}
