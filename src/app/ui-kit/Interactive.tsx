'use client';

import { useState } from 'react';
import { BottomSheet } from '@/ui/BottomSheet';
import { Button } from '@/ui/Button';
import { Tabs } from '@/ui/Tabs';

export function InteractiveDemo() {
  const [tab, setTab] = useState('v2');
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-start gap-4">
      <Tabs
        label="Verze scénáře"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'v2', label: 'v2 · aktuální' },
          { id: 'diff', label: 'Změny od v1' },
          { id: 'dialog', label: 'Jen dialog' },
        ]}
      />
      <p className="text-text2">Vybráno: {tab}</p>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Otevřít spodní list
      </Button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Ukázkový list">
        <p className="text-text2">Obsah spodního listu. Zavře se Escapem, křížkem nebo klepnutím mimo.</p>
      </BottomSheet>
    </div>
  );
}
