import type { Metadata } from 'next';
import { getDb } from '@/db/client';
import { formatDate } from '@/domain/format/date';
import { authSecret } from '@/server/auth/jwt';
import { loadCrewPackage } from '@/server/shooting';
import { PrintButton } from './PrintButton';

export const metadata: Metadata = { title: 'Podklady pro štáb – GTA Scénáře', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function CrewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const pack = await loadCrewPackage(await getDb(), decodeURIComponent(token), authSecret(), new Date()).catch(() => null);
  if (!pack) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-3 px-4 py-10">
        <h1 className="text-h1">Odkaz už není platný</h1>
        <p className="text-text2">Odkaz pro štáb je neplatný nebo mu vypršela platnost (platí 14 dní). Požádej o nový odkaz.</p>
      </main>
    );
  }
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 print:max-w-none print:px-0 print:py-0">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h1">Natáčecí den</h1>
          <p className="text-text2">
            Cyklus {pack.cycleId.replace('-', '–')}
            {pack.shootDate ? ` · ${formatDate(new Date(`${pack.shootDate}T12:00:00Z`))}` : ''}
          </p>
        </div>
        <PrintButton />
      </header>
      {pack.groups.length === 0 && <p className="text-text2">Zatím nejsou schválené žádné scénáře.</p>}
      {pack.groups.map((group) => (
        <section key={group.key ?? 'none'} aria-label={group.label} className="flex flex-col gap-4">
          <h2 className="text-h2 border-b border-ink/15 pb-1">{group.label}</h2>
          {group.castGroups.map((cast) => (
            <div key={cast.label} className="flex flex-col gap-4">
              <h3 className="font-semibold text-violet">{cast.label}</h3>
              {cast.items.map((item) => (
                <article key={item.id} className="flex flex-col gap-2 rounded-card bg-card p-4 break-inside-avoid print:rounded-none print:border print:border-ink/20 print:bg-white">
                  <h4 className="font-semibold">
                    <span className="text-text2">{item.code}</span> · {item.title}
                  </h4>
                  {item.props && <p className="text-sm text-text2">Rekvizity: {item.props}</p>}
                  {item.hooks.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {item.hooks.map((h) => (
                        <li key={h.id}>
                          <b>Háček {h.id}:</b> {h.text}
                          {h.visual && <span className="text-text2"> (obraz: {h.visual})</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  <ol className="flex flex-col gap-1.5" aria-label="Mluvený text">
                    {item.lines.map((l, i) => (
                      <li key={i}>
                        <b>{l.speaker || 'Mluví'}:</b> {l.text}
                        {l.direction && <i className="text-text2"> ({l.direction})</i>}
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
