import { COMMENT_TYPES, COMMENT_TYPE_LABELS } from '@/domain/workflow/comments';
import { DEFAULT_RULES } from '@/domain/checks/rules';

export interface LookupSeed {
  kind: string;
  key: string;
  label: string;
  data: Record<string, unknown>;
  sortOrder: number;
}

type Row = Omit<LookupSeed, 'kind' | 'sortOrder'>;

function rows(kind: string, items: Row[]): LookupSeed[] {
  return items.map((item, i) => ({ kind, sortOrder: (i + 1) * 10, ...item }));
}

const categories = rows('category', [
  {
    key: 'nabor',
    label: 'Nábor, vedení lidí a práce s týmem',
    data: {
      share: 0.3,
      short: 'Nábor',
      color: '#DCD9FB',
      textColor: '#3D33B8',
      description:
        'Firemní kultura, mentoring, práce asistentek, vzdělávání, manažerský růst, atraktivita kariérní příležitosti.',
    },
  },
  {
    key: 'lifestyle',
    label: 'Osobní brand & Lifestyle',
    data: {
      share: 0.4,
      short: 'Lifestyle',
      color: '#FFD9E6',
      textColor: '#B3264F',
      description: 'Zákulisí, každodenní život, rodina, sport, cestování, hobby, osobní příběhy, humor.',
    },
  },
  {
    key: 'trendy',
    label: 'Trendy a reakce na trh',
    data: {
      share: 0.2,
      short: 'Trendy',
      color: '#CFF3E1',
      textColor: '#1E7A4D',
      description: 'ČNB, inflace, hypotéky, investiční trhy, makroekonomické události.',
    },
  },
  {
    key: 'produkt',
    label: 'Produktové a poradenské tipy',
    data: {
      share: 0.1,
      short: 'Produkt',
      color: '#FFF1B8',
      textColor: '#7A5A00',
      description:
        'Finanční plánování, investice, pojištění, energie, klientský servis, praktické finanční rady.',
    },
  },
]);

const treatments = rows('treatment', [
  {
    key: 'odborne',
    label: 'Odborně hodnotné',
    data: {
      share: 0.3,
      description:
        'Předává konkrétní poznatek, vysvětluje souvislosti, dává praktickou radu nebo odborný pohled.',
    },
  },
  {
    key: 'instagramove',
    label: 'Instagramové',
    data: {
      share: 0.7,
      description:
        'Situační humor, krátké scénky, trendy, osobní příběhy, zákulisí, jednoduchá atraktivní sdělení.',
    },
  },
]);

const characters = rows('character', [
  { key: 'osobni', label: 'Osobní', data: { share: 0.7 } },
  { key: 'pracovni', label: 'Pracovní', data: { share: 0.3 } },
  { key: 'nevztahuje', label: 'Nevztahuje se', data: { share: null } },
]);

const profiles = rows('profile', [
  { key: 'gta-partners', label: 'GTA Partners', data: { personal: false } },
  {
    key: 'honza',
    label: 'Honza',
    data: { personal: true, hashtag: '#honzagizicky', speaker: 'Honza' },
  },
  {
    key: 'radek',
    label: 'Radek',
    data: { personal: true, hashtag: '#radekteichmann', speaker: 'Radek' },
  },
]);

const locations = rows('location', [
  { key: 'hlavni-kancelar', label: 'Hlavní kancelář (1. p.)', data: { note: 'Radek + Honza, 2 stoly, gauč, TV.' } },
  {
    key: 'kancelare-poradcu',
    label: 'Kanceláře poradců (1. p.)',
    data: { note: 'Open space ve dvou částech, jedna nově zrekonstruovaná.' },
  },
  { key: 'recepce-lobby', label: 'Recepce a lobby (přízemí)', data: { note: 'Pult, 4 křesla.' } },
  { key: 'klientske-mistnosti', label: 'Klientské místnosti (přízemí)', data: { note: '3× cca 3×5 m.' } },
  { key: 'zazemi-asistentek', label: 'Zázemí asistentek (2. p.)', data: { note: 'Hodně stolů.' } },
  {
    key: 'mimo-budovu',
    label: 'Mimo budovu',
    data: { note: 'Sport, auto, benzínka, ulice, místa z Radkova příběhu (Hrabůvka, Stadion Vítkovice).' },
  },
  { key: 'box', label: 'Box', data: { note: 'Sportovní konzultace.' } },
]);

type FormatSeed = [key: string, family: string, label: string, description: string, goal: string, verified: boolean];

const FORMATS: FormatSeed[] = [
  ['kancelarsky-sketch', 'Skeč', 'Kancelářský sketch', 'situace z porady / kanceláře dovedená do absurdna', 'sdílení', true],
  ['situace-ze-zivota', 'Skeč', 'Situace ze života', 'benzín, účty, rodina — problém a absurdní řešení', 'sdílení', true],
  ['stereotyp-vs-realita', 'Skeč', 'Stereotyp vs. realita', 'split screen: jak si lidi představují poradce / jak to vypadá doopravdy', 'sdílení', false],
  ['pojistovak-mimo-kancelar', 'Skeč', 'Pojišťovák mimo kancelář', 'rande, rodinná oslava, hospoda — „a co děláš ty?“', 'sdílení / komentáře', false],
  ['klient-s-chybou-zachrance', 'Skeč', 'Klient s chybou → zachránce', 'klient dělá chybu (hypotéka, banka, financování auta…), Radek nebo Honza vstoupí a ukáže, co přehlíží. Chyba musí být málo známá, ne uhodnutelná', 'uložení / sdílení', false],
  ['sportovni-konzultace', 'Reálné záběry', 'Sportovní konzultace', 'Radek a Honza vedou konzultaci při sportu (box apod.) — syrové záběry, žádný skeč', 'sdílení / komentáře', false],
  ['den-za-15-sekund', 'Reálné záběry', 'Den za 15 sekund', 'jump cuty jednoho reálného dne, jedna věta na konci', 'uložení', false],
  ['honza-pov', 'Reálné záběry', 'Honza POV (Ray-Ban)', 'co vidí lídr během dne — bez klientských dat', 'sdílení', false],
  ['radek-ze-zivota', 'Reálné záběry', 'Radek ze života (telefon)', 'syrové selfie video, jedna myšlenka', 'komentáře', false],
  ['odkud-prisli', 'Lidé z týmu', 'Odkud přišli', 'kolega řekne jednu větu: kým byl předtím a proč odešel', 'sdílení', false],
  ['novacek-v-prvnim-tydnu', 'Lidé z týmu', 'Nováček v prvním týdnu', 'co ho překvapilo, jedno video = jedno překvapení', 'sdílení', false],
  ['kolegyne-v-hlavni-roli', 'Lidé z týmu', 'Kolegyně v hlavní roli', 'jakýkoli formát z banky s ženskou hlavní postavou', 'sdílení', false],
  ['klipy-z-dokumentu', 'Příběh', 'Klipy z dokumentu o Radkovi', 'vertikální výřezy: Hrabůvka, fotbal, thaibox, T-Mobile — jedna kapitola = jeden klip', 'uložení / sdílení', false],
  ['jedna-veta-kariera', 'Příběh', 'Jedna věta, která mi změnila kariéru', 'Radek nebo Honza, do kamery, bez střihu', 'uložení', false],
  ['rozhovor-klipy', 'Příběh', 'Rozhovor → klipy', 'dlouhý rozhovor nakrájený na 15–25 s, každý klip nový hook', 'uložení', false],
  ['hot-take', 'Názor / spor', 'Hot take', 'Honza do kamery: jedna věta, kterou obor nerad slyší', 'komentáře', false],
  ['odpoved-na-komentar', 'Názor / spor', 'Odpověď na komentář', 'video jako reakce na komentář diváka (komentář jako titulek)', 'komentáře', false],
  ['mytus-x-fakt', 'Názor / spor', 'Mýtus × fakt', '3 rychlé mýty o práci ve financích, ANO/NE', 'komentáře', false],
  ['reakce-na-trend', 'Názor / spor', 'Reakce na trend', 'remix / duet trendu se sítí přetočený na pilíř značky', 'sdílení', false],
  ['radek-vs-honza', 'Hra / výzva', 'Radek vs. Honza', 'soutěž o čemkoli (kdo dřív, kdo líp), prohrávající…', 'sdílení', false],
  ['hadej-cislo', 'Hra / výzva', 'Hádej číslo', 'divák tipuje číslo (schválené klientem), odpověď v dalším díle / v komentáři', 'komentáře', false],
  ['jedno-cislo-jedno-video', 'Užitek', 'Jedno číslo = jedno video', 'jedno schválené číslo z oboru a co znamená', 'uložení', false],
  ['co-bych-rekl-sobe', 'Užitek', 'Co bych řekl sobě v prvním roce', '3 body, rychle', 'uložení', false],
];

// § 5 marks "✅ obsah / 🧪 střih" and plain 🧪 as untested; only fully ✅ rows are verified.
const VERIFIED = new Set(['kancelarsky-sketch', 'situace-ze-zivota']);

const formats = rows(
  'format',
  FORMATS.map(([key, family, label, description, goal]) => ({
    key,
    label,
    data: { family, description, goal, status: VERIFIED.has(key) ? 'verified' : 'untested' },
  })),
);

const hookTypes = rows('hook_type', [
  { key: 'problem-v-obraze', label: 'Problém v obraze', data: { example: 'detail ručičky paliva, prázdný kalendář, 47 nepřečtených mailů' } },
  { key: 'absurdni-obraz', label: 'Absurdní obraz', data: { example: 'dva chlapi v oblecích na koloběžkách, porada v boxerském ringu' } },
  { key: 'cislo', label: 'Číslo', data: { example: '„Šest týdnů. Tolik mi trvalo…“ (číslo schválené klientem)' } },
  { key: 'tvrda-veta', label: 'Tvrdá věta / spor', data: { example: '„Volná pracovní doba je lež.“' } },
  { key: 'otazka-na-divaka', label: 'Otázka na diváka', data: { example: '„Kolik hodin týdně trávíš na poradách?“' } },
  { key: 'uprostred-akce', label: 'Uprostřed akce', data: { example: 'video začíná v půlce situace, bez příchodu a rozjezdu' } },
  { key: 'pov-titulek', label: 'POV titulek', data: { example: '„POV: první den ve financích a šéf nikde“' } },
  { key: 'pred-po', label: 'Před / po', data: { example: 'jeden záběr z korporátu, jeden z dneška' } },
  { key: 'zakazana-veta', label: 'Zakázaná věta', data: { example: '„Tohle by mi v bance nedovolili říct.“' } },
]);

const ctaTypes = rows('cta_type', [
  { key: 'share', label: 'Pošli to kolegovi', data: { goalMetric: 'shares' } },
  { key: 'save', label: 'Ulož si to', data: { goalMetric: 'saves' } },
  { key: 'question', label: 'Otázka do komentářů', data: { goalMetric: 'comments' } },
]);

const commentTypes = rows(
  'comment_type',
  COMMENT_TYPES.map((key) => ({ key, label: COMMENT_TYPE_LABELS[key], data: {} })),
);

const publicationVariants = rows('publication_variant', [
  { key: 'hlavni-verze', label: 'Hlavní verze', data: {} },
  { key: 'hook-a', label: 'Hook A', data: {} },
  { key: 'hook-b', label: 'Hook B', data: {} },
  { key: 'hook-c', label: 'Hook C', data: {} },
  { key: 'alternativni-strih', label: 'Alternativní střih', data: {} },
  { key: 'opakovana-publikace', label: 'Opakovaná publikace', data: {} },
]);

const checkRules = rows(
  'check_rule',
  DEFAULT_RULES.map((rule) => ({
    key: rule.code,
    label: rule.label,
    data: {
      severity: rule.severity,
      mode: rule.mode,
      enabled: rule.enabled,
      ...(rule.params ? { params: rule.params } : {}),
    },
  })),
);

export const LOOKUP_SEEDS: LookupSeed[] = [
  ...categories,
  ...treatments,
  ...characters,
  ...profiles,
  ...locations,
  ...formats,
  ...hookTypes,
  ...ctaTypes,
  ...commentTypes,
  ...publicationVariants,
  ...checkRules,
];
