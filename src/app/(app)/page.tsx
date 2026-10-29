import { requireActor } from '@/server/auth/session';
import { Card } from '@/ui/Card';
import { TopBar } from '@/ui/TopBar';

export default async function HomePage() {
  const actor = await requireActor();
  return (
    <>
      <TopBar title="Přehled" subtitle={`Přihlášen jako ${actor.name}`} />
      <Card>
        <h2 className="text-h2">Přehled se připravuje</h2>
        <p className="mt-1 text-text2">Tady bude souhrn cyklu, fronta ke kontrole a otevřené připomínky.</p>
      </Card>
    </>
  );
}
