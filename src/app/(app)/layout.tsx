import { getDb } from '@/db/client';
import { formatRelative } from '@/domain/format/date';
import { loadShellData } from '@/server/shell';
import { requireActor } from '@/server/auth/session';
import { ROLE_LABELS } from '@/ui/roles';
import { ShellProvider } from '@/ui/ShellContext';
import { Sidebar } from '@/ui/Sidebar';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const actor = await requireActor();
  const db = await getDb();
  const now = new Date();
  const shell = await loadShellData(db, actor, now);

  return (
    <ShellProvider
      value={{
        user: { name: shell.user.name, initials: shell.user.initials, roleLabel: ROLE_LABELS[shell.user.role] },
        leadership: shell.user.role === 'leadership',
        unread: shell.unread,
        notifications: shell.notifications.map((n) => ({
          id: n.id,
          text: n.text,
          href: n.href,
          read: n.readAt !== null,
          when: formatRelative(n.createdAt, now),
        })),
        cycleIds: shell.cycleIds,
        defaultCycleId: shell.defaultCycleId,
        currentMonth: shell.currentMonth,
      }}
    >
      <Sidebar queueCount={shell.queueCount} leadership={shell.user.role === 'leadership'} />
      <main className="mx-auto w-full max-w-[1600px] px-4 pt-5 pb-28 md:pt-8 md:pr-8 md:pb-10 md:pl-[116px]">{children}</main>
    </ShellProvider>
  );
}
