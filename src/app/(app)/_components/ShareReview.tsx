'use client';

import { useState } from 'react';
import { Button } from '@/ui/Button';
import { ReviewDialog } from './review/ReviewDialog';

/** „Nové scénáře ke kontrole (3): A, B → <url>/kontrola“. */
export function reviewShareText(titles: string[], baseUrl: string): string {
  return `Nové scénáře ke kontrole (${titles.length}): ${titles.join(', ')} → ${baseUrl.replace(/\/$/, '')}/kontrola`;
}

export const whatsappHref = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** „Poslat odkaz“ (share sheet, else clipboard) and a WhatsApp link for any text. */
export function ShareButtons({ title, text, url }: { title: string; text: string; url?: string }) {
  const [note, setNote] = useState<string | null>(null);
  const send = async () => {
    const payload = url ? { title, text, url } : { title, text };
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share(payload).catch(() => undefined);
      return;
    }
    await navigator.clipboard
      .writeText(url ? `${text} ${url}` : text)
      .then(() => setNote('Zkopírováno.'))
      .catch(() => setNote('Kopírování se nepovedlo.'));
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="primary" onClick={() => void send()}>
        Poslat odkaz
      </Button>
      <a
        href={whatsappHref(url ? `${text} ${url}` : text)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-12 items-center rounded-full border border-ink/20 px-5 font-semibold"
      >
        WhatsApp
      </a>
      {note ? (
        <span role="status" className="text-sm text-text2">
          {note}
        </span>
      ) : null}
    </div>
  );
}

/** „Dej vědět Honzovi a Radkovi“ card shown after scripts were sent for review. */
export function ShareReviewCard({ titles, shareUrl, onClose, bare }: { titles: string[]; shareUrl: string | null; onClose?: () => void; bare?: boolean }) {
  const base = shareUrl ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const text = reviewShareText(titles, base);
  return (
    <section aria-label="Dej vědět Honzovi a Radkovi" className="flex flex-col gap-3 rounded-card bg-card p-5 lg:p-6">
      {bare ? null : <h2 className="text-h2">Dej vědět Honzovi a Radkovi</h2>}
      <p className="text-text2">{text}</p>
      <ShareButtons title="Scénáře ke kontrole" text={text} />
      {onClose ? (
        <div>
          <Button type="button" variant="outline" onClick={onClose}>
            Hotovo
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export function ShareReviewDialog({ open, titles, shareUrl, onClose }: { open: boolean; titles: string[]; shareUrl: string | null; onClose: () => void }) {
  return (
    <ReviewDialog open={open} onClose={onClose} title="Dej vědět Honzovi a Radkovi">
      <ShareReviewCard bare titles={titles} shareUrl={shareUrl} onClose={onClose} />
    </ReviewDialog>
  );
}
