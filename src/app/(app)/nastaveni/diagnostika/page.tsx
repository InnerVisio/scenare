import { sql } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { can } from '@/domain/policy/can';
import { requireActor } from '@/server/auth/session';
import { getDashboard } from '@/server/queries';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { TopBar } from '@/ui/TopBar';

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

  const rows: [string, string][] = [
    ['Region funkce (Vercel)', process.env.VERCEL_REGION ?? 'lokálně'],
    ['Region databáze', databaseRegion(process.env.DATABASE_URL)],
    ['Připojení k databázi', `${connectMs} ms`],
    ['Jeden dotaz (3×)', pings.map((ms) => `${ms} ms`).join(' · ')],
    ['Načtení nástěnky', `${dashboardMs} ms`],
  ];
  return (
    <>
      <TopBar title="Diagnostika" hidePeriod />
      <Card className="max-w-xl">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-text2">{label}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}
