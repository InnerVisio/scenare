'use client';

import {
  Ellipsis,
  FileText,
  Home,
  Layers,
  ListChecks,
  ScrollText,
  Send,
  SlidersHorizontal,
  Video,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { cn, focusRing } from './cn';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: boolean;
}

const MAIN_ITEMS: NavItem[] = [
  { href: '/', label: 'Přehled', icon: Home },
  { href: '/kontrola', label: 'Ke kontrole', icon: ListChecks, badge: true },
  { href: '/scenare', label: 'Scénáře', icon: FileText },
  { href: '/serie', label: 'Série', icon: Layers },
  { href: '/nataceni', label: 'Natáčecí den', icon: Video },
  { href: '/publikace', label: 'Publikace', icon: Send },
];
const SETTINGS_ITEM: NavItem = { href: '/nastaveni', label: 'Nastavení', icon: SlidersHorizontal };

const TAB_ITEMS: NavItem[] = [
  { href: '/', label: 'Přehled', icon: Home },
  { href: '/kontrola', label: 'Kontrola', icon: ListChecks, badge: true },
  { href: '/scenare', label: 'Scénáře', icon: FileText },
  { href: '/nataceni', label: 'Natáčení', icon: Video },
];
const MORE_ITEMS: NavItem[] = [
  { href: '/serie', label: 'Série', icon: Layers },
  { href: '/publikace', label: 'Publikace', icon: Send },
  SETTINGS_ITEM,
];

export const isActivePath = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

/** The review screen and the script editor bring their own bottom bar, so the tab bar stays out of the way. */
export const hidesTabBar = (pathname: string) => /^\/(kontrola\/[^/]+|scenare\/[^/]+\/upravit)/.test(pathname);

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className={cn(
        'absolute flex min-w-5 items-center justify-center rounded-full bg-lime px-1 text-[11px] leading-5 font-bold text-ink',
        className,
      )}
    >
      {count}
    </span>
  );
}

function RailLink({ item, active, queueCount }: { item: NavItem; active: boolean; queueCount: number }) {
  const Icon = item.icon;
  const count = item.badge ? queueCount : 0;
  return (
    <Link
      href={item.href}
      aria-label={count > 0 ? `${item.label}, ${count} čeká` : item.label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex size-12 items-center justify-center rounded-full transition-colors',
        focusRing,
        active ? 'bg-card text-ink' : 'text-card/80 hover:bg-ink2 hover:text-card',
      )}
    >
      <Icon aria-hidden className="size-[22px]" strokeWidth={1.75} />
      <CountBadge count={count} className="-top-1 -right-1" />
    </Link>
  );
}

/** Dark ink rail (desktop). `fixed` can be turned off to preview it inline (ui-kit). */
export function SidebarRail({
  pathname,
  queueCount,
  fixed = true,
}: {
  pathname: string;
  queueCount: number;
  fixed?: boolean;
}) {
  return (
    <aside
      aria-label="Hlavní navigace"
      className={cn(
        'z-30 w-[76px] flex-col items-center gap-3 rounded-card bg-ink px-3 py-4',
        fixed ? 'fixed top-4 bottom-4 left-4 hidden md:flex' : 'flex h-[560px]',
      )}
    >
      <Link
        href="/"
        aria-label="GTA Scénáře, přehled"
        className={cn('mb-4 flex size-12 items-center justify-center rounded-inner bg-lime text-ink', focusRing)}
      >
        <ScrollText aria-hidden className="size-6" strokeWidth={2} />
      </Link>
      <nav className="flex flex-col items-center gap-3">
        {MAIN_ITEMS.map((item) => (
          <RailLink key={item.href} item={item} active={isActivePath(pathname, item.href)} queueCount={queueCount} />
        ))}
      </nav>
      <div className="mt-auto">
        <RailLink item={SETTINGS_ITEM} active={isActivePath(pathname, SETTINGS_ITEM.href)} queueCount={0} />
      </div>
    </aside>
  );
}

function TabLink({ item, active, queueCount }: { item: NavItem; active: boolean; queueCount: number }) {
  const Icon = item.icon;
  const count = item.badge ? queueCount : 0;
  return (
    <Link
      href={item.href}
      aria-label={count > 0 ? `${item.label}, ${count} čeká` : item.label}
      aria-current={active ? 'page' : undefined}
      className={cn('flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-inner text-[11px] font-semibold', focusRing, active ? 'text-lime' : 'text-card/75')}
    >
      <span className={cn('relative flex h-8 w-12 items-center justify-center rounded-full', active && 'bg-card text-ink')}>
        <Icon aria-hidden className="size-5" strokeWidth={1.75} />
        <CountBadge count={count} className="-top-1 right-0" />
      </span>
      {item.label}
    </Link>
  );
}

/** Bottom tab bar (below 768 px) with a „Více“ sheet. `fixed` can be turned off for inline preview. */
export function TabBar({
  pathname,
  queueCount,
  fixed = true,
}: {
  pathname: string;
  queueCount: number;
  fixed?: boolean;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_ITEMS.some((item) => isActivePath(pathname, item.href));
  return (
    <>
      <nav
        aria-label="Hlavní navigace"
        className={cn(
          'z-30 flex items-stretch gap-1 bg-ink px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]',
          fixed ? 'fixed inset-x-0 bottom-0 rounded-t-card md:hidden' : 'rounded-card',
        )}
      >
        {TAB_ITEMS.map((item) => (
          <TabLink key={item.href} item={item} active={isActivePath(pathname, item.href)} queueCount={queueCount} />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="Více"
          aria-haspopup="dialog"
          className={cn('flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-inner text-[11px] font-semibold', focusRing, moreActive ? 'text-lime' : 'text-card/75')}
        >
          <span className={cn('flex h-8 w-12 items-center justify-center rounded-full', moreActive && 'bg-card text-ink')}>
            <Ellipsis aria-hidden className="size-5" strokeWidth={1.75} />
          </span>
          Více
        </button>
      </nav>
      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Více">
        <ul className="flex flex-col gap-2">
          {MORE_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn('flex min-h-14 items-center gap-3 rounded-inner px-4 font-semibold', focusRing, active ? 'bg-ink text-card' : 'bg-nest')}
                >
                  <Icon aria-hidden className="size-5" strokeWidth={1.75} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}

/** Rail on desktop, tab bar on phones. */
export function Sidebar({ queueCount }: { queueCount: number }) {
  const pathname = usePathname();
  return (
    <>
      <SidebarRail pathname={pathname} queueCount={queueCount} />
      {!hidesTabBar(pathname) && <TabBar pathname={pathname} queueCount={queueCount} />}
    </>
  );
}
