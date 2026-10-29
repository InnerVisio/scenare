import { getDb } from '@/db/client';
import { can } from '@/domain/policy/can';
import { requireActor } from '@/server/auth/session';
import { getSettings, listCycles, listLookups, listUsers } from '@/server/settings';
import { EmptyState } from '@/ui/EmptyState';
import { TopBar } from '@/ui/TopBar';
import { LOOKUP_KINDS } from './lookupKinds';
import { SettingsForms } from './SettingsForms';

export const metadata = { title: 'Nastavení – GTA Scénáře' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const actor = await requireActor();
  if (!can(actor, 'settings.manage')) {
    return (
      <>
        <TopBar title="Nastavení" hidePeriod />
        <EmptyState title="Sem nemáš přístup." description="Nastavení spravuje admin." />
      </>
    );
  }
  const db = await getDb();
  const [settings, cycles, users, rules, ...lookups] = await Promise.all([
    getSettings(db),
    listCycles(db),
    listUsers(db),
    listLookups(db, 'check_rule'),
    ...LOOKUP_KINDS.map((k) => listLookups(db, k.kind)),
  ]);
  return (
    <>
      <TopBar title="Nastavení" hidePeriod />
      <SettingsForms
        settings={settings}
        cycles={cycles.map((c) => ({ id: c.id, shootDate: c.shootDate, plannedVideos: c.plannedVideos, clipTarget: c.clipTarget }))}
        users={users}
        rules={rules}
        lookups={Object.fromEntries(LOOKUP_KINDS.map((k, i) => [k.kind, lookups[i]]))}
      />
    </>
  );
}
