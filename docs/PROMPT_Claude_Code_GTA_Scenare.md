# PROMPT PRO CLAUDE CODE — aplikace „GTA Scénáře"
### Plánování, psaní, kontrola, schvalování a rozesílání scénářů videí pro Váš konzultant

> **Jak to použít:** Založ prázdnou složku projektu, do `/docs` nahraj:
> - `GTA_Planovani_videoobsahu_1.xlsx` (současná tabulka, ze které aplikace vychází),
> - `HANDOFF-vas-konzultant.md` a `vas-konzultant-profil-klienta.md` (pravidla scénářů, banka formátů, kontrolní seznam).
>
> Pak spusť Claude Code a vlož celý text níže.

---

## 0 · Instrukce pro tebe (Claude Code) — čti první

Budeš stavět interní webovou aplikaci, která nahradí sdílenou Excel / Google tabulku `docs/GTA_Planovani_videoobsahu_1.xlsx`. Tabulka funguje, ale **kontrola scénářů v ní je bolest**: scénář je odkaz nebo text v buňce, připomínky jsou v jiném listu na jiném řádku, nevidíš, ke které větě se vztahují, nevidíš rozdíl mezi verzemi a nikomu nepřijde upozornění.

**Hlavní cíl aplikace:** aby Honza a Radek (vedení) mohli **rychle a přehledně zkontrolovat scénář, napsat komentář přímo k dané větě, navrhnout změnu a schválit nebo vrátit**, ideálně i z telefonu. Všechno ostatní (přehled mixu, série, natáčecí den, publikace) je důležité, ale je to druhá priorita.

**Postup:**
1. Přečti celý tento dokument a soubory v `/docs`. Tabulku projdi skriptem (openpyxl): listy, sloupce, rozbalovací seznamy (data validation) a vzorce. Vzorce jsou specifikace business logiky, kterou máš přenést (viz § 7 a § 8).
2. Navrhni datový model (Prisma/SQL schéma) a plán po fázích. Ukaž mi je **dřív, než napíšeš první komponentu**.
3. Polož mi otázky z § 14 (Otevřené otázky), na které neznáš odpověď. Kde odpověď nedostaneš, použij výchozí hodnotu uvedenou v závorce a napiš, že jsi ji použil.
4. Stav po fázích (§ 13). Po každé fázi: testy zelené, krátké shrnutí, co funguje, a jak to vyzkoušet.

**Jazyk:** celé UI česky (včetně chybových hlášek, e-mailů, prázdných stavů). Datumy `29. 10. 2026`, časová zóna `Europe/Prague`. Kód, názvy proměnných a commity anglicky.

---

## 1 · Kontext — kdo a proč

- **Klient:** Váš konzultant, finanční poradci a lídři týmu **Radek Teichmann** a **Jan „Honza" Gizický**. Obsah: Instagram Reels (primárně) + Facebook (jen videa, která zafungovala na IG). Cíl obsahu: bořit mýtus o „pojišťovákovi v obleku", nábor poradců, osobní značka lídrů. **Ne** prodej produktů.
- **Kdo dělá obsah:** GTA Partneři (marketéři píšou scénáře), štáb natáčí jednou měsíčně v natáčecí den (30–40 klipů), střih a publikace.
- **Objem:** min. 16 publikovaných unikátních videí měsíčně.
- **Kdo schvaluje:** Honza a/nebo Radek. Mají málo času, scénáře čtou typicky večer na telefonu. **Každé kliknutí navíc = scénář zůstane neschválený.**

Pravidla, jak má scénář vypadat (hook do 2 s, délka 12–25 s, max. 3 scény, jedna ze tří výzev na konci, přidaná hodnota, logický dialog, čísla schvaluje klient, GDPR…), jsou v `docs/HANDOFF-vas-konzultant.md` (§ 4, § 6, § 7). Aplikace je **nemá hardcodovat**. Mají být v Nastavení jako editovatelný seznam pravidel a kontrolních bodů (viz § 8).

---

## 2 · Inspirace z ověřených systémů (co přesně převzít)

Nevymýšlej workflow od nuly. Převezmi tyto osvědčené vzory:

| Zdroj | Co převzít | Kde v aplikaci |
|---|---|---|
| **Google Docs** (komentáře + režim návrhů) | Označím text → komentář ukotvený k té pasáži. Režim „Navrhnout změnu": přeškrtnutý původní text + navržený nový, autor jedním klikem přijme / odmítne. Vlákna odpovědí, @zmínky, přiřazení komentáře konkrétnímu člověku. | Editor a kontrola scénáře (§ 5.3) |
| **Planable** (schvalování sociálního obsahu) | Stavy Koncept → Ke schválení → Schváleno. **Zamčení po schválení:** úprava schváleného scénáře ho vrátí do schvalování. Interní komentáře (jen tým GTA) vs. komentáře viditelné pro vedení. Automatické připomínky čekajících položek. Schvalovatel otevře odkaz z e-mailu a je rovnou v kontrole. | Workflow (§ 6), rozesílání (§ 9) |
| **Filestage** (verze a revize) | Každé odeslání ke kontrole = nová neměnná verze (v1, v2…). **Porovnání verzí:** přidaný text zeleně, odebraný červeně. U každé verze je vidět, kdo schválil / vrátil a s jakými komentáři. Export zprávy z kontroly. | Verze a diff (§ 5.4) |
| **Frame.io** (revize videa) | Fronta „ke kontrole" s tlačítky Další / Předchozí, rychlé stavy, komentáře označené jako hotové, notifikace v reálném čase. Ve fázi 4 komentář s časovou značkou k sestřihu. | Kontrolní fronta (§ 5.2), fáze 4 |
| **StudioBinder** (předprodukce) | Ze schválených scénářů automaticky vygenerovat podklad pro natáčecí den: seskupení podle lokace a účinkujících, rekvizity, které hooky točit. Sdílet štábu jako odkaz / PDF. | Natáčecí den (§ 5.6) |

---

## 3 · Role a oprávnění

| Role | Kdo | Smí |
|---|---|---|
| **Admin** | Visio | vše, nastavení, uživatelé, import/export |
| **Marketér** | Marketér A/B/C (seznam v Nastavení) | zakládat a psát scénáře a série, odeslat ke kontrole, reagovat na komentáře, přijmout/odmítnout návrh změny, označit komentář „Zapracováno", zapisovat publikace |
| **Vedení (schvalovatel)** | Honza, Radek | číst vše, komentovat, navrhovat změny, **schvalovat / vracet**, uzavírat komentáře, uzavírat série, potvrzovat čísla |
| **Výroba** | štáb, střihač | stav výroby, odkazy na materiál a finální video, natáčecí den |
| **Host** | štáb bez účtu | jen čtení přes sdílený odkaz (natáčecí balíček), s expirací |

Oprávnění vynucovat na serveru (RLS v Postgresu / kontrola v API), ne jen skrytím tlačítek.

---

## 4 · Datový model (převod tabulky → databáze)

Níže je mapování listů tabulky. Sloupce z tabulky zachovej (budeme importovat data), nová pole jsou označena **[NOVÉ]**.

### 4.1 `Video` (= řádek listu **Scénáře**, jeden řádek = jedno unikátní video nebo jeden díl série)

| Pole | Ze sloupce | Typ / hodnoty |
|---|---|---|
| `code` | A · ID videa | `V001`, automaticky další volné |
| `title` | B · Pracovní název | text |
| `seriesId`, `episodeNo` | C · ID série, D · Číslo dílu | FK na Série, číslo |
| `cycleId` | E · Natáčecí cyklus | FK (`2026-11`) |
| `plannedMonth` | F · Plánovaný měsíc publikace | `YYYY-MM` |
| `category` | G · Tematická kategorie | číselník (Nastavení) |
| `treatment` | H · Typ zpracování | Odborně hodnotné / Instagramové |
| `primaryProfile` | I · Primární profil | GTA Partners / Honza / Radek (číselník) |
| `character` | J · Charakter pro osobní profil | Osobní / Pracovní / Nevztahuje se |
| `contentType` | K · Typ obsahu | Nové téma / Nové zpracování úspěšného tématu / Nový střih existujícího videa |
| `originalVideoId` | L · Původní ID videa | FK na Video (u přestřihu) |
| `intent` | M · Cíl videa | text („co chceme komunikovat") |
| `goalMetric` **[NOVÉ]** | — | sdílení / uložení / komentáře → určuje výzvu na konci (handoff § 4 pravidlo 5) |
| `mainIdea` | N · Hlavní myšlenka | text |
| `body` | O · Kompletní scénář | **strukturovaný dokument** (viz 4.2) + volitelný externí odkaz |
| `hooks[]` | P, Q, R · Hook A/B/C | text + **[NOVÉ]** typ hooku (číselník z handoff § 5) + obraz |
| `production` | S · Produkční požadavky | rozdělit na `locations[]` (číselník lokací), `cast[]` (lidé), `props` (text) |
| `ownerId` | T · Zodpovědný marketér | FK uživatel |
| `scriptDueDate` | U · Termín odevzdání scénáře | datum |
| `marketerNote` | V · Poznámky marketéra | text |
| `approvalStatus` | W · Stav schválení | viz § 6 |
| `approvedBy`, `approvedAt` | X · Schválil, Y · Datum schválení | **plní aplikace automaticky** při kliknutí na Schválit |
| `leadershipNote` | Z · Poznámka vedení | text |
| `productionStatus` | AA · Stav výroby | Čeká na natáčení / Natočeno / Ve střihu / Sestříháno / Publikováno / Nenatočeno |
| `shotAt` | AB · Skutečné datum natáčení | datum |
| `rawFootageUrl`, `finalVideoUrl` | AC, AD | URL |
| `format` **[NOVÉ]** | — | rodina + formát z banky formátů (číselník se stavem ✅ ověřené / 🧪 netestované) |
| `isTrialReel` **[NOVÉ]** | — | bool; automaticky navrhnout `true`, když je formát 🧪 |
| `durationSec` **[NOVÉ]** | — | dopočítat z časování scén |
| `viewerLearns`, `sourceUrl` **[NOVÉ]** | — | „Co se divák dozví" + zdroj (handoff § 4 pravidlo 11) |
| `verdict` **[NOVÉ]** | — | dává smysl / nedává + jedna věta |
| `caption`, `hashtags[]` **[NOVÉ]** | — | titulek k příspěvku, 3–5 hashtagů |
| `numbersToConfirm[]` **[NOVÉ]** | — | čísla ve scénáři, která musí potvrdit Radek / Honza (pravidlo 7). Každé má stav nepotvrzeno / potvrzeno (kdo, kdy) |

**Dopočítávaná pole (nepřepisovatelná, v tabulce šedé sloupce AE–AI):**
- `openComments` = počet komentářů ve stavu Nevyřešeno
- `publicationCount` = počet záznamů v Publikacích
- `firstPublishedAt` = nejmenší datum publikace
- `actualMonth` = měsíc z `firstPublishedAt`
- `issues[]` = výsledek kontrol (§ 8.1). V tabulce je to sloupec AI („Kontrola – co je potřeba dořešit")

### 4.2 Struktura scénáře (`body`)

Scénář není jeden textový blok. Je to strukturovaný formulář podle handoff § 6, ve kterém je **každé textové pole komentovatelné**:

```
Hook A / B / C        → typ hooku · text · obraz
Scény (max. 3)        → čas od–do · obraz · kdo mluví · replika / titulek   (řádky tabulky, přetahovatelné)
Závěrečná výzva       → typ (pošli kolegovi / ulož si / otázka) · text
Titulek + hashtagy
Co se divák dozví     → fakt + zdroj
Čím se liší od posledních 3 videí → aplikace sama nabídne formát a typ hooku posledních 3 publikovaných videí
```

Editor: **TipTap (ProseMirror)** pro textová pole. Komentáře ukládej jako vlastní záznamy s kotvou (ID pole + pozice + citovaný text), ne jako placené TipTap Pro rozšíření.

**Režim dialogu:** přepínač zobrazení „jen dialog" (replika po replice, s mluvčím), protože takhle scénář čtou při natáčení i schvalování.

### 4.3 `ScriptVersion` **[NOVÉ]**
Neměnný snímek `body` + metadat v okamžiku „Odeslat ke kontrole". `versionNo`, `createdBy`, `createdAt`, `changeSummary` (volitelná věta od marketéra „co jsem změnil").

### 4.4 `Comment` (= list **Připomínky**, rozšířený)

| Pole | Ze sloupce | Poznámka |
|---|---|---|
| `videoId` | A | |
| `createdAt`, `authorId` | C, D | |
| `type` | E · Typ | Připomínka / Odborné doplnění / Požadavek na úpravu / Nápad / Souhlas / schválení |
| `body` | F · Text | rich text, @zmínky |
| `reply` + `repliedBy` + `repliedAt` | G, H, I · Reakce marketéra | v aplikaci jako **vlákno odpovědí** (libovolně dlouhé) |
| `status` | J · Stav | **Nevyřešeno → Zapracováno → Uzavřeno** (viz § 6.3) |
| `anchor` **[NOVÉ]** | — | `{ field, versionId, from, to, quotedText }`, nebo `null` pro obecný komentář ke scénáři |
| `suggestion` **[NOVÉ]** | — | navržený náhradní text (režim návrhů) + stav přijato / odmítnuto |
| `visibility` **[NOVÉ]** | — | `internal` (jen GTA tým) / `shared` (vidí vedení) |
| `assigneeId` **[NOVÉ]** | — | komu je úkol přiřazen |

**Přenos kotev mezi verzemi:** když vznikne nová verze, pokus se kotvu najít podle `quotedText` (přesná shoda → fuzzy). Když text zmizel, komentář zůstane v sekci **„Odpojené komentáře"** s původní citací. Nikdy komentář neztrať.

### 4.5 `Publication` (= list **Publikace**)
`videoId`, `profile`, `publishedAt`, `variant` (Hlavní verze / Hook A / Hook B / Hook C / Alternativní střih / Opakovaná publikace), `url`, `note`.
**[NOVÉ] metriky** (handoff § 8–9), snímek po 24 h a po 7 dnech: zhlédnutí, dosah, míra přeskočení, prům. doba přehrání, sdílení, uložení, komentáře, sledující z reelu, návštěvy profilu. Interakce počítat **z dosahu**, ne ze zhlédnutí.
Pravidlo z tabulky: **více publikací jednoho videa nezvyšuje počet unikátních videí.**

### 4.6 `Series` (= list **Série**)
`code` (S01), `name`, `mainCategory`, `goal`, `guarantorId`, `ownerId`, `plannedEpisodes`, `originalPlannedEpisodes`, `scopeChangeReason`, `startDate`, `expectedEnd`, `note`, `status` (Návrh / Rozpracovaná / Ve výrobě / V publikaci / Dokončená / Uzavřená / Pozastavená / Zrušená), `closedBy`, `closedAt`.
Dopočítat: díly se scénářem (bez zrušených), schválené, natočené (Natočeno + Ve střihu + Sestříháno + Publikováno), publikované, plnění %, zbývá dílů, otevřené komentáře, publikace bez odkazu, **„Lze uzavřít?"**, kontrola (viz § 8.2).

### 4.7 `ShootingCycle` (= Nastavení, tabulka natáčecích cyklů)
`id` (`2026-11`), `shootDate`, `approvalDeadline` = **shootDate − N dní** (N z Nastavení, výchozí 7), `plannedVideos` (výchozí = měsíční cíl), `coversMonths[]`, `clipTarget` (výchozí „30–40"), `note`.

### 4.8 `Settings` (= list **Nastavení**)
- Měsíční cíl publikovaných videí (16)
- Dní před natáčením pro termín schválení (7)
- Tolerance odchylky poměrů v p. b. (10)
- **Tematický mix:** kategorie + cílový podíl + popis (viz upozornění níže)
- Typ zpracování: Odborně hodnotné 30 % / Instagramové 70 %
- Charakter osobních profilů (Honza, Radek, každý zvlášť): Osobní 70 % / Pracovní 30 %
- Číselníky: marketéři, schvalovatelé, profily, lokace, banka formátů, typy hooků, typy výzev, typy komentářů, varianty publikace
- Pravidla a kontrolní seznam (§ 8.3)

> ⚠️ **Nesoulad, který musíš nechat konfigurovatelný:** tabulka má kategorie *Nábor, vedení lidí a práce s týmem 30 % / Osobní brand & Lifestyle 40 % / Trendy a reakce na trh 20 % / Produktové a poradenské tipy 10 %*. Handoff (23. 10. 2026) má *Trendy 30 % / Nábor 30 % / Lifestyle 20 % / Produktové a prodejní tipy 20 %*. Názvy ani podíly nehardcoduj. Kategorie mají stabilní ID, aby přejmenování nerozbilo historii. Výchozí hodnoty se zeptej (§ 14).

### 4.9 `ActivityLog` + `Notification` **[NOVÉ]**
Každá změna stavu, schválení, komentář, nová verze → záznam (kdo, co, kdy, před/po). Z logu se generují notifikace a historie u scénáře („Radek vrátil v2 k dopracování · 3 komentáře").

---

## 5 · Obrazovky

Navigace: **Přehled · Ke kontrole · Scénáře · Série · Natáčecí den · Publikace · Nastavení**. Nahoře globální přepínač **Měsíc** a **Natáčecí cyklus** (= dvě žluté buňky z listu Přehled), pamatovaný v URL.

### 5.1 „Co je na mně" (výchozí obrazovka po přihlášení, podle role)
- **Vedení:** „Čeká na tebe: 6 scénářů pro natáčení 20. 11. (termín schválení za 3 dny)" → velké tlačítko **Začít kontrolu**. Pod tím nepotvrzená čísla a komentáře, kde mě někdo @zmínil.
- **Marketér:** vrácené k dopracování, nevyřešené komentáře k mým scénářům, blížící se termíny odevzdání, scénáře s chybami z kontroly.
- **Výroba:** schválené a čekající na natáčení, natočené bez odkazu, publikované bez záznamu.

### 5.2 Kontrolní fronta „Ke kontrole" — **NEJDŮLEŽITĚJŠÍ OBRAZOVKA**
Pro vedení. Prochází scénáře ve stavu *K připomínkám* a *K finálnímu schválení* pro vybraný cyklus jeden po druhém (jako Frame.io / Tinder).

**Desktop (3 sloupce):**
- vlevo: seznam fronty (název, kategorie, stav, počet komentářů), ukazatel „3 / 8"
- uprostřed: scénář ve strukturovaném zobrazení (§ 4.2), čitelný font, dialog s mluvčími
- vpravo: komentáře (ukotvené zvýrazněné ve scénáři, obecné, odpojené), kontrolní seznam (§ 8.3), nepotvrzená čísla, historie verzí

**Mobil (priorita, Honza/Radek čtou na telefonu):**
- scénář na celou šířku, komentáře jako spodní panel (bottom sheet)
- označím text → plovoucí tlačítka **Komentovat** · **Navrhnout změnu** · **Potvrdit číslo**
- fixní spodní lišta: **✓ Schválit** · **↩ Vrátit k dopracování** · **Další →**
- vše použitelné palcem, žádné hover-only akce

**Akce:**
- **Schválit:** jedno kliknutí. `approvedBy` a `approvedAt` se doplní samy (v tabulce se to hlásilo jako chyba „Schváleno bez jména / data", tady to nesmí jít udělat špatně). Když má scénář nevyřešené komentáře nebo nepotvrzená čísla, zobraz varování „Schválit i tak?" (neblokovat, vedení má poslední slovo, ale zalogovat to).
- **Vrátit k dopracování:** vyžaduje aspoň jeden komentář nebo krátkou poznámku.
- **Schválit s drobnými úpravami:** schválí + nechá komentáře typu Návrh změny, které marketér jen přijme (scénář se po přijetí nevrací do kontroly, pokud změny přijal jen z návrhů vedení).
- Klávesy na desktopu: `J`/`K` další/předchozí, `C` komentář, `S` návrh změny, `A` schválit, `R` vrátit.

### 5.3 Editor scénáře (marketér)
- Strukturovaný formulář podle § 4.2 + metadata (kategorie, typ zpracování, profil, charakter, cyklus, měsíc, série/díl, formát, cíl, výzva).
- **Živé kontroly** v postranním panelu (§ 8): délka z časování scén, počet scén, chybějící výzva, hashtag `#vaskonzultant`, hook typ se opakuje po sobě atd. Zeleně / oranžově / červeně.
- Komentáře z kontroly jsou vidět přímo v textu. U návrhu změny tlačítka **Přijmout / Odmítnout**. U komentáře **Odpovědět** a **Označit jako zapracované**.
- Autosave (koncept). **Odeslat ke kontrole** = vytvoří verzi a notifikuje vedení.
- Šablona nového scénáře předvyplněná strukturou z handoff § 6. Tlačítko „Duplikovat jako nový díl série".

### 5.4 Verze a porovnání
- Časová osa verzí u scénáře: v1 (vrácena, 4 komentáře) → v2 (schválena Radkem 5. 11.).
- **Porovnat:** libovolné dvě verze vedle sebe nebo inline diff (přidané zeleně, odebrané červeně), po polích (hook, scéna 2, výzva…). Při druhém kole kontroly se vedení **automaticky otevře diff proti verzi, kterou naposledy vidělo**, aby nečetlo celý scénář znovu.

### 5.5 Scénáře (databáze)
- **Tabulka** (jako list Scénáře) s filtry: cyklus, měsíc, kategorie, typ zpracování, profil, stav schválení, stav výroby, marketér, série, „má problém". Uložitelné pohledy.
- **Kanban** podle stavu schválení (přetažení = změna stavu s ověřením oprávnění).
- Barevná signalizace jako v tabulce: **červená** = chybí / po termínu / problém, **žlutá/oranžová** = čeká na další krok, **zelená** = schváleno / publikováno / splněno.
- Hromadné akce: změnit cyklus, přiřadit marketéra, odeslat vybrané ke kontrole.

### 5.6 Natáčecí den (cyklus)
- Odpočet „Dní do natáčení" a „Dní do termínu schválení".
- Seznam **schválených** scénářů cyklu, seskupený podle **lokace** a pak **účinkujících** (StudioBinder): kdo je potřeba kde, rekvizity, které hooky točit (A/B/C), počet klipů vs. cíl 30–40.
- Varování: neschválené scénáře po termínu, chybějící kategorie do mixu cyklu (§ 7.5).
- **Natáčecí balíček:** export PDF + sdílený odkaz pro štáb (jen čtení, režim „jen dialog", bez interních komentářů, s expirací).
- Po natáčení: hromadně nastavit „Natočeno" / „Nenatočeno" + datum.

### 5.7 Přehled (dashboard = list Přehled)
Přenes všech 7 sekcí z listu Přehled (viz § 7). Každé číslo je **klikací** → otevře filtrovaný seznam scénářů, které za ním stojí.

### 5.8 Série
Seznam aktivních sérií (pozastavené vidět, uzavřené a zrušené schované za filtrem), detail série s díly, uzavření série jako vědomá akce (tlačítko aktivní jen když „Lze uzavřít? = ANO", jinak vysvětlit proč; uložit kdo + kdy).

### 5.9 Publikace
Zápis publikace z detailu videa (profil, datum, varianta, odkaz) + metriky 24 h / 7 dní. Přehled A/B hooků: varianty jednoho videa vedle sebe. Historie formátů a typů hooků (zdroj pro pravidlo „čím se liší od posledních 3 videí").

### 5.10 Nastavení
Vše z § 4.8, editovatelné adminem. Stavy workflow jsou systémové (nejdou smazat, jen přejmenovat popisek). Nový natáčecí cyklus = jedno tlačítko „Přidat další měsíc".

---

## 6 · Workflow a stavy

### 6.1 Stav schválení (sloupec W)

```
Rozpracováno ──(marketér: Odeslat ke kontrole)──► K připomínkám
K připomínkám ──(vedení: Vrátit)──► K dopracování ──(marketér: Odeslat znovu = nová verze)──► K finálnímu schválení
K připomínkám / K finálnímu schválení ──(vedení: Schválit)──► Schváleno
Schváleno ──(kdokoli upraví obsah)──► K finálnímu schválení   (zamčení po schválení, viz níže)
kterýkoli stav ──► Odloženo / Zrušeno   (s důvodem)
```

- **Zamčení po schválení (Planable):** schválený scénář je jen pro čtení. Úprava = „Odemknout pro úpravu" → vznikne koncept nové verze a stav po odeslání je *K finálnímu schválení*. Výjimka: změny metadat, které nemění obsah (cyklus, marketér, stav výroby).
- **Kolik schvalovatelů:** nastavení `Schválení vyžaduje`: jeden z vedení (výchozí) / oba / garant série. Každé rozhodnutí se ukládá per schvalovatel a per verze.

### 6.2 Stav výroby (sloupec AA)
`Čeká na natáčení → Natočeno → Ve střihu → Sestříháno → Publikováno`, plus `Nenatočeno`. Výroba může začít jen u schválených scénářů (jinak varování). „Publikováno" bez záznamu v Publikacích = chyba.

### 6.3 Stav komentáře (sloupec J)
`Nevyřešeno` → marketér odpoví a/nebo přijme návrh → `Zapracováno` → vedení potvrdí → `Uzavřeno` (nebo znovu otevře → `Nevyřešeno`). Komentáře typu „Souhlas / schválení" rovnou `Uzavřeno`. Uzavřené komentáře zůstávají dohledatelné (filtr „zobrazit uzavřené").

---

## 7 · Business logika přehledu (převeď vzorce z listu Přehled)

Implementuj jako čisté funkce v `lib/metrics/` s unit testy. Testovací data vytvoř z ukázkových řádků v tabulce a ověř, že výsledky sedí s tím, co spočítá Excel.

1. **Tematický mix za měsíc publikace** — pro každou kategorii: Cíl %, Plán (ks), Navrženo (scénáře s `plannedMonth` = měsíc, bez Zrušeno a Odloženo), Schváleno, Chybí ke schválení = max(0, plán − schváleno), Natočeno, Publikováno (podle `actualMonth`, tedy skutečného data první publikace), Plnění = publikováno / plán, Stav: `–` / `Publikováno ✔` / `Schváleno ✔` / `Čeká na schválení` / `CHYBÍ SCÉNÁŘE`.
   **Zaokrouhlení plánu:** `round(cíl × podíl)`, kategorie s největším podílem dorovná rozdíl, aby součet = měsíční cíl.
2. **Odborně hodnotná vs. Instagramová** — stejná tabulka pro typ zpracování.
3. **Charakter osobních profilů** — zvlášť Honza a Radek, Osobní/Pracovní: scénáře ks a %, stav přípravy (OK / MIMO POMĚR podle tolerance ± p. b.), publikováno ks a %, stav publikace. Firemní profil se nevyhodnocuje.
4. **Stav scénářů a schvalování pro cyklus** (vybraný cyklus / všechny cykly): plán, scénářů celkem (bez odložených a zrušených), čeká na vedení (K připomínkám + K finálnímu schválení), čeká na marketéry (Rozpracováno + K dopracování), schváleno, chybí schválených do plánu, schváleno a čeká na natáčení, po termínu odevzdání, neschváleno po termínu schválení cyklu, otevřené komentáře, natočeno, odloženo/zrušeno.
5. **Tematický mix pro natáčecí cyklus** — jako 1, ale podle `cycleId` a bez publikací.
6. **Obsahové série** — aktivní série s počty z § 4.6.
7. **Historie po měsících** — měsíc, plán, scénáře (plán. měsíc), schváleno, publikováno, plnění, rozpad publikovaných podle kategorií a typu zpracování. Jako tabulka + jednoduchý graf.

---

## 8 · Automatické kontroly

### 8.1 Kontroly videa (převod sloupce AI, každá = samostatné pravidlo s kódem)
- `OVERDUE_SCRIPT`: termín odevzdání prošel a stav není Schváleno / Odloženo / Zrušeno → „Po termínu odevzdání."
- `APPROVED_NO_SIGNATURE`: Schváleno bez jména / data (v aplikaci by nemělo nastat, ale kontrola zůstane kvůli importu)
- `MISSING_CLASSIFICATION`: chybí kategorie, typ zpracování, profil nebo měsíc
- `MISSING_CHARACTER`: profil Honza/Radek a charakter prázdný nebo „Nevztahuje se"
- `APPROVED_WITH_OPEN_COMMENTS`: Schváleno, ale má nevyřešené komentáře
- `PUBLISHED_NO_RECORD`: stav výroby Publikováno a 0 publikací
- `SERIES_NO_EPISODE`: má sérii, nemá číslo dílu
- `CYCLE_DEADLINE_MISSED`: cyklus má termín schválení, ten prošel a scénář není Schváleno / Odloženo / Zrušeno

### 8.2 Kontroly série (převod sloupců X a Y listu Série)
- „Lze uzavřít?" = ANO, když publikováno ≥ plán, 0 nevyřešených komentářů, 0 publikací bez odkazu; jinak výpis důvodů („Publikováno 3 z 8. Otevřené připomínky: 2.")
- Uzavřeno bez potvrzení kdo/kdy · uzavřeno bez splněných podmínek · změněn rozsah bez důvodu · víc dílů než plán

### 8.3 Kontroly obsahu scénáře **[NOVÉ]** (z handoff § 4 a § 7, editovatelné v Nastavení)
Každé pravidlo má: kód, popis, závažnost (**zamítací** / varování / tip), typ (automatické / ruční zaškrtnutí). Výchozí sada:

| Pravidlo | Typ | Jak ověřit |
|---|---|---|
| Hook do 2 s, žádné představování | auto + ruční | první scéna začíná v 0 s, končí ≤ 2 s; text hooku neobsahuje „Ahoj", „jsme", „jmenuji se" |
| Délka 12–25 s (díl série 20–30 s) | auto | součet časování scén |
| Max. 3 scény | auto | počet řádků scén |
| Jedna výzva ze tří, zazní nahlas | auto | vyplněný typ výzvy; text neobsahuje „sleduj" |
| Výzva odpovídá cíli videa | auto | sdílení → pošli kolegovi, uložení → ulož si, komentáře → otázka |
| Žádné nepotvrzené číslo | auto | všechna `numbersToConfirm` potvrzena; detekce číslic ve scénáři nabídne „označit jako číslo k potvrzení" |
| Přidaná hodnota (divák se dozví fakt) | auto + ruční | vyplněno „Co se divák dozví" + zdroj |
| Logický dialog | ruční | — |
| Pointa vede k pilíři, ne k produktu | ruční | — |
| Formát a typ hooku se liší od posledních 2 videí | auto | porovnat s posledními publikacemi (výjimka: díl série) |
| Max. 2 videa stejného formátu v týdnu | auto | podle plánovaného data publikace |
| 3–5 hashtagů, vždy `#vaskonzultant` + jméno toho, kdo hraje | auto | |
| Nový (🧪) formát → Trial Reel | auto | |
| GDPR: žádná jména klientů, data, obrazovky | ruční | |

Kontroly jsou **pomoc, ne byrokracie**: zamítací pravidla zobraz jako červený odznak a v kontrolní frontě nahoře, ale schválení nikdy technicky neblokuj.

### 8.4 Volitelně (fáze 5): AI kontrola scénáře
Tlačítko „Zkontrolovat AI" → pošle scénář + pravidla z Nastavení do Claude API (`claude-sonnet-5-5`, klíč v env) → vrátí návrhy jako komentáře typu „Nápad" s `visibility: internal`, autor „AI asistent". Nikdy neschvaluje a nikdy nemění text sama.

---

## 9 · Rozesílání a notifikace

**Kanály:** in-app (zvoneček + „Co je na mně") a e-mail (Resend nebo SMTP). Uživatel si v profilu nastaví, co chce dostávat.

| Událost | Komu | Kdy |
|---|---|---|
| Scénář odeslán ke kontrole | schvalovatelé | **sdružit:** 1 e-mail „5 nových scénářů ke kontrole pro natáčení 20. 11." max. jednou za hodinu, ne 5 e-mailů |
| Scénář vrácen / schválen | autor (marketér) | hned |
| Nový komentář / odpověď / @zmínka | autor vlákna, zmínění | hned (in-app), e-mail sdružený |
| Návrh změny přijat / odmítnut | autor návrhu | in-app |
| Připomínka termínu schválení | vedení | **T−3 dny a T−1 den** před termínem schválení cyklu, jen pokud ještě něco čeká |
| Termín odevzdání scénáře | marketér | den předem + v den termínu |
| Denní souhrn | každý podle role | 8:00 Europe/Prague, jen když je co hlásit |
| Natáčecí balíček | štáb (e-maily zadá admin) | ručně tlačítkem „Rozeslat štábu" |
| Týdenní report pro vedení (fáze 4) | vedení | pondělí: mix měsíce, co čeká, co vyšlo |

**Přihlášení bez tření:** magic link e-mailem (bez hesla). Odkaz v notifikaci vede **přímo do kontrolní fronty / ke konkrétnímu komentáři** a uživatele rovnou přihlásí (podepsaný token s expirací 7 dní). Honza nesmí řešit heslo.

Všechny e-maily česky, krátké, s jedním hlavním tlačítkem („Zkontrolovat 5 scénářů").

---

## 10 · Import a export

- **Import z xlsx** (`scripts/import-xlsx.ts`): listy Scénáře, Připomínky, Publikace, Série, Nastavení (číselníky, mix, cykly). Data začínají na řádku 4, hlavička je na řádku 3. Řádky s „UKÁZKA" v názvu importovat s příznakem `isSample`, aby šly jedním klikem smazat. Text scénáře ze sloupce O dát do pole „Poznámka / původní text", URL do externího odkazu. Připomínky ze sloupce F → obecné (neukotvené) komentáře, G/H/I → první odpověď. Import musí být **idempotentní** (opakované spuštění nevytvoří duplicity, klíč = ID videa / ID série).
- **Export:** CSV/XLSX libovolného filtrovaného pohledu; PDF scénáře; PDF „zpráva z kontroly" (verze, komentáře, rozhodnutí, časy — Filestage).
- **Záloha:** denní dump databáze (Supabase to umí, jen ověř a zdokumentuj).

---

## 11 · Technologie (doporučení, uprav, pokud máš silný důvod)

- **Next.js (App Router) + TypeScript**, server actions / route handlers
- **Supabase:** Postgres, Auth (magic link), Realtime (komentáře a stavy se aktualizují živě, když s tím pracují dva lidé), Row Level Security, Storage (přílohy, PDF)
- **Drizzle ORM** (nebo Prisma) + migrace
- **TipTap** pro textová pole, vlastní systém kotev komentářů
- **Tailwind + shadcn/ui**, ikony lucide
- **Resend** na e-maily, **react-email** šablony
- **Cron:** Vercel Cron nebo Supabase scheduled functions (souhrny, připomínky)
- **PDF:** Playwright (HTML → PDF) nebo react-pdf
- **Testy:** Vitest (business logika § 7 a § 8 povinně), Playwright e2e (scénář: marketér napíše → odešle → vedení na mobilní šířce okomentuje text, navrhne změnu, vrátí → marketér přijme návrh, odpoví, odešle v2 → vedení vidí diff, schválí → objeví se v natáčecím dni)
- **Nasazení:** Vercel + Supabase. `.env.example`, README v češtině (jak spustit lokálně, jak nasadit, jak importovat xlsx).

**Design:** čisté a čitelné, bez dekorací. Scénář se čte jako scénář (velký řádkový proklad, mluvčí tučně, časování v šedém sloupci). Barvy stavů konzistentní napříč aplikací (červená / oranžová / zelená, jako v tabulce). Tmavý režim. Responzivní od 360 px. Přístupnost: kontrast AA, ovládání klávesnicí.

---

## 12 · Co aplikace NEDĚLÁ (aspoň zatím)

- Nepublikuje na Instagram / Facebook (publikace se jen zapisuje).
- Nestahuje metriky z Meta API automaticky (ruční zápis, fáze 4 možná import CSV z Business Suite).
- Nehostuje video soubory (jen odkazy na Disk / Frame.io / WeTransfer).
- Není to obecný projektový nástroj. Jen tento workflow.

---

## 13 · Fáze a akceptační kritéria

**Fáze 1 — Základ a kontrola scénářů (MVP, priorita)**
Auth + role, datový model + migrace, Nastavení (číselníky), seznam scénářů (tabulka + filtry), strukturovaný editor scénáře, odeslání ke kontrole s verzemi, **kontrolní fronta (desktop + mobil)** s ukotvenými komentáři, vlákny, návrhy změn, stavy komentářů, schválit / vrátit, zamčení po schválení, in-app notifikace, activity log.
✅ *Hotovo, když:* projdu e2e scénář z § 11 na mobilní šířce 390 px bez jediného zaseknutí a v historii je vidět, kdo co kdy udělal.

**Fáze 2 — Rozesílání a termíny**
Natáčecí cykly, termíny, e-mailové notifikace se sdružováním, magic link přímo do fronty, připomínky T−3/T−1, denní souhrn, diff verzí s „od posledního zobrazení".
✅ *Hotovo, když:* odeslání 5 scénářů pošle schvalovateli 1 e-mail a kliknutím je rovnou ve frontě přihlášený.

**Fáze 3 — Přehled, série, kontroly**
Dashboard se všemi 7 sekcemi (§ 7), série včetně „Lze uzavřít?", automatické kontroly § 8.1–8.3, kanban, uložené pohledy, import xlsx.
✅ *Hotovo, když:* po importu `docs/GTA_Planovani_videoobsahu_1.xlsx` sedí čísla v Přehledu s Excelem pro měsíc `2026-11` a cyklus `2026-11` (napiš na to test).

**Fáze 4 — Natáčecí den a publikace**
Natáčecí balíček (seskupení podle lokace a účinkujících, PDF, sdílený odkaz pro štáb), hromadné „Natočeno", publikace s variantami a metrikami 24 h / 7 dní, historie formátů a hooků, týdenní report.

**Fáze 5 — Volitelné**
AI kontrola scénáře (§ 8.4), komentáře s časovou značkou k sestřihu (vložený přehrávač z odkazu), import metrik z CSV.

---

## 14 · Otevřené otázky (zeptej se mě, výchozí hodnota v závorce)

1. **Tematický mix:** platí poměr z tabulky (30/40/20/10) nebo z handoffu (30/30/20/20)? A jaké přesné názvy kategorií? *(výchozí: názvy a podíly z handoffu, editovatelné)*
2. Kolik schvalovatelů musí scénář schválit — jeden z vedení, oba, nebo garant série? *(jeden z vedení)*
3. Kolik je marketérů a kdo všechno ze štábu potřebuje účet? *(3 marketéři, 1 účet výroba)*
4. Mají Honza a Radek vidět interní komentáře marketérů? *(ne)*
5. Z jaké adresy chodí e-maily a na jaké doméně aplikace poběží? *(zatím Resend sandbox, Vercel subdoména)*
6. Je profil „GTA Partners" firemní profil, který se má hodnotit v mixu, nebo jen evidovat? *(evidovat, nehodnotit charakter)*
7. Notifikace kromě e-mailu i jinam (WhatsApp, Slack)? *(jen e-mail + in-app)*

---

*Zdrojové podklady: `docs/GTA_Planovani_videoobsahu_1.xlsx` (listy Návod, Přehled, Scénáře, Připomínky, Publikace, Série, Nastavení), `docs/HANDOFF-vas-konzultant.md` (v4, 23. 10. 2026), `docs/vas-konzultant-profil-klienta.md`.*
