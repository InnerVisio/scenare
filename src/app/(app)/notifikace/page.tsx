import { BellOff } from 'lucide-react';
import { getDb } from '@/db/client';
import { formatRelative } from '@/domain/format/date';
import { requireActor } from '@/server/auth/session';
import { listNotifications } from '@/server/queries';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { TopBar } from '@/ui/TopBar';
import { NotificationLink } from '../_components/NotificationBell';

export const metadata = { title: 'Upozornění – GTA Scénáře' };
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const actor = await requireActor();
  const now = new Date();
  const items = await listNotifications(await getDb(), actor, { limit: 100 });
  return (
    <>
      <TopBar title="Upozornění" hidePeriod />
      {items.length === 0 ? (
        <EmptyState icon={BellOff} title="Zatím žádná upozornění." description="Až se u scénářů něco stane, uvidíš to tady." />
      ) : (
        <Card className="p-2 md:p-3">
          <ul className="list-none">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationLink item={{ id: n.id, text: n.text, href: n.href, read: n.readAt !== null, when: formatRelative(n.createdAt, now) }} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
