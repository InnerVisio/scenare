import { FileText } from 'lucide-react';
import { getDb } from '@/db/client';
import { can } from '@/domain/policy/can';
import { pragueDay } from '@/domain/format/date';
import { requireActor } from '@/server/auth/session';
import { loadEditorOptions } from '@/server/editorOptions';
import { listVideos } from '@/server/queries';
import { EmptyState } from '@/ui/EmptyState';
import { TopBar } from '@/ui/TopBar';
import { plural } from '../_components/review/model';
import { ListFilters } from './ListFilters';
import { NewScriptButton } from './NewScriptButton';
import { ScriptList } from './ScriptList';
import { parseListQuery } from './listModel';

export const metadata = { title: 'Scénáře – GTA Scénáře' };
export const dynamic = 'force-dynamic';

export default async function ScriptsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  const db = await getDb();
  const options = await loadEditorOptions(db);
  const query = parseListQuery(await searchParams, {
    cycleIds: options.cycles.map((c) => c.key),
    categoryKeys: options.categories.map((c) => c.key),
    seriesIds: options.series.map((s) => s.key),
  });
  const items = await listVideos(db, actor, {
    cycleId: query.cyklus,
    plannedMonth: query.mesic,
    categoryKey: query.kategorie,
    approvalStatus: query.stav,
    productionStatus: query.vyroba,
    seriesId: query.serie,
    q: query.q,
  });
  const filtered = Object.keys(query).length > 0;
  const newButton = can(actor, 'script.create') ? <NewScriptButton cycleId={query.cyklus} plannedMonth={query.mesic} /> : null;

  return (
    <div className="flex flex-col gap-4">
      <TopBar
        title="Scénáře"
        subtitle={`${items.length} ${plural(items.length, 'scénář', 'scénáře', 'scénářů')}${filtered ? ' podle filtrů' : ''}`}
        hidePeriod
      />
      <ListFilters query={query} options={options}>
        {newButton}
      </ListFilters>
      {newButton && <div className="lg:hidden">{newButton}</div>}
      {items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={filtered ? 'Žádný scénář neodpovídá filtrům.' : 'Zatím tu nejsou žádné scénáře.'}
          description={filtered ? 'Zkus filtry uvolnit nebo je zrušit.' : can(actor, 'script.create') ? 'Začni tlačítkem „Nový scénář“.' : undefined}
        />
      ) : (
        <ScriptList items={items} options={options} today={pragueDay(new Date())} />
      )}
    </div>
  );
}
