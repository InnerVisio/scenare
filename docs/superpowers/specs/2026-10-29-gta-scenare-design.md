# GTA Scénáře — návrh aplikace (specifikace)

*Verze 1 · 29. 10. 2026 · stav: **ke schválení***

Zdroje: `docs/PROMPT_Claude_Code_GTA_Scenare.md` (zadání), `docs/GTA_Planovani_videoobsahu_1.xlsx` + rozbor `docs/xlsx-analysis.md`, `docs/HANDOFF-vas-konzultant.md`, `docs/vas-konzultant-profil-klienta.md`, návrh vzhledu `docs/design/*.png`.

> **Jak číst:** Kde je značka **⚠️ POTVRĎ**, rozhodl jsem za tebe a potřebuju souhlas nebo opravu. Všechno ostatní vychází z tvých odpovědí nebo ze zadání.

---

## 1 · Co stavíme a proč

Interní webová aplikace, která nahradí tabulku `GTA_Planovani_videoobsahu_1.xlsx`. **Hlavní cíl:** Honza a Radek rychle zkontrolují scénář (typicky večer na telefonu), okomentují konkrétní větu, navrhnou změnu a schválí nebo vrátí. Všechno ostatní (přehled mixu, série, natáčecí den, publikace) je druhá priorita.

**Úspěch fáze 1:** projdu celý scénář „Admin napíše → odešle → Radek na telefonu (390 px) okomentuje větu, navrhne změnu, vrátí → Admin přijme návrh, odpoví, odešle v2 → Honza i Radek vidí změny proti v1 a oba schválí“ bez zaseknutí a v historii je vidět, kdo co kdy udělal.

### Rozhodnutí z naší konverzace

| Téma | Rozhodnutí |
|---|---|
| Tematický mix | **podle xlsx**: Nábor, vedení lidí a práce s týmem 30 % · Osobní brand & Lifestyle 40 % · Trendy a reakce na trh 20 % · Produktové a poradenské tipy 10 %. Editovatelné, stabilní ID. |
| Schvalování | **musí schválit oba** (Honza i Radek). V Nastavení přepínatelné na „jeden z vedení“ / „garant série“. |
| Uživatelé | **Admin** (píše scénáře i komentáře), **Honza**, **Radek** (kontrolují a schvalují). Role Marketér a Výroba v aplikaci existují, zatím je nikdo nemá. |
| Viditelnost komentářů | **všichni vidí všechno**. Interní komentáře se nedělají. |
| Infrastruktura | přenositelně: Next.js + Postgres, vlastní přihlášení. Vývoj bez účtů, nasazení (Vercel + Supabase/Neon) až po fázi 1. |
| Vzhled | podle `docs/design/` (levandule, inkoust, limetka). **Tmavý režim později**; barvy jsou tokeny, aby šel doplnit. |
| Profil GTA Partners | jen eviduje se, charakter se nehodnotí (výchozí ze zadání) |
| Notifikace | in-app + e-mail (Resend sandbox), žádný WhatsApp/Slack (výchozí ze zadání) |

---

## 2 · Architektura

```
src/
  domain/      čistá logika bez DB a bez frameworku — 100 % unit testy
    workflow/    stavový automat schvalování, komentářů, výroby
    policy/      oprávnění: can(user, action, resource)
    script/      struktura scénáře, výpočet délky, adresy polí
    anchors/     kotvy komentářů + přenos mezi verzemi
    diff/        porovnání verzí po polích
    checks/      kontroly scénáře (§ 8 zadání)
    metrics/     výpočty Přehledu (§ 7 zadání) — fáze 3
  server/      případy užití: ověř oprávnění → zapiš do DB → zapiš activity log → notifikace
  db/          Drizzle schéma, migrace, seed
  app/         Next.js App Router — obrazovky, server actions (volají jen server/)
  ui/          komponenty podle design systému
scripts/       import-xlsx.ts (fáze 3)
```

- **Next.js (App Router) + TypeScript**, server actions.
- **Postgres přes Drizzle ORM.** V testech a lokálním vývoji **PGlite** (Postgres běžící v procesu, žádný server). V produkci libovolný Postgres (Supabase / Neon).
- **Přihlášení:** Auth.js, magic link e-mailem, bez hesla. Ve vývoji se odkaz vypíše do konzole. Fáze 2: odkaz v notifikaci rovnou přihlásí a otevře frontu (podepsaný token, 7 dní).
- **Oprávnění se hlídají na serveru** v každém případu užití (`server/`), ne jen schováním tlačítek.
- **Čas:** všechna „dnes“ se předávají jako parametr (`now`), aby šly testy proti Excelu (cache počítaná 26. 10. 2026). Zobrazení `29. 10. 2026`, zóna `Europe/Prague`.
- **Živé aktualizace:** obrazovky kontroly se samy obnovují každých 10 s. (Realtime přes Supabase lze doplnit později.)
- **UI:** Tailwind + shadcn/ui přebarvené na tokeny z návrhu, písmo Plus Jakarta Sans, ikony lucide. UI celé česky; kód, proměnné a commity anglicky.

### Změna oproti zadání: bez TipTapu
Pole scénáře jsou krátké repliky. Každá replika je **samostatné textové pole se stabilním ID a mluvčím**. Komentář se ukotví jako `{fieldId, from, to, quotedText}` nad čistým textem. Kotvy, diff i přenos komentářů do nové verze jsou tak jednoduché a spolehlivé a odpovídá to návrhu, kde se scénář čte replika po replice.

---

## 3 · Datový model

### 3.1 Tabulky

| Tabulka | Obsah |
|---|---|
| `users` | jméno, e-mail, role (`admin` / `marketer` / `leadership` / `production`), iniciála, barva avataru, nastavení notifikací |
| `lookup_items` | **všechny číselníky v jedné tabulce**: `kind` (category, treatment, character, profile, location, format, hook_type, cta_type, comment_type, publication_variant, check_rule), `key` (stabilní ID), `label`, `data` (JSON: podíl, barva, popis, rodina formátu, stav ✅/🧪, cíl…), `sortOrder`, `archived` |
| `settings` | jeden řádek: měsíční cíl (16), dní před natáčením (7), tolerance p. b. (10), pravidlo schvalování (`all_leadership`) |
| `shooting_cycles` | `id` (`2026-11`), datum natáčení, plán videí, pokryté měsíce, cíl klipů, poznámka. Termín schválení = datum − N dní (dopočítává se) |
| `series` | podle listu Série (schéma hned, obrazovky fáze 3) |
| `videos` | metadata podle listu Scénáře (sloupce A–AD) + nová pole ze zadání § 4.1, `approvalStatus`, `productionStatus`, **`draft`** (pracovní verze scénáře), `editingAfterApproval` (bool), `isSample` |
| `script_versions` | **neměnný snímek**: `videoId`, `versionNo`, `body`, `meta` (snímek metadat), `createdBy`, `createdAt`, `changeSummary`, `origin` (`submit` / `accepted_suggestions` / `import`) |
| `approval_decisions` | `versionId`, `userId`, `decision` (`approve` / `return`), `note`, `overrodeWarnings`, `createdAt` |
| `comments` | `videoId`, `versionId` (kde vznikl), `parentId` (odpověď ve vlákně), `authorId`, `type`, `body`, `mentions[]`, `assigneeId`, `status`, `anchor` `{fieldId, from, to, quotedText, state: attached/detached}` nebo null, `suggestion` `{replacement, state: pending/accepted/rejected, decidedBy, decidedAt}` nebo null |
| `number_checks` | čísla k potvrzení: `videoId`, `fieldId`, `quotedText`, `status`, `confirmedBy`, `confirmedAt` |
| `view_marks` | `userId`, `videoId`, `lastSeenVersionId` (pro „Změny od posledního zobrazení“) |
| `activity_log` | kdo, co, kdy, entita, před/po |
| `notifications` | `userId`, `activityId`, `readAt` |
| `publications` | podle listu Publikace + metriky 24 h / 7 dní (schéma hned, obrazovky fáze 4) |

### 3.2 Struktura scénáře (`draft` i každá verze)

```
hooks:  [{ id: "A"|"B"|"C", hookType, text, visual }]          // A povinný, B/C volitelné
scenes: [{ id, fromSec, toSec, visual,
           lines: [{ id, speaker, direction?, text }] }]        // replika = 1 komentovatelné pole
cta:    { lineId, ctaType }       // výzva = označená replika (v návrhu „19–21 s · Výzva · pošli kolegovi“)
caption, hashtags[], viewerLearns, source, differsFromLast3
```

- **Adresy polí** (pro kotvy): `hook:A:text`, `hook:A:visual`, `scene:<id>:visual`, `line:<id>:text`, `caption`, `viewerLearns`, `source`.
- **Délka** = konec poslední scény. **Počet scén** = počet řádků scén. Výzva je replika, takže „zazní nahlas“ platí z definice.

---

## 4 · Workflow

### 4.1 Stav schválení

```
Rozpracováno ──Odeslat──► K připomínkám                       (první odeslání = v1)
K dopracování ──Odeslat──► K finálnímu schválení               (každé další = v2, v3…)
K připomínkám / K finálnímu ──Vrátit (kdokoli z vedení)──► K dopracování
K připomínkám / K finálnímu ──Schválit (oba z vedení)──► Schváleno
kterýkoli ──► Odloženo / Zrušeno (s důvodem) ──Obnovit──► Rozpracováno
```

- **Schválit** zapíše rozhodnutí k aktuální verzi. Dokud nerozhodne druhý, ve frontě je vidět „Schváleno 1/2 · čeká na Radka“. Po druhém schválení přejde do *Schváleno* a „Schválil“ a „Datum schválení“ se doplní automaticky (oba + čas posledního).
- **Varování, které neblokuje:** má-li scénář nevyřešené komentáře, nepotvrzená čísla nebo porušené zamítací pravidlo, zobrazí se „Schválit i tak?“. Rozhodnutí se zaloguje s příznakem.
- **Vrátit:** stačí jeden z vedení. Vyžaduje poznámku nebo aspoň jeden komentář k této verzi. Případné schválení toho druhého k této verzi zůstane v historii, ale neplatí.
- **Zamčení po schválení:** schválený scénář je jen ke čtení. „Odemknout pro úpravu“ založí koncept.
  - ⚠️ **POTVRĎ:** během rozpracované úpravy **zůstává stav *Schváleno*** s odznakem „rozpracovaná úprava“, takže scénář nezmizí z natáčecího plánu. Natáčí se vždy z **poslední schválené verze**. Po odeslání jde do *K finálnímu schválení*.
- **Schválit s drobnými úpravami:** když Admin u schváleného scénáře přijme **návrh změny od vedení**, vznikne automaticky nová verze (`origin = accepted_suggestions`), schválení se na ni přenesou a stav zůstává *Schváleno*. Jakákoli jiná úprava vyžaduje nové odeslání.
- **Metadata** (cyklus, měsíc, stav výroby, zodpovědný) schválení nikdy neruší.
- ⚠️ **POTVRĎ:** **Admin neschvaluje ani nevrací.** Rozhodují jen Honza a Radek a Adminovo schválení by se do „oba“ nepočítalo.

### 4.2 Stav komentáře

`Nevyřešeno` → Admin odpoví a/nebo přijme návrh → `Zapracováno` → vedení `Uzavře` (nebo znovu otevře → `Nevyřešeno`).
- Odmítnutý návrh → `Zapracováno` + povinný krátký důvod. Vedení pak rozhodne.
- Typ „Souhlas / schválení“ vzniká rovnou `Uzavřeno`.
- Uzavřené komentáře zůstávají dohledatelné (filtr „zobrazit uzavřené“).

### 4.3 Přenos kotev do nové verze

Při vzniku nové verze se pro každý otevřený ukotvený komentář hledá `quotedText`:
1. přesná shoda ve stejném poli,
2. přesná shoda v jiném poli,
3. přibližná shoda ve stejném poli (diff-match-patch).

Když se nic nenajde, komentář se přesune do sekce **„Odpojené komentáře“** i s původní citací. **Komentář se nikdy neztratí.**

### 4.4 Oprávnění

| Akce | Admin | Vedení | Marketér* | Výroba* |
|---|---|---|---|---|
| Psát / upravovat scénář, odeslat | ✅ | — | ✅ (své) | — |
| Komentovat, odpovídat, @zmínky | ✅ | ✅ | ✅ | — |
| Navrhnout změnu | ✅ | ✅ | ✅ | — |
| Přijmout / odmítnout návrh, „Zapracováno“ | ✅ | — | ✅ (své scénáře) | — |
| Potvrdit číslo, schválit, vrátit, uzavřít komentář | — | ✅ | — | — |
| Odložit / zrušit | ✅ | ✅ | — | — |
| Nastavení, uživatelé | ✅ | — | — | — |
| Stav výroby, odkazy na materiál | ✅ | — | — | ✅ |

\* role zatím bez uživatele

---

## 5 · Obrazovky fáze 1 (podle `docs/design/`)

**Navigace** (tmavý svislý pruh): Přehled · Ke kontrole (odznak s počtem) · Scénáře · Série · Natáčecí den · Publikace · Nastavení. Nahoře přepínač **Měsíc** a **Cyklus** (pamatuje se v URL), hledání, zvoneček, avatar. Ve fázi 1 jsou funkční Přehled (zjednodušený), Ke kontrole, Scénáře a Nastavení. Ostatní položky ukazují „Připravujeme“.

1. **Přehled „Dobré ráno, Honzo“** (`01-dashboard-desktop.png`). Ve fázi 1 jen karty, které nepotřebují výpočty mixu:
   - *Čeká na tvou kontrolu* (počet, termín schválení, „Začít kontrolu“),
   - *Natáčecí den* (datum, odpočet),
   - *Otevřené připomínky*,
   - kanban *Cyklus · kde co vázne* (jen zobrazení a proklik, přetahování až ve fázi 3).

   Tematický mix, plnění a série přijdou ve fázi 3. Pro Admina se místo „Čeká na tvou kontrolu“ zobrazí *Vráceno k dopracování / nevyřešené komentáře*.
2. **Ke kontrole** (`02-review-queue-desktop.png`, `03-review-queue-mobile.png`), **nejdůležitější obrazovka**:
   - *Desktop, tři sloupce.* Vlevo fronta (verze, počet komentářů, „2 / 6“). Uprostřed scénář s přepínačem **v2 · aktuální / Změny od v1 / Jen dialog**, tlačítky Vrátit · Schválit · Další, metadaty (délka, cíl, profil, lokace), blokem „Co se divák dozví“, hooky A/B, scénami (čas v šedém sloupci, mluvčí tučně, zvýrazněné kotvy s čísly komentářů, návrhy jako přeškrtnutý a nový text) a titulkem s hashtagy. Vpravo záložky **Komentáře · Kontrola · Verze** a pole „Napiš komentář… @ pro zmínku“.
   - *Mobil.* Ukazatel postupu, scénář na celou šířku, komentáře ve spodním panelu. Po označení textu se objeví plovoucí lišta **Komentovat · Navrhnout · Číslo**. Fixní spodní lišta **Vrátit · ✓ Schválit · →**. Nic nezávisí na hoveru, všechny cíle jsou aspoň 48 px.
   - *Klávesy:* `J`/`K` další/předchozí, `C` komentář, `S` návrh, `A` schválit, `R` vrátit.
   - Ve druhém kole se automaticky otevře „Změny od verze, kterou jsi naposledy viděl“.
3. **Scénáře:** tabulka s filtry (cyklus, měsíc, kategorie, stav schválení, stav výroby, série) a barevná signalizace červená / oranžová / zelená. Kanban a uložené pohledy až ve fázi 3.
4. **Editor scénáře (Admin):**
   - formulář metadat a hooky A/B/C,
   - scény jako řádky (přidat, smazat, přesunout), repliky s mluvčím, označení výzvy,
   - titulek, hashtagy, „Co se divák dozví“ a zdroj,
   - živé kontroly v bočním panelu,
   - komentáře přímo v textu s tlačítky Přijmout / Odmítnout / Odpovědět / Zapracováno,
   - autosave a tlačítko **Odeslat ke kontrole** (s větou „co jsem změnil“),
   - šablona nového scénáře podle handoff § 6, „Duplikovat jako nový díl série“.
5. **Detail scénáře:** časová osa verzí („v1 vrácena Radkem · 4 komentáře → v2 schválena oběma 5. 11.“), porovnání libovolných dvou verzí po polích (přidané zeleně, odebrané červeně) a historie z activity logu.
6. **Nastavení (Admin):** číselníky (kategorie s podílem a barvou, formáty, typy hooků, lokace, profily…), pravidla kontroly (závažnost, auto/ruční), parametry, pravidlo schvalování, uživatelé. Stavy workflow jsou systémové (jen přejmenovat popisek).
7. **Zvoneček:** in-app notifikace z activity logu (odesláno ke kontrole, vráceno, schváleno, nový komentář, @zmínka, návrh přijat / odmítnut).

### Kontroly scénáře ve fázi 1
Jen pravidla spočitatelná z jednoho scénáře (výchozí sada z handoff § 4 a § 7, editovatelná):
- hook do 2 s a bez „Ahoj / jsme / jmenuji se“,
- délka 12–25 s (díl série 20–30 s),
- max. 3 scény,
- výzva vyplněná, bez „sleduj“, odpovídá cíli (sdílení → pošli kolegovi, uložení → ulož si, komentáře → otázka),
- žádné nepotvrzené číslo (aplikace sama nabídne číslice ve scénáři k označení),
- přidaná hodnota + zdroj,
- 3–5 hashtagů včetně `#vaskonzultant` a jména toho, kdo hraje,
- formát 🧪 → Trial Reel.

Ruční body (logický dialog, pointa k pilíři, GDPR, nejsilnější obraz na začátku) se zaškrtávají ručně per verze.
Pravidla nad historií („formát / hook jiný než poslední 2 videa“, „max. 2 stejného formátu za týden“) přijdou ve **fázi 3**.
**Kontroly nikdy neblokují schválení.**

---

## 6 · Fáze

| Fáze | Obsah | Hotovo, když |
|---|---|---|
| **1 — Kontrola scénářů (MVP)** | vše z § 2–5 | e2e scénář z § 1 projde na 390 px, historie je kompletní |
| **2 — Rozesílání a termíny** | natáčecí cykly a termíny, e-maily se sdružováním (max. 1×/h), magic link rovnou do fronty, připomínky T−3 / T−1, denní souhrn 8:00 | odeslání 5 scénářů = 1 e-mail, klik = přihlášen ve frontě |
| **3 — Přehled, série, kontroly** | všech 7 sekcí Přehledu (§ 7 zadání), série a „Lze uzavřít?“, kontroly § 8.1–8.3 vč. historie, kanban s přetahováním, uložené pohledy, import xlsx | po importu xlsx sedí čísla pro `2026-11` s Excelem (test s `now = 26. 10. 2026`) |
| **4 — Natáčecí den a publikace** | natáčecí balíček (lokace → účinkující, PDF, sdílený odkaz), hromadné „Natočeno“, publikace s variantami a metrikami, týdenní report | — |
| **5 — Volitelné** | AI kontrola scénáře, komentáře k sestřihu s časovou značkou, import metrik z CSV | — |

Každá fáze dostane vlastní implementační plán, až bude ta předchozí hotová a vyzkoušená.

### Poznámky k portaci logiky z Excelu (pro fázi 3, zjištěno v rozboru)
- Navrženo, schváleno a natočeno se počítá podle **plánovaného** měsíce, publikováno podle **skutečného** data první publikace.
- Plán kategorie = `round(cíl × podíl)` a kategorie s největším podílem dorovná rozdíl. Součet podílů porovnávat s tolerancí (v Excelu je uloženo 0,9999999999999999).
- Tabulka není vnitřně jednotná: Série počítá „Odloženo“ do dílů, Přehled ne. Přestřih ve střihu se počítá jako „Natočeno“. **Test proti Excelu tyto chování zreplikuje přesně.** Případné sjednocení navrhnu zvlášť a ty rozhodneš.
- Seznam měsíců v tabulce jde do 2029-12, cykly a historie jen do 2028-09. V aplikaci se cykly přidávají tlačítkem „Přidat další měsíc“, takže omezení zmizí.

---

## 7 · Testování

- **Vitest, unit:** celé `domain/`, tedy stavový automat (každý přechod včetně zakázaných), oprávnění (matice § 4.4), kotvy a jejich přenos, diff, kontroly scénáře. Ve fázi 3 i metriky proti hodnotám z Excelu.
- **Vitest, integrační:** případy užití v `server/` nad PGlite (oprávnění se opravdu vynucují na serveru, activity log se zapisuje).
- **Playwright e2e:** scénář z § 1 na šířce **390 px** a na desktopu.
- Před každým commitem: lint, typecheck, testy zelené.

## 8 · Jak bude probíhat práce

1. Ty schválíš tuto specifikaci (případně s opravami).
2. Napíšu **implementační plán fáze 1** rozpadlý na malé úkoly. Každý úkol bude mít přesné zadání, dotčené soubory a testy, které musí projít. Plán ti dám ke kontrole.
3. Úkoly implementují **levnější subagenti** (testy napřed). Já po každém úkolu zkontroluju diff a testy a teprve potom se jde dál.
4. Po fázi 1 ti řeknu, jak to vyzkoušet. Pak připravíme nasazení: založíš účty Vercel a Supabase nebo Neon a vložíš klíče.

## 9 · Co aplikace nedělá (ze zadání § 12)
Nepublikuje na IG/FB, nestahuje metriky z Meta API, nehostuje videa (jen odkazy), není to obecný projektový nástroj.
