import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { can } from '@/domain/policy/can';
import { requireActor } from '@/server/auth/session';
import { appUrl } from '@/server/appUrl';
import { countScriptsPerCycle, getSettings, getTeamLinkSecret, listCycles, listLookups, listUsers } from '@/server/settings';
import { EmptyState } from '@/ui/EmptyState';
import { TopBar } from '@/ui/TopBar';
import { LOOKUP_KINDS } from './lookupKinds';
import { SettingsForms } from './SettingsForms';

export const metadata = { title: 'Nastavení – GTA Scénáře' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const actor = await requireActor();
  if (actor.role === 'leadership') redirect('/');
  if (!can(actor, 'settings.manage')) {
    return (
      <>
        <TopBar title="Nastavení" hidePeriod />
        <EmptyState title="Sem nemáš přístup." description="Nastavení spravuje admin." />
      </>
    );
  }
  const db = await getDb();
  const [teamSecret, settings, cycles, scriptCounts, users, rules, ...lookups] = await Promise.all([
    getTeamLinkSecret(db),
    getSettings(db),
    listCycles(db),
    countScriptsPerCycle(db),
    listUsers(db),
    listLookups(db, 'check_rule'),
    ...LOOKUP_KINDS.map((k) => listLookups(db, k.kind)),
  ]);
  const base = (appUrl() ?? 'http://localhost:3000').replace(/\/+$/, '');
  return (
    <>
      <TopBar title="Nastavení" hidePeriod />
      <SettingsForms
        today={new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date())}
        settings={settings}
        teamLink={{ url: teamSecret ? `${base}/tym/${teamSecret}` : null, base }}
        cycles={cycles.map((c) => ({ id: c.id, shootDate: c.shootDate, plannedVideos: c.plannedVideos, note: c.note, scripts: scriptCounts[c.id] ?? 0 }))}
        users={users}
        rules={rules}
        lookups={Object.fromEntries(LOOKUP_KINDS.map((k, i) => [k.kind, lookups[i]]))}
      />
    </>
  );
}
