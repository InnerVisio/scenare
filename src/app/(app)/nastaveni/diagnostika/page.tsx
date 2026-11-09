import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/db/client';
import * as s from '@/db/schema';
import { formatDate } from '@/domain/format/date';
import { can } from '@/domain/policy/can';
import { passwordLoginEnabled } from '@/server/auth/passwordLogin';
import { requireActor } from '@/server/auth/session';
import { getDashboard } from '@/server/queries';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { TopBar } from '@/ui/TopBar';
import { TestMailButton } from './TestMailButton';

export const metadata = { title: 'Diagnostika – GTA Scénáře' };
export const dynamic = 'force-dynamic';

/** Region part of the database host only (e.g. `eu-central-1`) — never the credentials. */
function databaseRegion(url: string | undefined): string {
  if (!url) return 'PGlite (lokální)';
  try {
    const host = new URL(url).hostname;
    return host.match(/\.([a-z]{2}-[a-z]+-\d)\./)?.[1] ?? host.split('.').slice(-3).join('.');
  } catch {
    return 'neznámý';
  }
}

async function timed<T>(run: () => Promise<T>): Promise<number> {
  const start = performance.now();
  await run();
  return Math.round(performance.now() - start);
}

export default async function DiagnosticsPage() {
  const actor = await requireActor();
  if (!can(actor, 'settings.manage')) {
    return (
      <>
        <TopBar title="Diagnostika" hidePeriod />
        <EmptyState title="Sem nemáš přístup." description="Diagnostiku vidí admin." />
      </>
    );
  }
  const connectMs = await timed(() => getDb());
  const db = await getDb();
  const pings: number[] = [];
  for (let i = 0; i < 3; i++) pings.push(await timed(() => db.execute(sql`select 1`)));
  const dashboardMs = await timed(() => getDashboard(db, actor, new Date()));
  const [dailyRun] = await db.select().from(s.jobRuns).where(eq(s.jobRuns.key, 'daily'));

  const rows: [string, string][] = [
    ['Region funkce (Vercel)', process.env.VERCEL_REGION ?? 'lokálně'],
    ['Region databáze', databaseRegion(process.env.DATABASE_URL)],
    ['Připojení k databázi', `${connectMs} ms`],
    ['Jeden dotaz (3×)', pings.map((ms) => `${ms} ms`).join(' · ')],
    ['Načtení nástěnky', `${dashboardMs} ms`],
    ['E-maily', process.env.RESEND_API_KEY ? 'Resend zapnutý' : 'jen testovací výpis (chybí RESEND_API_KEY)'],
    ['Plánovač', `CRON_SECRET nastaven: ${process.env.CRON_SECRET ? 'ano' : 'ne'}`],
    ['Poslední denní souhrn', dailyRun ? formatDate(new Date(`${dailyRun.ranOn}T12:00:00Z`)) : 'zatím neběžel'],
  ];
  rows.push(['Přihlášení heslem', passwordLoginEnabled() ? 'zapnuté' : 'vypnuté']);
  const devLoginOpen = process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_LOGIN === '1';
  return (
    <>
      <TopBar title="Diagnostika" hidePeriod />
      <Card className="max-w-xl">
        {devLoginOpen ? (
          <p role="alert" className="mb-4 rounded-inner bg-nest p-4 font-semibold text-coral">
            Vývojové přihlášení je zapnuté — kdokoli se může přihlásit jako kdokoli. Po rozdání odkazů ho ve Vercelu vypni (smaž ALLOW_DEV_LOGIN).
          </p>
        ) : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-text2">{label}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6">
          <TestMailButton />
        </div>
      </Card>
    </>
  );
}
