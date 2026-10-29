import { sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import type { Anchor } from '@/domain/anchors/remap';
import type { ScriptBody } from '@/domain/script/types';

/**
 * Demo ("UKÁZKA") data. Every id is deterministic and every timestamp fixed, so the seed is
 * idempotent and dashboards built on it are reproducible.
 */

const CYCLE_ID = '2026-11';
// Czech time is UTC+1 from 25. 10. 2026.
const at = (day: string, time: string) => new Date(`2026-${day}T${time}:00+01:00`);

type LineSpec = [speaker: string, direction: string, text: string];
type SceneSpec = [fromSec: number, toSec: number, visual: string, lines: LineSpec[]];
type HookSpec = [hookType: string, text: string, visual: string];

interface BodySpec {
  prefix: string;
  hooks: HookSpec[];
  scenes: SceneSpec[];
  ctaType: 'share' | 'save' | 'question';
  caption: string;
  hashtags: string[];
  viewerLearns: string;
  source: string;
  differsFromLast3?: string;
}

/** Builds a body; the CTA is the last line of the last scene. Ids are `<prefix>-s<N>` / `-s<N>-l<M>`. */
function buildBody(spec: BodySpec): ScriptBody {
  const scenes = spec.scenes.map(([fromSec, toSec, visual, lines], si) => ({
    id: `${spec.prefix}-s${si + 1}`,
    fromSec,
    toSec,
    visual,
    lines: lines.map(([speaker, direction, text], li) => ({
      id: `${spec.prefix}-s${si + 1}-l${li + 1}`,
      speaker,
      direction,
      text,
    })),
  }));
  const lastScene = scenes[scenes.length - 1];
  return {
    hooks: spec.hooks.map(([hookType, text, visual], i) => ({
      id: (['A', 'B', 'C'] as const)[i],
      hookType,
      text,
      visual,
    })),
    scenes,
    cta: { lineId: lastScene.lines[lastScene.lines.length - 1].id, ctaType: spec.ctaType },
    caption: spec.caption,
    hashtags: spec.hashtags,
    viewerLearns: spec.viewerLearns,
    source: spec.source,
    differsFromLast3: spec.differsFromLast3 ?? '',
  };
}

// ---------------------------------------------------------------------------------------------
// Script bodies
// ---------------------------------------------------------------------------------------------

const V031_LEARNS =
  'Ke dni konce fixace jde hypotéka splatit nebo převést k jiné bance bez poplatku za předčasné splacení.';

const V031_V2_SPEC: BodySpec = {
  prefix: 'v031',
  hooks: [
    ['problem-v-obraze', 'Tak. Podepíšu a mám klid.', 'Detail ruky s propiskou nad dodatkem „Nová fixace“.'],
    ['uprostred-akce', '', 'Radek chytá propisku v letu, klient zůstane s prázdnou rukou nad papírem.'],
  ],
  scenes: [
    [
      0,
      11,
      'Klientská místnost, klient nad smlouvou, Honza sedí u stolu v pozadí.',
      [
        ['Klient', '', 'Tak. Podepíšu a mám klid.'],
        ['Radek', '', 'Stop! Neviděl jsi nabídku jinde?'],
        ['Klient', '', 'Jinde? To bych platil pokutu za předčasné splacení.'],
        ['Honza', 'nevzhlédne', 'Ke dni konce fixace splácíš bez poplatku. Ze zákona.'],
      ],
    ],
    [
      11,
      19,
      'Radek vrací propisku, klient ji odloží a vytáhne telefon.',
      [
        ['Radek', '', 'Takže si banku vybíráš ty. Ne ona tebe.'],
        ['Klient', '', '…a to mi nikdo neřekl?'],
      ],
    ],
    [19, 21, '', [['Radek', 'do kamery', 'Pošli to kolegovi, kterému letos končí fixace.']]],
  ],
  ctaType: 'share',
  caption: 'Končí ti fixace? Než podepíšeš první nabídku, přečti si tohle.',
  hashtags: ['#vaskonzultant', '#radekteichmann', '#honzagizicky', '#hypoteka'],
  viewerLearns: V031_LEARNS,
  source: 'zákon č. 257/2016 Sb., o spotřebitelském úvěru',
  differsFromLast3: 'Poprvé klient jako postava, žádný Radek sám do kamery.',
};

// Version 1: before Radek's note — the quoted legal wording and the source are missing.
const V031_V1_SPEC: BodySpec = {
  ...V031_V2_SPEC,
  scenes: V031_V2_SPEC.scenes.map((scene, i): SceneSpec => {
    if (i !== 0) return scene;
    const lines = scene[3].map((l): LineSpec => (l[0] === 'Honza' ? ['Honza', 'nevzhlédne', 'Ke dni konce fixace splácíš bez poplatku.'] : l));
    return [scene[0], scene[1], scene[2], lines];
  }),
  source: '',
};

const V026_V2_SPEC: BodySpec = {
  prefix: 'v026',
  hooks: [
    ['absurdni-obraz', 'Já ten termín potvrdil první.', 'Honza a Radek stojí u jedné kávovarové kapsle, každý drží jeden konec.'],
    ['otazka-na-divaka', 'Kolik porad týdně je na jednu otázku moc?', 'Detail prázdného kalendáře s pěti přeškrtnutými poradami.'],
  ],
  scenes: [
    [
      0,
      7,
      'Hlavní kancelář, dva stoly, každý šéf u svého, mezi nimi asistentka s notebookem.',
      [
        ['Honza', '', 'Poradu chci v pondělí v devět.'],
        ['Radek', '', 'V pondělí v devět mám sport. Středa.'],
      ],
    ],
    [
      7,
      16,
      'Asistentka otočí obrazovku s kalendářem, oba šéfové se nakloní.',
      [
        ['Asistentka', '', 'Vy dva máte společně volno jednou týdně. V sobotu.'],
        ['Honza', '', 'Tak v sobotu.'],
      ],
    ],
    [
      16,
      20,
      'Radek do kamery, za ním Honza s kávou.',
      [['Radek', 'do kamery', 'Pošli to kolegovi, který taky organizuje porady za dva šéfy.']],
    ],
  ],
  ctaType: 'share',
  caption: 'Když se dva šéfové neshodnou, rozhodne ten, kdo má kalendář.',
  hashtags: ['#vaskonzultant', '#radekteichmann', '#honzagizicky'],
  viewerLearns: 'Dobrý tým pozná, že asistentka s přehledem o kalendáři ušetří víc porad než jakýkoli šéf.',
  source: 'Zkušenost z chodu kanceláře GTA, bez konkrétních jmen.',
  differsFromLast3: 'Hlavní role má asistentka, ne šéfové.',
};

const V026_V1_SPEC: BodySpec = {
  ...V026_V2_SPEC,
  hooks: [
    ['absurdni-obraz', 'Já ten termín potvrdil první.', 'Honza a Radek stojí u jedné kávovarové kapsle.'],
    V026_V2_SPEC.hooks[1],
  ],
  scenes: V026_V2_SPEC.scenes.map((scene, i): SceneSpec =>
    i === 0 ? [scene[0], 12, scene[2], scene[3]] : i === 1 ? [12, 20, scene[2], scene[3]] : [20, 25, scene[2], scene[3]],
  ),
  caption: 'Dva šéfové, jeden kalendář.',
};

const V032_SPEC: BodySpec = {
  prefix: 'v032',
  hooks: [
    ['absurdni-obraz', 'Pět Radků u jednoho stolu.', 'Pět stejně oblečených Radků sedí v řadě na poradě.'],
    ['tvrda-veta', 'Šéf, který dělá všechno, nedělá nic dobře.', 'Radek v obleku s pěti čepicemi na hlavě.'],
  ],
  scenes: [
    [
      0,
      6,
      'Hlavní kancelář, pět Radků: obchodník, účetní, kouč, recruiter, řidič.',
      [['Radek obchodník', '', 'Já mám klienty.'], ['Radek recruiter', '', 'A já nové lidi.']],
    ],
    [
      6,
      15,
      'Střih mezi čepicemi, Radek je stále víc unavený.',
      [['Radek kouč', '', 'Kdo z nás má dneska volno?'], ['Všichni Radkové', '', 'Nikdo.']],
    ],
    [15, 19, 'Honza ve dveřích s kalendářem.', [['Honza', 'do kamery', 'Pošli to šéfovi, který nestíhá delegovat.']]],
  ],
  ctaType: 'share',
  caption: 'Kolik rolí zvládáš ty? Delegování je dovednost, ne slabost.',
  hashtags: ['#vaskonzultant', '#radekteichmann', '#nabor'],
  viewerLearns: 'Delegování je první krok k růstu týmu — kdo dělá všechno sám, brzdí ostatní.',
  source: 'Interní zkušenost vedení GTA.',
};

const V028_SPEC: BodySpec = {
  prefix: 'v028',
  hooks: [
    ['pred-po', 'Ráno v 6:00, večer v 19:00.', 'Dva záběry: budík na nočním stolku a zavřený notebook.'],
    ['pov-titulek', 'POV: Honzův den v patnácti sekundách.', 'Pohled z ramen přes ulici k autu.'],
  ],
  scenes: [
    [0, 5, 'Jump cuty: snídaně, auto, příjezd do kanceláře.', [['Honza', 'v autě', 'Sedm schůzek, jedna káva.']]],
    [5, 12, 'Jump cuty: porada, klientská místnost, oběd na stojáka.', [['Honza', 'za volantem', 'A taky jeden večerní trénink.']]],
    [12, 15, 'Večerní záběr, Honza zavírá notebook.', [['Honza', 'do kamery', 'Ulož si to, až budeš plánovat týden.']]],
  ],
  ctaType: 'save',
  caption: 'Jeden den vedoucího v patnácti sekundách. Ulož si to jako motivaci na pondělí.',
  hashtags: ['#vaskonzultant', '#honzagizicky', '#denzivota'],
  viewerLearns: 'Dobrý den má plán na schůzky i na sport — obojí se do kalendáře vejde.',
  source: 'Honzův reálný den, natáčeno bez klientských dat.',
};

const V033_SPEC: BodySpec = {
  prefix: 'v033',
  hooks: [
    ['tvrda-veta', 'Volná pracovní doba je lež.', 'Honza do kamery, za ním prázdná kancelář v sedm večer.'],
    ['otazka-na-divaka', 'Kolik hodin týdně vlastně pracuješ?', 'Detail hodinek, ručička ukazuje 19:00.'],
  ],
  scenes: [
    [
      0,
      6,
      'Honza sedí u stolu, ukazuje na prázdné křeslo.',
      [['Honza', 'do kamery', 'Volná pracovní doba je lež. Pracuješ tolik, kolik je potřeba.']],
    ],
    [
      6,
      16,
      'Záběr na kalendář s barevnými bloky.',
      [['Honza', 've střihu', 'Jde o to, kdy rozhoduješ ty, ne o to, kolik hodin ti zbývá.']],
    ],
    [16, 20, 'Honza se usmívá do kamery.', [['Honza', 'do kamery', 'Souhlasíš? Napiš mi do komentářů, kolik hodin pracuješ ty.']]],
  ],
  ctaType: 'question',
  caption: 'Volná pracovní doba: mýtus, nebo realita? Napiš, kolik hodin týdně pracuješ.',
  hashtags: ['#vaskonzultant', '#honzagizicky', '#hottake', '#prace'],
  viewerLearns: 'Svoboda v práci není o počtu hodin, ale o tom, kdo řídí kalendář.',
  source: 'Osobní názor Honzy, bez statistik.',
};

const V036_SPEC: BodySpec = {
  prefix: 'v036',
  hooks: [
    ['uprostred-akce', 'Kdo dřív doběhne k autu?', 'Radek a Honza startují sprint z kanceláře.'],
    ['otazka-na-divaka', 'Kdo z nich je rychlejší?', 'Detail bot na schodech.'],
  ],
  scenes: [
    [0, 5, 'Kancelář, oba chytají klíče.', [['Radek', '', 'Prohrávající platí kávu.'], ['Honza', '', 'To je ta nejdražší sázka v dějinách.']]],
    [5, 14, 'Sprint chodbou, schody, parkoviště.', [['Radek', 'zadýchaně', 'Já první!']]],
    [14, 18, 'Cílová čára u auta, oba lapají po dechu.', [['Honza', 'do kamery', 'Pošli to kolegovi, který by prohrál.']]],
  ],
  ctaType: 'share',
  caption: 'Kdo dřív, ten platí. Komu bys fandil ty?',
  hashtags: ['#vaskonzultant', '#radekteichmann', '#honzagizicky'],
  viewerLearns: 'Zdravá soutěž v týmu zvedá náladu i výkon.',
  source: 'Interní zábava, bez dat.',
};

// ---------------------------------------------------------------------------------------------
// Video definitions
// ---------------------------------------------------------------------------------------------

interface Version {
  spec: BodySpec;
  summary: string;
  createdAt: Date;
}

interface VideoDef {
  code: string;
  title: string;
  categoryKey: string;
  treatmentKey: string;
  profileKey: string;
  characterKey: string;
  formatKey: string;
  goalMetric: 'shares' | 'saves' | 'comments';
  isTrialReel: boolean;
  locationKeys: string[];
  cast: string[];
  props: string;
  intent: string;
  mainIdea: string;
  status: 'draft' | 'in_review' | 'final_review';
  versions: Version[];
  /** Working copy; for a draft it is the only body. */
  draftSpec: BodySpec;
}

const VIDEOS: VideoDef[] = [
  {
    code: 'V026',
    title: 'Dva šéfové, jeden problém',
    categoryKey: 'nabor',
    treatmentKey: 'instagramove',
    profileKey: 'gta-partners',
    characterKey: 'pracovni',
    formatKey: 'kancelarsky-sketch',
    goalMetric: 'shares',
    isTrialReel: false,
    locationKeys: ['hlavni-kancelar'],
    cast: ['Honza', 'Radek', 'Asistentka'],
    props: 'Kávovar, notebook s kalendářem',
    intent: 'Ukázat firemní kulturu: asistentka je v týmu klíčová.',
    mainIdea: 'Dva šéfové se nedohodnou na termínu porady, rozhodne asistentka s kalendářem.',
    status: 'final_review',
    versions: [
      { spec: V026_V1_SPEC, summary: 'První odeslání', createdAt: at('10-27', '08:10') },
      { spec: V026_V2_SPEC, summary: 'Zkrácená délka na 20 s, nový hook A', createdAt: at('10-28', '08:40') },
    ],
    draftSpec: V026_V2_SPEC,
  },
  {
    code: 'V031',
    title: 'Klient s chybou: fixace hypotéky',
    categoryKey: 'produkt',
    treatmentKey: 'odborne',
    profileKey: 'radek',
    characterKey: 'pracovni',
    formatKey: 'klient-s-chybou-zachrance',
    goalMetric: 'shares',
    isTrialReel: true,
    locationKeys: ['klientske-mistnosti'],
    cast: ['Radek', 'Honza', 'Petr (klient)'],
    props: 'Smlouva o fixaci, propiska',
    intent: 'Ukázat málo známé pravidlo o konci fixace hypotéky.',
    mainIdea: 'Klient chce podepsat novou fixaci a neví, že po skončení té staré může odejít bez poplatku.',
    status: 'final_review',
    versions: [
      { spec: V031_V1_SPEC, summary: 'První odeslání', createdAt: at('10-27', '08:30') },
      { spec: V031_V2_SPEC, summary: 'Doplněno znění zákona a zdroj', createdAt: at('10-28', '09:15') },
    ],
    draftSpec: V031_V2_SPEC,
  },
  {
    code: 'V032',
    title: 'Pět Radků',
    categoryKey: 'nabor',
    treatmentKey: 'instagramove',
    profileKey: 'radek',
    characterKey: 'osobni',
    formatKey: 'kancelarsky-sketch',
    goalMetric: 'shares',
    isTrialReel: false,
    locationKeys: ['hlavni-kancelar'],
    cast: ['Radek', 'Honza'],
    props: 'Pět čepic, oblek',
    intent: 'Ukázat, proč je delegování důležité pro růst týmu.',
    mainIdea: 'Radek hraje pět svých rolí najednou a zjišťuje, že nikdo nemá volno.',
    status: 'in_review',
    versions: [{ spec: V032_SPEC, summary: 'První odeslání', createdAt: at('10-28', '10:05') }],
    draftSpec: V032_SPEC,
  },
  {
    code: 'V028',
    title: 'Den za 15 sekund',
    categoryKey: 'lifestyle',
    treatmentKey: 'instagramove',
    profileKey: 'honza',
    characterKey: 'osobni',
    formatKey: 'den-za-15-sekund',
    goalMetric: 'saves',
    isTrialReel: true,
    locationKeys: ['mimo-budovu', 'kancelare-poradcu'],
    cast: ['Honza'],
    props: 'Telefon na stativu',
    intent: 'Zákulisí běžného dne vedoucího, bez klientských dat.',
    mainIdea: 'Jump cuty jednoho reálného dne zakončené jednou větou.',
    status: 'in_review',
    versions: [{ spec: V028_SPEC, summary: 'První odeslání', createdAt: at('10-28', '11:20') }],
    draftSpec: V028_SPEC,
  },
  {
    code: 'V033',
    title: 'Hot take: volná pracovní doba',
    categoryKey: 'trendy',
    treatmentKey: 'odborne',
    profileKey: 'honza',
    characterKey: 'osobni',
    formatKey: 'hot-take',
    goalMetric: 'comments',
    isTrialReel: true,
    locationKeys: ['hlavni-kancelar'],
    cast: ['Honza'],
    props: '',
    intent: 'Rozpoutat diskusi o skutečné volné pracovní době.',
    mainIdea: 'Honza do kamery: volná pracovní doba je lež.',
    status: 'in_review',
    versions: [{ spec: V033_SPEC, summary: 'První odeslání', createdAt: at('10-28', '12:45') }],
    draftSpec: V033_SPEC,
  },
  {
    code: 'V036',
    title: 'Radek vs. Honza: kdo dřív',
    categoryKey: 'lifestyle',
    treatmentKey: 'instagramove',
    profileKey: 'gta-partners',
    characterKey: 'osobni',
    formatKey: 'radek-vs-honza',
    goalMetric: 'shares',
    isTrialReel: true,
    locationKeys: ['kancelare-poradcu', 'mimo-budovu'],
    cast: ['Radek', 'Honza'],
    props: 'Klíče od auta',
    intent: 'Odlehčený týmový obsah.',
    mainIdea: 'Soutěž, kdo dřív doběhne k autu. Prohrávající platí kávu.',
    status: 'draft',
    versions: [],
    draftSpec: V036_SPEC,
  },
];

// ---------------------------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------------------------

const DEMO_USERS = [
  { id: 'sample-user-admin', name: 'Admin', email: 'admin@gta.local', role: 'admin', initials: 'A', color: '#DCD9FB' },
  { id: 'sample-user-honza', name: 'Honza', email: 'honza@gta.local', role: 'leadership', initials: 'H', color: '#CFF3E1' },
  { id: 'sample-user-radek', name: 'Radek', email: 'radek@gta.local', role: 'leadership', initials: 'R', color: '#DCD9FB' },
] as const;

function anchorIn(body: ScriptBody, lineId: string, quote: string): Anchor {
  const text = body.scenes.flatMap((sc) => sc.lines).find((l) => l.id === lineId)?.text;
  const from = text?.indexOf(quote) ?? -1;
  if (text === undefined || from < 0) throw new Error(`Demo anchor "${quote}" not found in ${lineId}`);
  return { fieldId: `line:${lineId}:text`, from, to: from + quote.length, quotedText: quote, state: 'attached' };
}

export async function seedDemo(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    // Users: upsert by e-mail; keep whatever id already exists.
    await tx
      .insert(s.users)
      .values(DEMO_USERS.map((u) => ({ ...u, createdAt: at('10-26', '09:00') })))
      .onConflictDoUpdate({
        target: s.users.email,
        set: { name: sql`excluded.name`, role: sql`excluded.role`, initials: sql`excluded.initials` },
      });
    const userRows = await tx.select().from(s.users);
    const uid = (email: string) => {
      const user = userRows.find((u) => u.email === email);
      if (!user) throw new Error(`Demo user missing: ${email}`);
      return user.id;
    };
    const admin = uid('admin@gta.local');
    const honza = uid('honza@gta.local');
    const radek = uid('radek@gta.local');

    await tx
      .insert(s.shootingCycles)
      .values({
        id: CYCLE_ID,
        shootDate: '2026-11-20',
        plannedVideos: 16,
        coversMonths: ['2026-11'],
        clipTarget: '30–40',
        note: 'UKÁZKA – datum natáčení doplňte podle skutečnosti',
      })
      .onConflictDoNothing();

    for (const def of VIDEOS) {
      const key = def.code.toLowerCase();
      const videoId = `sample-${key}`;
      const latest = def.versions[def.versions.length - 1];
      const created = def.versions[0]?.createdAt ?? at('10-28', '13:30');

      await tx
        .insert(s.videos)
        .values({
          id: videoId,
          code: def.code,
          title: def.title,
          cycleId: CYCLE_ID,
          plannedMonth: '2026-11',
          categoryKey: def.categoryKey,
          treatmentKey: def.treatmentKey,
          profileKey: def.profileKey,
          characterKey: def.characterKey,
          contentType: 'new_topic',
          intent: def.intent,
          goalMetric: def.goalMetric,
          mainIdea: def.mainIdea,
          formatKey: def.formatKey,
          isTrialReel: def.isTrialReel,
          locationKeys: def.locationKeys,
          cast: def.cast,
          props: def.props,
          ownerId: admin,
          scriptDueDate: '2026-11-13',
          approvalStatus: def.status,
          productionStatus: 'waiting',
          draft: buildBody(def.draftSpec),
          isSample: true,
          createdAt: created,
          updatedAt: latest?.createdAt ?? created,
        })
        .onConflictDoNothing({ target: s.videos.code });

      // Resolve the stored id: a pre-existing row with this code wins.
      const [stored] = await tx.select({ id: s.videos.id }).from(s.videos).where(sql`${s.videos.code} = ${def.code}`);
      const vid = stored.id;

      for (const [i, version] of def.versions.entries()) {
        const versionNo = i + 1;
        await tx
          .insert(s.scriptVersions)
          .values({
            id: `${videoId}-v${versionNo}`,
            videoId: vid,
            versionNo,
            body: buildBody(version.spec),
            meta: {
              title: def.title,
              categoryKey: def.categoryKey,
              formatKey: def.formatKey,
              profileKey: def.profileKey,
              goalMetric: def.goalMetric,
            },
            origin: 'submit',
            changeSummary: version.summary,
            createdBy: admin,
            createdAt: version.createdAt,
          })
          .onConflictDoNothing();

        await tx
          .insert(s.activityLog)
          .values({
            id: `${videoId}-act-submit-v${versionNo}`,
            actorId: admin,
            videoId: vid,
            entity: 'script_version',
            entityId: `${videoId}-v${versionNo}`,
            action: 'script.submitted',
            before: { approvalStatus: versionNo === 1 ? 'draft' : 'returned' },
            after: { approvalStatus: versionNo === 1 ? 'in_review' : 'final_review', versionNo },
            createdAt: version.createdAt,
          })
          .onConflictDoNothing();
      }
    }

    // Returned first versions (V026 by Honza, V031 by Radek) → resubmitted as v2.
    const returns = [
      { key: 'v026', userId: honza, note: 'Pointa přijde pozdě, zkrátit úvod a dát asistentku dřív.', at: at('10-27', '15:20') },
      { key: 'v031', userId: radek, note: 'Ověřit znění zákona a doplnit zdroj.', at: at('10-27', '16:05') },
    ];
    for (const r of returns) {
      const [video] = await tx.select({ id: s.videos.id }).from(s.videos).where(sql`${s.videos.code} = ${r.key.toUpperCase()}`);
      await tx
        .insert(s.approvalDecisions)
        .values({
          id: `sample-${r.key}-decision-return`,
          versionId: `sample-${r.key}-v1`,
          userId: r.userId,
          decision: 'return',
          note: r.note,
          overrodeWarnings: false,
          createdAt: r.at,
        })
        .onConflictDoNothing();
      await tx
        .insert(s.activityLog)
        .values({
          id: `sample-${r.key}-act-return`,
          actorId: r.userId,
          videoId: video.id,
          entity: 'approval_decision',
          entityId: `sample-${r.key}-decision-return`,
          action: 'script.returned',
          before: { approvalStatus: 'in_review' },
          after: { approvalStatus: 'returned', note: r.note },
          createdAt: r.at,
        })
        .onConflictDoNothing();
    }

    // V031 comments, all attached to version 2.
    const [v031] = await tx.select({ id: s.videos.id }).from(s.videos).where(sql`${s.videos.code} = 'V031'`);
    const body = buildBody(V031_V2_SPEC);
    const versionId = 'sample-v031-v2';
    const common = { videoId: v031.id, versionId, mentions: [] as string[], parentId: null };

    await tx
      .insert(s.comments)
      .values([
        {
          ...common,
          id: 'sample-v031-c1',
          authorId: radek,
          type: 'expert',
          status: 'open',
          body: 'Ověřit přesné znění v zákoně o spotřebitelském úvěru a doplnit paragraf pod scénář. Ať nás nikdo nechytí za slovo.',
          anchor: anchorIn(body, 'v031-s1-l4', 'Ze zákona.'),
          suggestion: null,
          assigneeId: admin,
          createdAt: at('10-29', '07:12'),
          updatedAt: at('10-29', '07:12'),
        },
        {
          ...common,
          id: 'sample-v031-c2',
          authorId: honza,
          type: 'change_request',
          status: 'open',
          body: 'Radek nemusí křičet. Otázka je přirozenější a víc to sedí k tomu, že klientovi radí.',
          anchor: anchorIn(body, 'v031-s1-l2', 'Stop! Neviděl jsi nabídku jinde?'),
          suggestion: { replacement: 'Počkej. Kolik ti nabídli jinde?', state: 'pending' },
          assigneeId: null,
          createdAt: at('10-28', '21:40'),
          updatedAt: at('10-28', '21:40'),
        },
        {
          ...common,
          id: 'sample-v031-c3',
          authorId: honza,
          type: 'remark',
          status: 'addressed',
          body: 'Klienta ať hraje někdo z týmu, ne herec.',
          anchor: null,
          suggestion: null,
          assigneeId: admin,
          createdAt: at('10-28', '21:38'),
          updatedAt: at('10-28', '22:10'),
        },
        {
          ...common,
          id: 'sample-v031-c3-reply',
          parentId: 'sample-v031-c3',
          authorId: admin,
          type: 'remark',
          status: 'open',
          body: 'Domluveno, hraje Petr z open space. Je v produkčních požadavcích.',
          anchor: null,
          suggestion: null,
          assigneeId: null,
          createdAt: at('10-28', '22:10'),
          updatedAt: at('10-28', '22:10'),
        },
      ])
      .onConflictDoNothing();
  });
}
