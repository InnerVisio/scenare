import type { CheckContext } from '@/domain/checks/runChecks';
import type { ScriptBody } from '@/domain/script/types';

/** The V031 review-queue example: 3 scenes (0–11, 11–19, 19–21 s), share CTA on Radek's last line. */
export function v031Body(): ScriptBody {
  return {
    hooks: [
      { id: 'A', hookType: 'otázka', text: 'Banka ti tohle nikdy neřekne.', visual: 'Radek u stolu, zblízka' },
      { id: 'B', hookType: null, text: 'Končí ti fixace? Zpozorni.', visual: 'Klient s papíry' },
    ],
    scenes: [
      {
        id: 's1',
        fromSec: 0,
        toSec: 11,
        visual: 'Kancelář, klient sedí naproti poradcům',
        lines: [
          { id: 'l1', speaker: 'Klient', direction: 'nevzhlédne', text: 'Fixace mi končí za dva měsíce, co mám dělat?' },
          { id: 'l2', speaker: 'Radek', direction: 'do kamery', text: 'Hlavně nečekej na nabídku od své banky.' },
        ],
      },
      {
        id: 's2',
        fromSec: 11,
        toSec: 19,
        visual: 'Záběr na notebook s porovnáním sazeb',
        lines: [
          { id: 'l3', speaker: 'Honza', direction: '', text: 'My porovnáme všechny banky a vyjednáme lepší sazbu.' },
          { id: 'l4', speaker: 'Klient', direction: 'úleva', text: 'A to opravdu stačí?' },
        ],
      },
      {
        id: 's3',
        fromSec: 19,
        toSec: 21,
        visual: 'Radek a Honza společně do kamery',
        lines: [
          { id: 'l5', speaker: 'Honza', direction: '', text: 'Stačí se ozvat s předstihem.' },
          { id: 'l6', speaker: 'Radek', direction: 'do kamery', text: 'Pošli to kolegovi, kterému letos končí fixace.' },
        ],
      },
    ],
    cta: { lineId: 'l6', ctaType: 'share' },
    caption: 'Fixace končí? Nenech to na poslední chvíli.',
    hashtags: ['#vaskonzultant', '#radekteichmann', '#honzagizicky', '#hypoteka'],
    viewerLearns: 'Že se vyplatí řešit fixaci s předstihem a porovnat nabídky bank.',
    source: 'Interní analýza sazeb, říjen 2026',
    differsFromLast3: 'Poprvé řešíme fixaci z pohledu klienta.',
  };
}

export function v031Context(overrides: Partial<CheckContext> = {}): CheckContext {
  return {
    body: v031Body(),
    goalMetric: 'shares',
    isSeriesEpisode: false,
    formatStatus: 'verified',
    isTrialReel: false,
    numberChecks: [],
    personHashtags: { Radek: '#radekteichmann', Honza: '#honzagizicky' },
    manualChecks: {},
    ...overrides,
  };
}
