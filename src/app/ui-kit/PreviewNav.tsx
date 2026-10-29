'use client';

import { SidebarRail, TabBar } from '@/ui/Sidebar';

export function PreviewNav() {
  return (
    <div className="flex flex-wrap items-start gap-6">
      <SidebarRail pathname="/kontrola" queueCount={6} fixed={false} />
      <div className="w-full max-w-sm">
        <TabBar pathname="/scenare" queueCount={6} fixed={false} />
      </div>
    </div>
  );
}
