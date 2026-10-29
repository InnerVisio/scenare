'use client';

import { formatDayMonth } from '@/domain/format/date';
import type { ReviewData } from '@/server/review';
import { Button } from '@/ui/Button';
import { plural } from './model';

/** Timeline of versions, newest first, with who decided what and how many comments each collected. */
export function VersionsPanel({
  versions,
  latestNo,
  onCompare,
}: {
  versions: ReviewData['versions'];
  latestNo: number | null;
  onCompare: (versionNo: number) => void;
}) {
  const ordered = [...versions].sort((a, b) => b.no - a.no);
  if (ordered.length === 0) return <p className="rounded-card bg-card p-5 text-text2 max-lg:bg-nest">Scénář zatím nemá žádnou odeslanou verzi.</p>;
  return (
    <ol className="flex flex-col gap-4">
      {ordered.map((version) => {
        const current = version.no === latestNo;
        return (
          <li key={version.id} className="flex flex-col gap-3 rounded-card bg-card p-5 max-lg:rounded-inner max-lg:bg-nest max-lg:p-4">
            <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-h2">v{version.no}</h3>
              <p className="text-sm text-text2">
                {formatDayMonth(new Date(version.createdAt))} · {version.createdByName}
              </p>
              {current && <span className="ml-auto rounded-pill bg-ink px-3 py-1.5 text-sm font-semibold text-lime">aktuální</span>}
            </header>
            {version.changeSummary && <p>„{version.changeSummary}“</p>}
            {version.decisions.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {version.decisions.map((d, i) => (
                  <li key={i} className="text-sm">
                    <b>{d.userName}</b> {d.decision === 'approve' ? 'schválil' : 'vrátil'}
                    {d.note && <span className="text-text2"> · {d.note}</span>}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm text-text2">
              {version.commentCount} {plural(version.commentCount, 'komentář', 'komentáře', 'komentářů')}
            </p>
            {!current && latestNo !== null && (
              <Button variant="outline" className="w-fit" onClick={() => onCompare(version.no)}>
                Porovnat s aktuální
              </Button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
