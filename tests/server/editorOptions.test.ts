import { beforeAll, describe, expect, it } from 'vitest';
import * as s from '@/db/schema';
import { loadEditorOptions } from '@/server/editorOptions';
import { setupWorld, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await setupWorld();
  await w.db.insert(s.series).values([
    { id: 'ser-b', code: 'S02', name: 'Druhá' },
    { id: 'ser-a', code: 'S01', name: 'První' },
  ]);
});

describe('loadEditorOptions', () => {
  it('returns every picker list as { key, label } sorted by lookup order', async () => {
    const o = await loadEditorOptions(w.db);
    expect(o.categories.map((c) => c.key)).toEqual(['nabor', 'lifestyle', 'trendy', 'produkt']);
    expect(o.categories[0]).toMatchObject({ label: 'Nábor, vedení lidí a práce s týmem', short: 'Nábor', color: '#DCD9FB', textColor: '#3D33B8' });
    expect(o.treatments.map((t) => t.key)).toEqual(['odborne', 'instagramove']);
    expect(o.characters.map((c) => c.key)).toEqual(['osobni', 'pracovni', 'nevztahuje']);
    expect(o.locations).toHaveLength(7);
    expect(o.hookTypes).toHaveLength(9);
    expect(o.ctaTypes.map((c) => c.key)).toEqual(['share', 'save', 'question']);
  });

  it('adds speaker and hashtag to profiles, family and status to formats', async () => {
    const o = await loadEditorOptions(w.db);
    expect(o.profiles.find((p) => p.key === 'radek')).toMatchObject({ label: 'Radek', speaker: 'Radek', hashtag: '#radekteichmann' });
    expect(o.profiles.find((p) => p.key === 'gta-partners')).toMatchObject({ speaker: null, hashtag: null });
    expect(o.formats).toHaveLength(23);
    expect(o.formats.find((f) => f.key === 'kancelarsky-sketch')).toMatchObject({ family: 'Skeč', status: 'verified' });
    expect(o.formats.find((f) => f.key === 'hot-take')).toMatchObject({ family: 'Názor / spor', status: 'untested' });
  });

  it('lists cycles, series (by code) and users (by name)', async () => {
    const o = await loadEditorOptions(w.db);
    expect(o.cycles).toEqual([{ key: '2026-11', label: 'Cyklus 2026–11' }]);
    expect(o.series.map((x) => [x.key, x.label])).toEqual([
      ['ser-a', 'S01 · První'],
      ['ser-b', 'S02 · Druhá'],
    ]);
    expect(o.users.map((u) => u.label)).toEqual([...o.users.map((u) => u.label)].sort((a, b) => a.localeCompare(b, 'cs')));
    expect(o.users.map((u) => u.label)).toContain('Honza');
  });

  it('leaves archived lookups out', async () => {
    await w.db.insert(s.lookupItems).values({ id: 'x-arch', kind: 'location', key: 'stary-sklad', label: 'Starý sklad', archived: true });
    const o = await loadEditorOptions(w.db);
    expect(o.locations.map((l) => l.key)).not.toContain('stary-sklad');
  });
});
