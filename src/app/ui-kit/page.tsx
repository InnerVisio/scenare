import { Plus } from 'lucide-react';
import { APPROVAL_STATUSES } from '@/domain/workflow/approval';
import { Avatar } from '@/ui/Avatar';
import { Button, ButtonLink } from '@/ui/Button';
import { Card, CardTitle } from '@/ui/Card';
import { CategoryTag } from '@/ui/CategoryTag';
import { EmptyState } from '@/ui/EmptyState';
import { FormatTag } from '@/ui/FormatTag';
import { ShellProvider } from '@/ui/ShellContext';
import { StatusPill } from '@/ui/StatusPill';
import { TopBar } from '@/ui/TopBar';
import { InteractiveDemo } from './Interactive';
import { PreviewNav } from './PreviewNav';

export const metadata = { title: 'UI kit – GTA Scénáře' };
export const dynamic = 'force-dynamic';

const CATEGORIES = [
  { key: 'nabor', label: 'Nábor, vedení lidí a práce s týmem', short: 'Nábor', color: '#DCD9FB', textColor: '#3D33B8' },
  { key: 'lifestyle', label: 'Osobní brand & Lifestyle', short: 'Lifestyle', color: '#FFD9E6', textColor: '#A3274F' },
  { key: 'trendy', label: 'Trendy a reakce na trh', short: 'Trendy', color: '#CFF3E1', textColor: '#1C6B49' },
  { key: 'produkt', label: 'Produktové a prodejní tipy', short: 'Produkt', color: '#FFF1B8', textColor: '#7A5A00' },
];

const SWATCHES = [
  ['Levandule', '#E7E5F3'],
  ['Inkoust', '#17151F'],
  ['Limetka', '#D9F36A'],
  ['Fialka', '#5B4FD6'],
  ['Karta', '#FFFFFF'],
  ['Vnoření', '#F4F3FA'],
  ['Text 2', '#5B5870'],
  ['Korál', '#FF5C8A'],
  ['Meruňka', '#FFB45C'],
  ['Inkoust 2', '#2E2B3D'],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardTitle className="mb-4">{title}</CardTitle>
      {children}
    </Card>
  );
}

export default function UiKitPage() {
  return (
    <ShellProvider
      value={{
        user: { name: 'Honza', initials: 'H', roleLabel: 'Vedení' },
        unread: 3,
        cycleIds: ['2026-11', '2026-12'],
        defaultCycleId: '2026-11',
        currentMonth: '2026-11',
      }}
    >
      <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 md:py-10">
        <TopBar title="UI kit" subtitle="Komponenty a varianty designového systému" />

        <Section title="Barvy">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {SWATCHES.map(([name, hex]) => (
              <li key={hex} className="flex flex-col gap-1.5 text-sm">
                <span className="h-14 rounded-inner border border-ink/10" style={{ backgroundColor: hex }} />
                <span className="font-semibold">{name}</span>
                <span className="text-text2">{hex}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Typografie">
          <div className="flex flex-col gap-2">
            <p className="text-h1 md:text-display">Dobré ráno, Honzo</p>
            <p className="text-h1">Klient s chybou: fixace</p>
            <p className="text-h2">Tematický mix</p>
            <p className="text-script">Ke dni konce fixace splácíš bez poplatku.</p>
            <p className="text-label tracking-[0.04em] text-violet uppercase">Natáčecí cyklus 2026–11</p>
          </div>
        </Section>

        <Section title="Tlačítka">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="approve">Schválit</Button>
            <Button variant="primary">Začít kontrolu</Button>
            <Button variant="danger">Vrátit k dopracování</Button>
            <Button variant="outline">Porovnat verze</Button>
            <Button variant="ghost">Zrušit</Button>
            <Button variant="icon" aria-label="Přidat">
              <Plus aria-hidden className="size-5" />
            </Button>
            <Button variant="primary" disabled>
              Zakázáno
            </Button>
            <ButtonLink variant="outline" href="/">
              Odkaz jako tlačítko
            </ButtonLink>
          </div>
          <p className="mt-4 max-w-xl text-sm text-text2">
            Limetka je vyhrazená pro schválení a hlavní akci obrazovky. Na jedné obrazovce max. jedno limetkové tlačítko. Výška 48 px.
          </p>
        </Section>

        <Section title="Stavy schválení">
          <div className="flex flex-wrap gap-3">
            {APPROVAL_STATUSES.map((status) => (
              <StatusPill key={status} status={status} />
            ))}
          </div>
        </Section>

        <Section title="Kategorie a formát">
          <div className="flex flex-wrap gap-3">
            {CATEGORIES.map((c) => (
              <CategoryTag key={c.key} categoryKey={c.key} label={c.label} colors={c} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {CATEGORIES.map((c) => (
              <CategoryTag key={c.key} categoryKey={c.key} label={c.label} short={c.short} colors={c} />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <FormatTag kind="verified">ověřený</FormatTag>
            <FormatTag kind="test">Nový test · Trial Reel</FormatTag>
            <FormatTag kind="series">Série S02 · díl 3</FormatTag>
          </div>
        </Section>

        <Section title="Avatar">
          <div className="flex items-center gap-3">
            <Avatar initials="H" size="sm" />
            <Avatar initials="R" tone="lavender" />
            <Avatar initials="MA" size="lg" tone="ink" />
          </div>
        </Section>

        <Section title="Karty">
          <div className="grid gap-4 md:grid-cols-4">
            <Card tone="lime">
              <p className="text-label tracking-[0.04em] uppercase">Čeká na tvou kontrolu</p>
              <p className="text-display">6</p>
            </Card>
            <Card tone="dark">
              <p className="text-h2">Otevřené připomínky</p>
              <Card tone="dark" inner className="mt-3 bg-ink2">
                V031 · Radek
              </Card>
            </Card>
            <Card tone="light" className="border border-ink/10">
              Bílá karta
            </Card>
            <Card tone="nest">Vnoření</Card>
          </div>
        </Section>

        <Section title="Záložky a spodní list">
          <InteractiveDemo />
        </Section>

        <Section title="Navigace (náhled)">
          <PreviewNav />
        </Section>

        <EmptyState title="Připravujeme" description="Prázdný stav s popisem." />
      </main>
    </ShellProvider>
  );
}
