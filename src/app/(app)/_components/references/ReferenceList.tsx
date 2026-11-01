'use client';

import { ExternalLink, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { cn, focusRing } from '@/ui/cn';
import { Button } from '@/ui/Button';
import type { ReferenceVM } from '@/server/references';
import { removeReferenceAction } from '../../scenare/actions';

export interface SceneNumbers {
  /** Scene id → 1-based number in the script. */
  [sceneId: string]: number;
}

/** „Scéna 2“ / „Celé video“ for a sample. */
export function referenceScope(reference: Pick<ReferenceVM, 'sceneId'>, scenes: SceneNumbers): string {
  const no = reference.sceneId ? scenes[reference.sceneId] : undefined;
  return no ? `Scéna ${no}` : 'Celé video';
}

/**
 * Sample cards: the whole card is a link that opens in a new tab (on a phone it hands over to the
 * TikTok / Instagram app). No embedded player on purpose: slow and third-party scripts.
 */
export function ReferenceList({
  videoId,
  references,
  scenes,
  empty,
}: {
  videoId: string;
  references: ReferenceVM[];
  scenes: SceneNumbers;
  /** Text for an empty list; without it an empty list renders nothing. */
  empty?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (references.length === 0) return empty ? <p className="text-text2">{empty}</p> : null;

  const remove = (referenceId: string) => {
    setError(null);
    setRemoving(referenceId);
    start(async () => {
      const result = await removeReferenceAction({ videoId, referenceId });
      if (!result.ok) setError(result.message);
      setRemoving(null);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {references.map((reference) => (
          <li key={reference.id} data-reference-id={reference.id} className="flex items-stretch gap-2">
            <a
              href={reference.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn('flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-inner bg-nest px-4 py-2.5 hover:bg-ink/10', focusRing)}
            >
              <span className="shrink-0 rounded-pill bg-ink px-3 py-1.5 text-sm leading-none font-semibold text-card">{reference.label}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="break-words font-semibold">{reference.note || 'Ukázka bez poznámky'}</span>
                <span className="text-sm break-all text-text2">
                  {referenceScope(reference, scenes)} · {reference.domain || reference.url}
                </span>
              </span>
              <ExternalLink aria-hidden className="size-4 shrink-0 text-text2" />
            </a>
            {reference.canRemove && (
              <Button
                variant="icon"
                aria-label={`Odebrat ukázku ${reference.label}`}
                title="Odebrat ukázku"
                pending={pending && removing === reference.id}
                disabled={pending}
                onClick={() => remove(reference.id)}
              >
                <Trash2 aria-hidden className="size-5" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}

/** Block „Ukázky“ above the script text on the review screen and the detail page. */
export function ReferenceBlock({
  videoId,
  references,
  scenes,
  className,
}: {
  videoId: string;
  references: ReferenceVM[];
  scenes: SceneNumbers;
  className?: string;
}) {
  if (references.length === 0) return null;
  return (
    <section aria-label="Ukázky" className={cn('flex flex-col gap-2', className)}>
      <h2 className="text-h2">Ukázky</h2>
      <ReferenceList videoId={videoId} references={references} scenes={scenes} />
    </section>
  );
}
