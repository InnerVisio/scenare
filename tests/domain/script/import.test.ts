import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { basicParse, splitScripts, suggestProfile } from '@/domain/script/import';

const real = (n: number) => readFileSync(`tests/fixtures/scripts/real-${n}.txt`, 'utf8');

export const LABELLED = `Klient s chybou: fixace hypotéky

HOOK A: Tohle ti banka neřekne.
[Radek u stolu s papíry]
HOOK B – Fixace, která tě stála 200 tisíc.

SCÉNA 1 (0–2 s)
[Radek se podívá do kamery]
Radek (do kamery): Víš, kolik ti banka sebrala?

SCÉNA 2 (2–12 s)
Honza: Spočítal jsem to a vyšlo mi to hůř.
Klient: To snad ne!

SCÉNA 3 (12–20 s)
Radek: Pošli to kolegovi, který řeší hypotéku.

Divák se dozví: Že fixace se dá vyjednat.
Zdroj: ČNB, 2026
Popisek: Fixace hypotéky bez stresu.
Druhý řádek popisku.

#VášKonzultant #hypotéka #Fixace`;

describe('basicParse', () => {
  it('splits a labelled script', () => {
    const { body, title, warnings } = basicParse(LABELLED);
    expect(title).toBe('Klient s chybou: fixace hypotéky');
    expect(body.hooks.map((h) => [h.id, h.text])).toEqual([
      ['A', 'Tohle ti banka neřekne.'],
      ['B', 'Fixace, která tě stála 200 tisíc.'],
    ]);
    expect(body.hooks[0]!.visual).toBe('Radek u stolu s papíry');
    expect(body.scenes).toHaveLength(3);
    expect(body.scenes.map((s) => [s.fromSec, s.toSec])).toEqual([[0, 2], [2, 12], [12, 20]]);
    expect(body.scenes[0]!.visual).toBe('Radek se podívá do kamery');
    expect(body.scenes[0]!.lines[0]).toMatchObject({ speaker: 'Radek', direction: 'do kamery', text: 'Víš, kolik ti banka sebrala?' });
    expect(body.scenes[1]!.lines.map((l) => l.speaker)).toEqual(['Honza', 'Klient']);
    const last = body.scenes[2]!.lines[0]!;
    expect(body.cta).toEqual({ lineId: last.id, ctaType: 'share' });
    expect(body.viewerLearns).toBe('Že fixace se dá vyjednat.');
    expect(body.source).toBe('ČNB, 2026');
    expect(body.caption).toBe('Fixace hypotéky bez stresu.\nDruhý řádek popisku.');
    expect(body.hashtags).toEqual(['#váškonzultant', '#hypotéka', '#fixace']);
    expect(warnings).toEqual([]);
  });

  it('uses blank-line blocks as scenes when there are no markers', () => {
    const { body, warnings } = basicParse(`Radek: Ahoj, tady Radek.\nHonza: A já Honza.\n\nKlient: Chci radu.\n\nRadek: Ulož si to na později.`);
    expect(body.scenes).toHaveLength(3);
    expect(body.scenes[0]!.lines.map((l) => l.text)).toEqual(['Ahoj, tady Radek.', 'A já Honza.']);
    expect(body.cta?.ctaType).toBe('save');
    expect(body.hooks.every((h) => h.text === '')).toBe(true);
    expect(warnings.join(' ')).not.toContain('časy');
  });

  it('parses timecodes', () => {
    const { body } = basicParse(`00:02–00:12\nRadek: Dobrý den.\n[0-2s] Honza: Ahoj`);
    expect(body.scenes.map((s) => [s.fromSec, s.toSec])).toEqual([[2, 12], [0, 2]]);
    expect(body.scenes[1]!.lines[0]).toMatchObject({ speaker: 'Honza', text: 'Ahoj' });
  });

  it('copes with messy WhatsApp copy', () => {
    const { body } = basicParse(`🎬 Radek: Ahoj 👋 dnes o hypotékách!\n(střih na tabuli)\nZáběr na telefon\nTohle je volný text bez mluvčího\nHonza – ano 😅 komentuj, co si myslíš`);
    const lines = body.scenes[0]!.lines;
    expect(lines[0]).toMatchObject({ speaker: 'Radek', text: 'Ahoj 👋 dnes o hypotékách!' });
    expect(body.scenes[0]!.visual).toBe('střih na tabuli\nZáběr na telefon\nTohle je volný text bez mluvčího');
    expect(lines[1]).toMatchObject({ speaker: 'Honza', text: 'ano 😅 komentuj, co si myslíš' });
    expect(body.scenes[0]!.visual).toContain('Tohle je volný text bez mluvčího');
    expect(body.cta).toEqual({ lineId: lines[1]!.id, ctaType: 'question' });
  });

  it('parses real script 1 (numbered quoted title, narration, cuts)', () => {
    const { body, title, warnings } = basicParse(real(1));
    expect(title).toBe('Do plánu ti chybí jedna pojistka');
    expect(body.scenes).toHaveLength(2);
    expect(body.scenes[0]!.visual).toMatch(/^Radek hraje vedoucího banky\./);
    expect(body.scenes[0]!.lines.map((l) => [l.speaker, l.text])).toEqual([
      ['Radek', 'Počkej, tys mu tu pojistku nenabídla?'],
      ['Bankéřka', 'On už ji má. Dneska se přišel zeptat, jestli ji potřebuje měnit.'],
      ['Radek', 'No a co ta jedna, co ti chybí do plánu?'],
    ]);
    expect(body.scenes[1]!.visual).toMatch(/^Bankéřka sedí u Honzy/);
    expect(body.scenes[1]!.lines).toHaveLength(4);
    expect(body.scenes[1]!.lines[3]!.text).toBe('On má jasno. Od toho tam jsme. Klientům se snažíme pomoct a poradit, ne z nich jen vydělat.');
    expect(body.hooks.every((h) => h.text === '')).toBe(true);
    expect(warnings).not.toContain('Doplň časy scén v editoru.');
  });

  it('parses real script 2 (leading spaces, directions, CTA)', () => {
    const { body, title } = basicParse(real(2));
    expect(title).toBe('OSVČ na neschopence nesmí pracovat');
    const lines = body.scenes[0]!.lines;
    expect(lines[0]).toMatchObject({ speaker: 'Radek', direction: 'na gauči, kapesníky, notebook na kolenou, do telefonu' });
    expect(lines[0]!.text).toMatch(/^Jasně, pane Nováku/);
    expect(lines[1]).toMatchObject({ speaker: 'Honza', direction: 'vejde', text: 'Ty jsi na neschopence.' });
    expect(lines[8]).toMatchObject({ speaker: 'Radek', direction: 'zaklapne notebook', text: '…A co jako mám dělat?' });
    const last = lines[lines.length - 1]!;
    expect(last).toMatchObject({ speaker: 'Honza', direction: 'do kamery' });
    expect(body.cta).toEqual({ lineId: last.id, ctaType: 'share' });
  });

  it('parses real script 3 (no title line, TITULEK, hashtags, odd quotes)', () => {
    const { body, title } = basicParse(real(3));
    expect(title).toBe('Komu patří tví klienti, když odejdeš? Zeptej se dřív, než podepíšeš.');
    expect(body.hooks).toHaveLength(1);
    expect(body.hooks[0]).toMatchObject({ id: 'A', visual: title });
    expect(body.hooks[0]!.text).toBe('');
    expect(body.scenes[0]!.visual).toBe('Honza z VK × Radek z konkurence');
    const all = body.scenes.flatMap((s) => s.lines);
    expect(all.find((l) => l.text.startsWith('A ty, ty'))!.text).toBe('A ty, ty s takovým přístupem shoř');
    expect(body.scenes.some((s) => s.visual.includes('RADEK ZAČNE HOŘET skrze AI video'))).toBe(true);
    expect(body.hashtags).toEqual(['#vaskonzultant', '#honzagizicky', '#radekteichmann', '#ceskefinance', '#kariera']);
    expect(body.cta?.ctaType).toBe('share');
    expect(suggestProfile(body, [{ key: 'radek', speaker: 'Radek', hashtag: '#radekteichmann' }, { key: 'honza', speaker: 'Honza', hashtag: '#honzagizicky' }])).toBe('honza');
  });
});

describe('splitScripts', () => {
  it('splits numbered scripts', () => {
    expect(splitScripts(`${real(1)}\n${real(2)}`)).toHaveLength(2);
  });
  it('splits at separator lines', () => {
    const parts = splitScripts(`${real(2)}\n---\n${real(3)}`);
    expect(parts).toHaveLength(2);
    expect(basicParse(parts[1]!).title).toMatch(/^Komu patří/);
  });
  it('keeps one script whole', () => {
    expect(splitScripts(real(3))).toHaveLength(1);
  });
});
