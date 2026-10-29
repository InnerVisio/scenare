# Analysis of `GTA_Planovani_videoobsahu_1.xlsx`

Source: `/home/user/scenare/docs/GTA_Planovani_videoobsahu_1.xlsx` (read-only analysis; workbook not modified).
Method: `openpyxl` (formulas via `data_only=False`, cached values via `data_only=True`) plus direct inspection of the unzipped OOXML parts, because openpyxl **silently drops the `x14:dataValidations` extension** (all dropdown lists are stored there, see section 0.3). Helper scripts live in `/tmp/claude-0/-home-user-scenare/98c07cc4-1997-55ed-ba1f-199886e159d3/scratchpad/`.

---

## 0. Workbook-level facts

### 0.1 Sheets (in order)

| # | Sheet | Used range | Frozen panes | AutoFilter | Notes |
|---|-------|-----------|--------------|-----------|-------|
| 1 | `Návod` | B1:C28 | none | none | Instructions (2 columns: label B, text C) |
| 2 | `Přehled` | A1:L93 | `A7` (rows 1-6 frozen) | none | Dashboard. **Sheet protection on** (`sheet="1"`, no password; `formatColumns`/`formatRows` allowed). Only `C3`, `C4` are unlocked. |
| 3 | `Scénáře` | A1:AI503 | `C4` (cols A:B + rows 1-3) | `A3:AI503` | Main database. Active tab when saved. |
| 4 | `Připomínky` | A1:J503 | `C4` | `A3:J503` | |
| 5 | `Publikace` | A1:H503 | `C4` | `A3:H503` | |
| 6 | `Série` | A1:AA103 | `C4` | `A3:AA103` | Only 100 data rows (4-103) |
| 7 | `Nastavení` | A1:U54 | `A3` (rows 1-2 frozen) | none | Parameters + lookup lists |

All sheets visible. No comments, drawings, charts, images, hyperlinks objects in the package. No external links.

### 0.2 Defined names

There are **no user-defined named ranges**. The only defined names are four hidden, sheet-scoped `_xlnm._FilterDatabase` entries (autofilter bookkeeping):

| Name | Scope | Refers to |
|------|-------|-----------|
| `_xlnm._FilterDatabase` | `Scénáře` | `Scénáře!$A$3:$AI$503` |
| `_xlnm._FilterDatabase` | `Připomínky` | `Připomínky!$A$3:$J$503` |
| `_xlnm._FilterDatabase` | `Publikace` | `Publikace!$A$3:$H$503` |
| `_xlnm._FilterDatabase` | `Série` | `Série!$A$3:$AA$103` |

All dropdown lists and formulas use direct A1 references (e.g. `Nastavení!$U$4:$U$42`), never names.

### 0.3 File metadata / quirks

- Created by `openpyxl` (creator), last modified by "Jan Gizický" in Microsoft Macintosh Excel 16.03; created `2026-10-26T09:21:48Z`, modified `2026-10-26T09:40:56Z`. All cached values therefore correspond to **TODAY() = 2026-10-26** (see Nastavení!B6 cached `2026-10-26`).
- Calc chain present (`calcChain.xml`), `calcPr calcId=191029`. All 5 884 formula cells have cached values (empty-string results are cached as `<v/>` with `t="str"`; openpyxl shows them as `None`). **No cached value is missing.**
- Shared formulas are used in places (e.g. `Přehled!B14:H14`, `SUM(B10:B13)` shared); openpyxl expands them on read.
- Uses `_xlfn.MINIFS` (Scénáře!AG) -> needs Excel 2019+/365 or Google Sheets. `FALSE()` is written as a function call in VLOOKUP.
- Month keys (`2026-11`) and cycle IDs are **text strings**, not dates. Formulas compare them as text (COUNTIFS with text criterion, `YEAR(AG)&"-"&TEXT(MONTH(AG),"00")` to build them).
- Date format used everywhere: `dd.mm.yyyy`.

### 0.4 Colour convention (cell fills)

| Fill | Meaning |
|------|---------|
| `FFFFF2CC` (light yellow) | input cell (Přehled C3/C4, Nastavení parameters and list items) |
| `FFEDEDED` (light grey) | computed cell - do not overwrite |
| `FFDCE6F1` header fill / band `FF2F75B5` (blue) | filled by marketér |
| `FFFCE4D6` header / band `FFC65911` (orange) | filled by vedení (Honza / Radek) |
| `FFE2EFDA` header / band `FF548235` (green) | production (Výroba) |
| `FFEDEDED` header / band `FF7F7F7F` (grey) | automatic - do not overwrite |

Data-cell fills in rows 4+ are `None` (white) for input columns and `FFEDEDED` for formula columns.

---

## 1. Sheet `Návod` (verbatim text)

Layout: column B = label (bold headings), column C = text. There are no formulas.

```
B1  NÁVOD – PLÁNOVÁNÍ, SCHVALOVÁNÍ A KONTROLA VIDEOOBSAHU

B3  K ČEMU SOUBOR SLOUŽÍ
C4  Jeden sdílený soubor pro dlouhodobou práci: každý měsíc se přidá nový natáčecí cyklus, scénáře se vkládají do společné databáze a Přehled se přepne na daný měsíc. Nic se nekopíruje, historie zůstává v témže souboru (filtrem podle měsíce nebo cyklu).

B5  LISTY
B6  Přehled
C6  Kontrolní panel pro vedení. Mění se jen dvě žluté buňky: vyhodnocovaný měsíc a natáčecí cyklus. Vše ostatní se počítá samo.
B7  Scénáře
C7  Hlavní databáze. Jeden řádek = jedno unikátní video nebo jeden díl série. Modré sloupce vyplňuje marketér, oranžové vedení, zelené výroba, šedé se počítají automaticky (nepřepisovat).
B8  Připomínky
C8  Každá připomínka Honzy / Radka = jeden řádek. Marketér doplní reakci, vedení nastaví stav (Nevyřešeno → Zapracováno → Uzavřeno). Připomínky zůstávají dohledatelné i po zapracování.
B9  Publikace
C9  Jeden řádek = jedno zveřejnění (profil × varianta). Z tohoto listu se bere datum první publikace a skutečný měsíc. Více zveřejnění jednoho videa (více profilů, hook A/B, repost) počet unikátních videí nezvyšuje.
B10 Série
C10 Jedna série = jeden řádek. Díly se evidují v listu Scénáře (sloupec ID série + Číslo dílu). Počty připravených, schválených, natočených a publikovaných dílů se dopočítají automaticky. Uzavření série je vědomé rozhodnutí: stav Uzavřená + kdo + kdy; sloupec „Lze uzavřít?“ hlídá podmínky.
B11 Nastavení
C11 Cíl videí za měsíc, poměry 30/40/20/10, 30/70 a 70/30, tolerance, natáčecí cykly (datum natáčení → termín schválení automaticky 7 dní předem), seznamy lidí a profilů.

B12 MĚSÍČNÍ POSTUP
B13 1. Nastavení
C13 Do tabulky natáčecích cyklů doplňte datum natáčení (řádek pro daný měsíc už existuje). Termín schválení se dopočítá.
B14 2. Marketéři
C14 Do listu Scénáře vloží každé téma: ID videa (např. V026), název, cyklus, plánovaný měsíc publikace, kategorii, typ zpracování, profil, charakter (u Honzy / Radka), cíl, myšlenku, scénář (text nebo odkaz na sdílený dokument), hooky, termín odevzdání a stav „K připomínkám“, jakmile je scénář hotový.
B15 3. Vedení
C15 Honza / Radek otevřou scénář, připomínky píší do listu Připomínky. V listu Scénáře nastaví stav „K dopracování“, nebo „Schváleno“ + Schválil + Datum schválení. Bez jména a data se schválení hlásí jako chyba.
B16 4. Před natáčením
C16 V Přehledu zkontrolujte sekce 4 a 5 (co chybí do mixu, kolik je po termínu). V listu Scénáře vyfiltrujte Stav schválení = Schváleno a daný cyklus – to je sada pro natáčecí den.
B17 5. Po natáčení
C17 Výroba nastaví Stav výroby (Natočeno → Ve střihu → Sestříháno → Publikováno) a doplní odkazy. Každé zveřejnění zapíše do listu Publikace (profil, datum, varianta, odkaz).
B18 6. Kontrola publikace
C18 V Přehledu přepněte měsíc – sloupce Publikováno a Plnění ukážou, zda skutečně zveřejněný obsah odpovídá mixu. Sekce 7 ukazuje historii po měsících.

B19 SÉRIE
C20 Novou sérii založte v listu Série (ID např. S03, název, kategorie, garant, plánovaný počet dílů). Každý díl vložte do listu Scénáře jako samostatné video s ID série a číslem dílu. Díl má vlastní kategorii, typ zpracování i měsíc publikace – do měsíčního mixu se počítá každý díl zvlášť podle svého měsíce. Pokud se změní počet dílů, upravte „Plánovaný počet dílů“ a vyplňte důvod změny.

B21 BAREVNÁ SIGNALIZACE
B22 Červená
C22 Chybí scénáře, prošlý termín, nevyřešená kontrola, poměr mimo toleranci.
B23 Žlutá / oranžová
C23 Čeká na další krok (vedení nebo marketér), chybějící údaj.
B24 Zelená
C24 Schváleno / publikováno / splněno.

B25 GOOGLE TABULKY
C26 Soubor nahrajte na Disk Google, otevřete a zvolte Soubor → Uložit jako Tabulky Google. Vzorce, rozbalovací seznamy i barevné zvýraznění fungují beze změn, získáte historii verzí a souběžnou práci více lidí. Pracujte dál jen v googlovské verzi.

B27 ZÁSADY
C28 Nemažte a nepřejmenovávejte stavy v Nastavení (používají je vzorce). Neměňte pořadí sloupců v listu Scénáře. Nové řádky vkládejte do volných řádků pod poslední záznam (vzorce jsou připravené do řádku 503; u sérií do 103). Ukázkové řádky označené „UKÁZKA“ smažte, až začnete pracovat naostro.
```

Note: in the actual cells the heading rows B3/B5/B12/B19/B21/B25/B27 have no C text on the same row (C4, C20, C26, C28 hold the paragraph text on the row below the heading). Rows 2, 4-in-B, etc. are blank.

---

## 2. Sheet `Nastavení` (settings and lookup lists)

Header layout differs from the data sheets: title `A1`, hint `A2`, then several independent blocks. Yellow (`FFFFF2CC`) = editable, grey (`FFEDEDED`) = computed.

### 2.1 Scalar parameters

| Cell | Label (col A) | Value (col B) | Type | Note (col C) |
|------|---------------|---------------|------|--------------|
| B3 | Cíl publikovaných videí za měsíc | **16** | input | "Výchozí hodnota ze zadání: 16 videí/měsíc. Cíl natáčecího dne (30–40 klipů) je jiný údaj – viz tabulka cyklů." |
| B4 | Termín schválení scénářů – dní před natáčením | **7** | input | "Výchozí hodnota ze zadání: 7 dní." |
| B5 | Tolerance odchylky poměrů (v procentních bodech) | **10** | input | "Odchylka skutečného podílu od cíle, která se ještě považuje za OK (platí pro poměry v Přehledu)." Used as `B5/100` in Přehled. |
| B6 | Dnešní datum (automaticky) | `=TODAY()` (cached 2026-10-26) | formula | grey; **no formula in the workbook references Nastavení!B6** - formulas call `TODAY()` directly |

### 2.2 Thematic mix (A8:F14) - "TEMATICKÝ MIX (cíl za měsíc)"

Header row 9: `Kategorie | Cílový podíl | Přesně (videí) | Zaokrouhleno | Cíl videí / měsíc | Tematické vymezení`.

| Row | A Kategorie | B Cílový podíl (input) | C Přesně | D Zaokrouhleno | E Cíl videí / měsíc | F Tematické vymezení |
|-----|-------------|------------------------|---------|----------------|---------------------|----------------------|
| 10 | Nábor, vedení lidí a práce s týmem | 0.3 (30 %) | 4.8 | 5 | 5 | Firemní kultura, mentoring, práce asistentek, vzdělávání, manažerský růst, atraktivita kariérní příležitosti. |
| 11 | Osobní brand & Lifestyle | 0.4 (40 %) | 6.4 | 6 | 6 | Zákulisí, každodenní život, rodina, sport, cestování, hobby, osobní příběhy, humor. |
| 12 | Trendy a reakce na trh | 0.2 (20 %) | 3.2 | 3 | 3 | ČNB, inflace, hypotéky, investiční trhy, makroekonomické události. |
| 13 | Produktové a poradenské tipy | 0.1 (10 %) | 1.6 | 2 | 2 | Finanční plánování, investice, pojištění, energie, klientský servis, praktické finanční rady. |
| 14 | Celkem | `=SUM(B10:B13)` -> cached **0.9999999999999999** | | | `=SUM(E10:E13)` = 16 | "Součet podílů musí být 100 %. Zaokrouhlení: kategorie s největším podílem dorovná rozdíl, aby součet odpovídal cíli." |

Formulas (first row, row 10, verbatim):
- `C10: =$B$3*B10`
- `D10: =ROUND(C10,0)`
- `E10: =IF(ROW()-10+1=MATCH(MAX($B$10:$B$13),$B$10:$B$13,0),$B$3-SUM($D$10:$D$13)+D10,D10)`

Logic of E: largest-remainder-style rounding - every category gets `ROUND(target*share)`; the category with the **largest share** (first one on ties, `MATCH(...,0)`) absorbs the rounding difference so that `SUM(E) = B3`. (With B3=16: 5+6+3+2 = 16, difference 0.) Note `ROUND` is Excel round-half-away-from-zero.

### 2.3 Odborně hodnotné vs. Instagramové (A16:F20)

Header row 17: `Typ zpracování | Cílový podíl | Přesně (videí) | Zaokrouhleno | Cíl videí / měsíc | Vymezení`.

| Row | A | B (input) | C | D | E | F |
|-----|---|-----------|---|---|---|---|
| 18 | Odborně hodnotné | 0.3 | 4.8 | 5 | 5 | Předává konkrétní poznatek, vysvětluje souvislosti, dává praktickou radu nebo odborný pohled. |
| 19 | Instagramové | 0.7 | 11.2 | 11 | 11 | Situační humor, krátké scénky, trendy, osobní příběhy, zákulisí, jednoduchá atraktivní sdělení. |
| 20 | Celkem | `=SUM(B18:B19)` = 1 | | | `=SUM(E18:E19)` = 16 | |

Formulas row 18: `C18: =$B$3*B18`, `D18: =ROUND(C18,0)`, `E18: =IF(ROW()-18+1=MATCH(MAX($B$18:$B$19),$B$18:$B$19,0),$B$3-SUM($D$18:$D$19)+D18,D18)` (same remainder-absorption logic, over rows 18-19).

### 2.4 Charakter osobních profilů (A22:F26)

Header row 23: `Charakter obsahu | Cílový podíl | (C,D,E empty) | Poznámka (F23)`.

| Row | A | B (input) | F |
|-----|---|-----------|---|
| 24 | Osobní | 0.7 | "Vyhodnocuje se zvlášť pro profil Honza a zvlášť pro profil Radek. Firemní profil GTA Partners se tímto poměrem neřídí." |
| 25 | Pracovní | 0.3 | |
| 26 | Celkem | `=SUM(B24:B25)` = 1 | |

### 2.5 Natáčecí cykly (A28:G54)

Title A28: "NATÁČECÍ CYKLY (jeden řádek = jeden natáčecí den; nový měsíc = nový řádek)". Header row 29 (A29:G29):
`Natáčecí cyklus (ID) | Datum natáčení | Termín schválení scénářů | Plán videí pro cyklus | Které měsíce publikace pokrývá | Cíl klipů z natáčecího dne | Poznámka`.

Data rows **30-53 (24 cycles, `2026-10` ... `2028-09`)**:
- A = cycle ID text (yellow input), pre-filled `2026-10`, `2026-11`, `2026-12`, `2027-01`, ..., `2028-09` (monthly sequence).
- B = Datum natáčení (yellow, date, DV: date > 2000-01-01). **Filled only for 2 rows**: B30 = 2026-10-08, B31 = 2026-11-20. All others empty.
- C = grey formula: `=IF(B30="","",B30-$B$4)` (shoot date minus B4 days). Cached: C30 = 2026-10-01, C31 = 2026-11-13, C32.. = "".
- D = yellow-but-prefilled formula `=$B$3` (cached 16) - may be overwritten manually (e.g. 32 for two months).
- E = text equal to A (e.g. `2026-10`) - which publication months the cycle covers (yellow input).
- F = text `30–40` (en-dash) for all rows ("Cíl klipů z natáčecího dne").
- G = notes: G30 = `UKÁZKA`, G31 = `UKÁZKA – datum natáčení doplňte podle skutečnosti`, others empty.
- A54 note: "Plán videí pro cyklus je předvyplněn vzorcem = měsíční cíl. Pokud natáčecí den pokrývá více měsíců, přepište číslo ručně (např. 32 pro dva měsíce) a do sloupce E uveďte oba měsíce."

Observation: column E ("Které měsíce publikace pokrývá") is **not read by any formula**; relationship cycle <-> month is only by the per-row `Natáčecí cyklus` column in Scénáře.

### 2.6 Lookup lists (I2:U42)

Section title I2: "SEZNAMY PRO ROZBALOVACÍ NABÍDKY (žluté položky lze doplnit / přejmenovat; stavy a typy neměňte, používají je vzorce)". Headers in row 3; values from row 4. Yellow items are editable; `U` (months) is grey.

| Col | Header (row 3) | Values (row 4 downward) | Dropdown range in use |
|-----|----------------|--------------------------|----------------------|
| I | Marketéři | `Marketér A`, `Marketér B`, `Marketér C` (I4:I6; I7:I18 are empty yellow slots) | `I4:I18` (15 slots) |
| J | Schvalovatelé (vedení) | `Honza`, `Radek` (J4:J5; J6:J8 empty slots) | `J4:J8` (5 slots) |
| K | Profily | `GTA Partners`, `Honza`, `Radek` (K4:K6; K7:K11 empty slots) | `K4:K11` (8 slots) |
| L | Typ zpracování | `Odborně hodnotné`, `Instagramové` | `L4:L5` |
| M | Charakter pro osobní profil | `Osobní`, `Pracovní`, `Nevztahuje se` | `M4:M6` |
| N | Stav schválení | `Rozpracováno`, `K připomínkám`, `K dopracování`, `K finálnímu schválení`, `Schváleno`, `Odloženo`, `Zrušeno` | `N4:N10` |
| O | Stav výroby | `Čeká na natáčení`, `Natočeno`, `Ve střihu`, `Sestříháno`, `Publikováno`, `Nenatočeno` | `O4:O9` |
| P | Stav série | `Návrh`, `Rozpracovaná`, `Ve výrobě`, `V publikaci`, `Dokončená`, `Uzavřená`, `Pozastavená`, `Zrušená` | `P4:P11` |
| Q | Stav připomínky | `Nevyřešeno`, `Zapracováno`, `Uzavřeno` | `Q4:Q6` |
| R | Typ připomínky | `Připomínka`, `Odborné doplnění`, `Požadavek na úpravu`, `Nápad`, `Souhlas / schválení` | `R4:R8` |
| S | Typ obsahu | `Nové téma`, `Nové zpracování úspěšného tématu`, `Nový střih existujícího videa` | `S4:S6` |
| T | Varianta publikace | `Hlavní verze`, `Hook A`, `Hook B`, `Hook C`, `Alternativní střih`, `Opakovaná publikace` | `T4:T9` |
| U | Měsíce publikace | 39 text values `2026-10`, `2026-11`, ..., `2029-12` (U4:U42, consecutive months; grey) | `U4:U42` |

Months list U4:U42 in full: 2026-10, 2026-11, 2026-12, 2027-01 ... 2027-12, 2028-01 ... 2028-12, 2029-01 ... 2029-12 (all text, no gaps - 3 + 12 + 12 + 12 = 39).

Hard-coded status strings used by formulas (must not be renamed): Stav schválení `Schváleno`, `Zrušeno`, `Odloženo`, `K připomínkám`, `K finálnímu schválení`, `Rozpracováno`, `K dopracování`; Stav výroby `Čeká na natáčení`, `Natočeno`, `Ve střihu`, `Sestříháno`, `Publikováno`; Stav série `Uzavřená`, `Zrušená`; Stav připomínky `Nevyřešeno`; Charakter `Nevztahuje se`; profiles `Honza`, `Radek`.

### 2.7 Conditional formatting on Nastavení

`B14`, `B20`, `B26`: cellIs `notEqual 1` -> fill `FFF8CBAD` (red/salmon). **Surprise:** B14 cached value is `0.99999999999999989` (30%+40%+20%+10% in floating point), so in strict-equality evaluation the "must be 100 %" warning would fire; Excel treats it as 1 (15-digit comparison). A port must compare with rounding/tolerance.

Data validation: `B30:B53` date > 36526 (2000-01-01), error title "Neplatné datum", message "Zadejte datum ve formátu DD.MM.RRRR.".

---

## 3. Sheet `Scénáře` (main database)

- Row 1: title in A1 "DATABÁZE TÉMAT A SCÉNÁŘŮ – jeden řádek = jedno unikátní video nebo jeden díl série".
- Row 2: merged band headings: `A2:V2` "VYPLŇUJE MARKETÉR" (blue), `W2:Z2` "VYPLŇUJE VEDENÍ (Honza / Radek)" (orange), `AA2:AD2` "VÝROBA A POSTPRODUKCE" (green), `AE2:AI2` "AUTOMATICKY – NEPŘEPISOVAT" (grey).
- **Row 3 = headers (verified)**, **data from row 4 (verified)**, rows 4-503 = 500 pre-formatted rows; formulas pre-filled in AE:AI for all 500 rows (each column has exactly one distinct formula pattern across rows 4-503, verified by normalising the row number).
- 35 columns (A:AI).

### 3.1 Columns

| Col | Header (row 3) | Kind | Dropdown / validation |
|-----|----------------|------|-----------------------|
| A | ID videa | input (marketér) | none (free text, e.g. `V001`); referenced as key by other sheets |
| B | Pracovní název | input | none |
| C | ID série | input | list `Série!$A$4:$A$103` |
| D | Číslo dílu | input | none |
| E | Natáčecí cyklus | input | list `Nastavení!$A$30:$A$53` |
| F | Plánovaný měsíc publikace | input | list `Nastavení!$U$4:$U$42` |
| G | Tematická kategorie | input | list `Nastavení!$A$10:$A$13` |
| H | Typ zpracování | input | list `Nastavení!$L$4:$L$5` |
| I | Primární profil | input | list `Nastavení!$K$4:$K$11` |
| J | Charakter pro osobní profil | input | list `Nastavení!$M$4:$M$6` |
| K | Typ obsahu | input | list `Nastavení!$S$4:$S$6` |
| L | Původní ID videa (při novém zpracování / střihu) | input | none |
| M | Cíl videa | input | none |
| N | Hlavní myšlenka | input | none |
| O | Kompletní scénář (text nebo odkaz na dokument) | input | none |
| P | Hook A | input | none |
| Q | Hook B | input | none |
| R | Hook C | input | none |
| S | Produkční požadavky (lokace, rekvizity, účinkující) | input | none |
| T | Zodpovědný marketér | input | list `Nastavení!$I$4:$I$18` |
| U | Termín odevzdání scénáře | input (date) | date > 36526 |
| V | Poznámky marketéra | input | none |
| W | Stav schválení | input (vedení) | list `Nastavení!$N$4:$N$10` |
| X | Schválil | input (vedení) | list `Nastavení!$J$4:$J$8` |
| Y | Datum schválení | input (vedení, date) | date > 36526 |
| Z | Poznámka vedení | input (vedení) | none |
| AA | Stav výroby | input (výroba) | list `Nastavení!$O$4:$O$9` |
| AB | Skutečné datum natáčení | input (výroba, date) | date > 36526 |
| AC | Odkaz na natočený materiál | input (výroba) | none |
| AD | Odkaz na finální video | input (výroba) | none |
| AE | Otevřené připomínky | **formula (grey)** | - |
| AF | Počet publikací | **formula (grey)** | - |
| AG | Datum první publikace | **formula (grey)** | - |
| AH | Skutečný měsíc publikace | **formula (grey)** | - |
| AI | Kontrola (co je potřeba dořešit) | **formula (grey)** | - |

Date validation (applies to `U4:U503 Y4:Y503 AB4:AB503`): type `date`, operator `greaterThan`, formula1 `36526`, allowBlank, error title "Neplatné datum", error "Zadejte datum ve formátu DD.MM.RRRR.". All list validations: `allowBlank=1`, `showErrorMessage=1`, error title "Neplatná hodnota", error "Vyberte hodnotu z rozbalovacího seznamu." (default "stop" style).

Resolved list values for the Scénáře dropdowns:
- C: S-IDs from `Série!A4:A103` (currently `S01`, `S02`; rest blank).
- E: cycle IDs `2026-10` ... `2028-09` (24 values).
- F: months `2026-10` ... `2029-12` (39 values).
- G: the 4 categories (see 2.2).
- H: `Odborně hodnotné`, `Instagramové`.
- I: `GTA Partners`, `Honza`, `Radek` (+ 5 blank slots).
- J: `Osobní`, `Pracovní`, `Nevztahuje se`.
- K: `Nové téma`, `Nové zpracování úspěšného tématu`, `Nový střih existujícího videa`.
- T: `Marketér A`, `Marketér B`, `Marketér C` (+ 12 blank slots).
- W: 7 approval states; X: `Honza`, `Radek` (+3 blank slots); AA: 6 production states.

### 3.2 Formulas (row 4 verbatim; identical pattern in rows 4-503)

```
AE4: =IF($A4="","",COUNTIFS(Připomínky!$A$4:$A$503,$A4,Připomínky!$J$4:$J$503,"Nevyřešeno"))
AF4: =IF($A4="","",COUNTIFS(Publikace!$A$4:$A$503,$A4))
AG4: =IF($A4="","",IF(AF4=0,"",_xlfn.MINIFS(Publikace!$E$4:$E$503,Publikace!$A$4:$A$503,$A4)))
AH4: =IF(AG4="","",YEAR(AG4)&"-"&TEXT(MONTH(AG4),"00"))
AI4: =IF($A4="","",TRIM(IF(AND($U4<>"",$U4<TODAY(),$W4<>"Schváleno",$W4<>"Odloženo",$W4<>"Zrušeno"),"Po termínu odevzdání. ","")&IF(AND($W4="Schváleno",OR($X4="",$Y4="")),"Schváleno bez jména / data. ","")&IF(OR($G4="",$H4="",$I4="",$F4=""),"Chybí zařazení (kategorie, typ, profil nebo měsíc). ","")&IF(AND(OR($I4="Honza",$I4="Radek"),OR($J4="",$J4="Nevztahuje se")),"Doplnit charakter (osobní / pracovní). ","")&IF(AND($W4="Schváleno",$AE4>0),"Schváleno, ale má otevřené připomínky. ","")&IF(AND($AA4="Publikováno",$AF4=0),"Publikováno bez záznamu v listu Publikace. ","")&IF(AND($C4<>"",$D4=""),"Chybí číslo dílu série. ","")&IF(AND($E4<>"",$W4<>"Schváleno",$W4<>"Odloženo",$W4<>"Zrušeno",IFERROR(VLOOKUP($E4,Nastavení!$A$30:$G$53,3,FALSE()),0)>0,IFERROR(VLOOKUP($E4,Nastavení!$A$30:$G$53,3,FALSE()),0)<TODAY()),"Neschváleno po termínu cyklu. ","")))
```

Business logic:
- **AE Otevřené připomínky**: number of Připomínky rows for this video ID whose `Stav připomínky` (col J) is exactly `Nevyřešeno`. (`Zapracováno` and `Uzavřeno` are *not* open.) Blank ID -> "".
- **AF Počet publikací**: number of rows in Publikace with this video ID (every publication row counts: profile x variant).
- **AG Datum první publikace**: earliest `Datum publikace` (Publikace!E) for this ID via MINIFS; "" when AF=0. (Caveat: a Publikace row with ID but no date contributes 0/ignored by MINIFS -> if all dates blank MINIFS returns 0 -> AG = 1900-01-00 -> AH `1900-01`.)
- **AH Skutečný měsíc publikace**: text `YYYY-MM` of AG (`TEXT(MONTH,"00")` zero-pads). This is the "actual month" used by all "Publikováno" metrics in Přehled.
- **AI Kontrola**: concatenation of up to 7 messages (each ending with ". ", whole thing TRIM-med; result "" if clean). Conditions, in order:
  1. `Po termínu odevzdání. ` - U not blank, U < TODAY() and W not in {Schváleno, Odloženo, Zrušeno}.
  2. `Schváleno bez jména / data. ` - W = Schváleno and (X blank or Y blank).
  3. `Chybí zařazení (kategorie, typ, profil nebo měsíc). ` - any of G, H, I, F blank.
  4. `Doplnit charakter (osobní / pracovní). ` - I is Honza or Radek and J blank or `Nevztahuje se`.
  5. `Schváleno, ale má otevřené připomínky. ` - W = Schváleno and AE > 0.
  6. `Publikováno bez záznamu v listu Publikace. ` - AA = Publikováno and AF = 0.
  7. `Chybí číslo dílu série. ` - C not blank and D blank.
  8. `Neschváleno po termínu cyklu. ` - E not blank, W not in {Schváleno, Odloženo, Zrušeno}, and cycle's `Termín schválení` (Nastavení col C via VLOOKUP, 0 if missing) is > 0 and < TODAY().
  (8 checks in total.) Přehled searches this text with wildcard `*Neschváleno po termínu cyklu*`.

### 3.3 Conditional formatting (Scénáře)

| Range | Condition | Fill / font |
|-------|-----------|-------------|
| U4:U503 | `AND($U4<>"",$U4<TODAY(),$W4<>"Schváleno",$W4<>"Odloženo",$W4<>"Zrušeno")` | red fill `F8CBAD`, bold dark-red font `9C0006` |
| W4:W503 | `$W4="Schváleno"` | green `C6EFCE` |
| W4:W503 | `OR($W4="K připomínkám",$W4="K finálnímu schválení")` | red/salmon `F8CBAD` (waiting for vedení) |
| W4:W503 | `OR($W4="K dopracování",$W4="Rozpracováno")` | yellow `FFEB9C` |
| W4:W503 | `OR($W4="Odloženo",$W4="Zrušeno")` | grey `D9D9D9` |
| AA4:AA503 | `$AA4="Publikováno"` | green `C6EFCE` |
| AA4:AA503 | `OR($AA4="Natočeno",$AA4="Ve střihu",$AA4="Sestříháno")` | blue `BDD7EE` |
| AA4:AA503 | `$AA4="Nenatočeno"` | grey `D9D9D9` |
| AE4:AE503 | `AND($AE4<>"",$AE4>0)` | red/salmon `F8CBAD` |
| AI4:AI503 | `$AI4<>""` | red/salmon `F8CBAD` |

### 3.4 Data rows (all non-empty rows; **every row is a "UKÁZKA" sample** - all `B` titles start with `UKÁZKA – `)

Columns: row | A ID | C/D série/díl | E cyklus | F měsíc | G kategorie | H typ | I profil | J charakter | K typ obsahu | T marketér | U termín | W stav schválení | X schválil | Y datum schv. | AA stav výroby | AB skutečné natáčení | cached AE / AF / AG / AH / AI.

| Row | A | B (title) | C/D | E | F | G | H | I | J | K | T | U | W | X | Y | AA | AB | AE | AF | AG | AH | AI (cached, TODAY=26.10.2026) |
|-----|---|-----------|-----|---|---|---|---|---|---|---|---|---|---|---|---|----|----|----|----|----|----|----|
| 4 | V001 | UKÁZKA – Proč jsme vzali asistentku bez praxe | - | 2026-10 | 2026-10 | Nábor, vedení lidí a práce s týmem | Odborně hodnotné | GTA Partners | Nevztahuje se | Nové téma | Marketér A | 2026-10-05 | Schváleno | Honza | 2026-10-07 | Publikováno | 2026-10-10 | 0 | 2 | 2026-10-10 | 2026-10 | "" |
| 5 | V002 | UKÁZKA – Ranní rutina před schůzkou s klientem | - | 2026-10 | 2026-10 | Osobní brand & Lifestyle | Instagramové | Honza | Osobní | Nové téma | Marketér B | 2026-10-05 | Schváleno | Radek | 2026-10-07 | Publikováno | 2026-10-10 | 0 | 1 | 2026-10-10 | 2026-10 | "" |
| 6 | V003 | UKÁZKA – Co udělá ČNB se sazbami a co to znamená pro hypotéky | - | 2026-11 | 2026-11 | Trendy a reakce na trh | Odborně hodnotné | Radek | Pracovní | Nové téma | Marketér A | 2026-11-03 | K připomínkám | - | - | Čeká na natáčení | - | 1 | 0 | "" | "" | "" |
| 7 | V004 | UKÁZKA – Investiční chyby: díl 1 – Čekání na správný okamžik | S01 / 1 | 2026-11 | 2026-11 | Produktové a poradenské tipy | Odborně hodnotné | Radek | Pracovní | Nové téma | Marketér A | 2026-11-03 | Schváleno | Radek | 2026-11-05 | Čeká na natáčení | - | 0 | 0 | "" | "" | "" |
| 8 | V005 | UKÁZKA – Investiční chyby: díl 2 – Všechno do jedné akcie | S01 / 2 | 2026-11 | 2026-11 | Produktové a poradenské tipy | Instagramové | Radek | Pracovní | Nové téma | Marketér A | 2026-11-03 | K dopracování | - | - | Čeká na natáčení | - | 0 | 0 | "" | "" | "" |
| 9 | V006 | UKÁZKA – Investiční chyby: díl 3 – Panický prodej | S01 / 3 | **2026-12** | **2026-12** | Produktové a poradenské tipy | Odborně hodnotné | Radek | Pracovní | Nové téma | Marketér A | 2026-11-25 | Rozpracováno | - | - | *(blank)* | - | 0 | 0 | "" | "" | "" |
| 10 | V007 | UKÁZKA – Víkend s rodinou na horách | - | 2026-11 | 2026-11 | Osobní brand & Lifestyle | Instagramové | Radek | Osobní | Nové téma | Marketér B | **2026-10-20** | K dopracování | - | - | Čeká na natáčení | - | 1 | 0 | "" | "" | "Po termínu odevzdání." |
| 11 | V008 | UKÁZKA – Jak u nás vypadá první měsíc nováčka | - | 2026-11 | 2026-11 | Nábor, vedení lidí a práce s týmem | Instagramové | GTA Partners | Nevztahuje se | Nové téma | Marketér B | 2026-11-03 | K finálnímu schválení | - | - | Čeká na natáčení | - | 0 | 0 | "" | "" | "" |
| 12 | V009 | UKÁZKA – Běžecká výzva: týden 1 | - | 2026-11 | 2026-11 | Osobní brand & Lifestyle | Instagramové | Honza | Osobní | Nové téma | Marketér B | 2026-11-03 | Schváleno | Honza | 2026-11-04 | Čeká na natáčení | - | 0 | 0 | "" | "" | "" |
| 13 | V010 | UKÁZKA – Nový střih: Proč jsme vzali asistentku bez praxe | - | 2026-11 | 2026-11 | Nábor, vedení lidí a práce s týmem | Instagramové | Honza | Pracovní | Nový střih existujícího videa | Marketér A | 2026-11-03 | Schváleno | Honza | 2026-11-05 | Ve střihu | - | 0 | 0 | "" | "" | "" |

Details (verified against the raw dump):
- Row 9 (V006) has **no `AA` value** (production status blank) and W = `Rozpracováno`; all other rows have the AA values shown (rows 4,5 `Publikováno`; 6,7,8,10,11,12 `Čeká na natáčení`; 13 `Ve střihu`). The blank-AA case is why Přehled counts "Schváleno a čeká na natáčení" with an extra `AA=""` clause.
- Row 6 (V003): Hook B present (`Q`); Q also on row 4 (V001). Hook A (P) present on all 10 rows; R (Hook C) empty on all.
- Row 13 (V010): `L` Původní ID videa = `V001`; `O` = "Použít materiál z V001"; `S` = "Bez natáčení – jen střih". Chain of nové zpracování.
- Row 4 O = `https://docs.google.com/… (odkaz na scénář)`; AD = `https://… finální video`. AC empty everywhere.
- Free text columns M/N/O/P/Q/S exist for all 10 rows (e.g. M4 "Ukázat firemní kulturu a mentoring.", N4 "U nás roste každý, kdo chce."); Z (Poznámka vedení): row 8 "Zkrátit, doplnit konkrétní čísla.", row 10 "Chybí pointa, dopracovat závěr.".
- Row 7-9 (série S01): C=`S01`, D=1, 2, 3.
- Series column D is numeric; ID column A is plain `V###`.
- No row has `V`, `AC`, or `R` filled; only L on V010.

---

## 4. Sheet `Připomínky`

- Row 1 title "PŘIPOMÍNKY A SCHVALOVÁNÍ – každá zpětná vazba Honzy / Radka = jeden řádek (zůstává dohledatelná i po zapracování)". Row 2 bands: `A2:F2` "VYPLŇUJE VEDENÍ" (orange), `G2:J2` "VYPLŇUJE MARKETÉR (stav uzavírá vedení)" (blue). **Row 3 = headers, data from row 4** (verified), rows 4-503 (500).
- 10 columns.

| Col | Header | Kind | Validation |
|-----|--------|------|-----------|
| A | ID videa | input (vedení) | list `Scénáře!$A$4:$A$503` |
| B | Pracovní název (automaticky) | **formula (grey)** | - |
| C | Datum vložení | input (date) | date > 36526 |
| D | Autor připomínky | input | list `Nastavení!$J$4:$J$8` (Honza, Radek + blanks) |
| E | Typ | input | list `Nastavení!$R$4:$R$8` (`Připomínka`, `Odborné doplnění`, `Požadavek na úpravu`, `Nápad`, `Souhlas / schválení`) |
| F | Text připomínky / odborné doplnění / návrh změny | input | none |
| G | Reakce marketéra | input | none |
| H | Reagoval | input | list `Nastavení!$I$4:$I$18` (marketers) |
| I | Datum reakce | input (date) | date > 36526 |
| J | Stav připomínky | input | list `Nastavení!$Q$4:$Q$6` (`Nevyřešeno`, `Zapracováno`, `Uzavřeno`) |

Date validation on `C4:C503 I4:I503` (same as Scénáře).

Formula (only distinct one, B4 verbatim, same in rows 4-503):
```
B4: =IF(A4="","",IFERROR(VLOOKUP(A4,Scénáře!$A$4:$B$503,2,FALSE()),"ID nenalezeno"))
```
Logic: looks up the video's `Pracovní název`; returns `ID nenalezeno` if the ID does not exist.

Conditional formatting: `A4:A503` `AND($A4<>"",$J4="")` -> yellow (comment without status); `J4:J503`: `Nevyřešeno` red `F8CBAD`, `Zapracováno` yellow `FFEB9C`, `Uzavřeno` green `C6EFCE`.

Data rows (all 4 are "UKÁZKA" via the linked video title; the comment texts themselves carry no UKÁZKA label):

| Row | A | B (cached) | C Datum | D Autor | E Typ | F Text | G Reakce | H Reagoval | I Datum reakce | J Stav |
|-----|---|-----------|--------|---------|-------|--------|---------|-----------|---------------|--------|
| 4 | V003 | UKÁZKA – Co udělá ČNB se sazbami a co to znamená pro hypotéky | 2026-11-04 | Radek | Odborné doplnění | Doplnit aktuální výši repo sazby a konkrétní dopad na splátku u hypotéky 5 mil. | - | - | - | Nevyřešeno |
| 5 | V005 | UKÁZKA – Investiční chyby: díl 2 – Všechno do jedné akcie | 2026-11-04 | Radek | Požadavek na úpravu | Zkrátit na 40 s, přidat příklad s reálnými čísly (např. propad jedné akcie o 60 %). | Zkráceno, příklad doplněn – verze 2 v dokumentu. | Marketér A | 2026-11-06 | Zapracováno |
| 6 | V007 | UKÁZKA – Víkend s rodinou na horách | 2026-10-22 | Honza | Připomínka | Chybí pointa – proč to divákovi říkáme? Navázat na téma rovnováhy práce a rodiny. | - | - | - | Nevyřešeno |
| 7 | V001 | UKÁZKA – Proč jsme vzali asistentku bez praxe | 2026-10-06 | Honza | Souhlas / schválení | Bez připomínek, schvaluji. | - | - | - | Uzavřeno |

Note: row 5 comment dated 2026-11-04 is in the future relative to the file's save date (2026-10-26) - sample data only.

---

## 5. Sheet `Publikace`

- Row 1 title "PUBLIKACE – jeden řádek = jedno zveřejnění (profil × varianta). Více řádků k jednomu ID videa NEZVYŠUJE počet unikátních videí." Row 2 empty (no bands). **Row 3 headers, data from row 4** (verified), rows 4-503.
- 8 columns.

| Col | Header | Kind | Validation |
|-----|--------|------|-----------|
| A | ID videa | input | list `Scénáře!$A$4:$A$503` |
| B | Pracovní název (automaticky) | **formula (grey)** | - |
| C | ID série (automaticky) | **formula (grey)** | - |
| D | Profil | input | list `Nastavení!$K$4:$K$11` (`GTA Partners`, `Honza`, `Radek` + blanks) |
| E | Datum publikace | input (date) | date > 36526 |
| F | Varianta (hook / střih) | input | list `Nastavení!$T$4:$T$9` (`Hlavní verze`, `Hook A`, `Hook B`, `Hook C`, `Alternativní střih`, `Opakovaná publikace`) |
| G | Odkaz na publikovaný příspěvek | input | none |
| H | Výsledky / poznámka (A/B test) | input | none |

Formulas (row 4 verbatim):
```
B4: =IF(A4="","",IFERROR(VLOOKUP(A4,Scénáře!$A$4:$B$503,2,FALSE()),"ID nenalezeno"))
C4: =IF(A4="","",IFERROR(VLOOKUP(A4,Scénáře!$A$4:$C$503,3,FALSE())&"",""))
```
Logic: B pulls the video name; C pulls the video's `ID série` (coerced to text with `&""` so a blank series becomes `""`; unknown ID also `""`).

Conditional formatting: `E4:E503` `AND($A4<>"",$E4="")` yellow (missing date); `G4:G503` `AND($A4<>"",$G4="")` yellow (missing link).

Data rows (all "UKÁZKA" via linked titles; G values say "(ukázka)"):

| Row | A | B (cached) | C | D Profil | E Datum | F Varianta | G Odkaz | H Poznámka |
|-----|---|-----------|---|----------|---------|-----------|--------|------------|
| 4 | V001 | UKÁZKA – Proč jsme vzali asistentku bez praxe | "" | GTA Partners | 2026-10-10 | Hlavní verze | https://instagram.com/… (ukázka) | - |
| 5 | V001 | (same) | "" | Honza | 2026-10-12 | Hook B | https://instagram.com/… (ukázka) | Hook B měl o 30 % vyšší dokoukanost. |
| 6 | V002 | UKÁZKA – Ranní rutina před schůzkou s klientem | "" | Honza | 2026-10-10 | Hlavní verze | https://instagram.com/… (ukázka) | - |

Consequence: V001 has AF=2, AG=2026-10-10 (MINIFS), V002 has AF=1.

---

## 6. Sheet `Série`

- Row 1 title "OBSAHOVÉ SÉRIE – jeden řádek = jedna série; díly se evidují v listu Scénáře (sloupec ID série + Číslo dílu)". Row 2 merged bands: `A2:L2` "VYPLŇUJE MARKETÉR", `M2:O2` "VYPLŇUJE VEDENÍ (Honza / Radek)", `P2:AA2` "AUTOMATICKY – NEPŘEPISOVAT". **Row 3 headers, data from row 4**, rows 4-103 (**100 series max**).
- 27 columns (A:AA).

### 6.1 Columns

| Col | Header | Kind | Validation |
|-----|--------|------|-----------|
| A | ID série | input | none (free text `S01`) |
| B | Název série | input | none |
| C | Hlavní tematická kategorie | input | list `Nastavení!$A$10:$A$13` |
| D | Cíl série (co chceme komunikovat) | input | none |
| E | Garant série | input | list `Nastavení!$J$4:$J$8` |
| F | Odpovědný marketér | input | list `Nastavení!$I$4:$I$18` |
| G | Plánovaný počet dílů (aktuální) | input (number) | none |
| H | Původně plánovaný počet dílů | input (number) | none |
| I | Důvod změny rozsahu | input | none |
| J | Datum zahájení | input (date) | date > 36526 |
| K | Předpokládané dokončení | input (date) | date > 36526 |
| L | Poznámky | input | none |
| M | Stav série | input (vedení) | list `Nastavení!$P$4:$P$11` (Návrh, Rozpracovaná, Ve výrobě, V publikaci, Dokončená, Uzavřená, Pozastavená, Zrušená) |
| N | Uzavření potvrdil | input (vedení) | list `Nastavení!$J$4:$J$8` |
| O | Datum uzavření | input (vedení, date) | date > 36526 |
| P | Díly se scénářem | formula | - |
| Q | Schválené díly | formula | - |
| R | Natočené díly | formula | - |
| S | Publikované díly | formula | - |
| T | Plnění publikace | formula (0.0 %) | - |
| U | Zbývá dílů | formula | - |
| V | Otevřené připomínky | formula | - |
| W | Publikace bez odkazu | formula | - |
| X | Lze uzavřít? | formula | - |
| Y | Kontrola | formula | - |
| Z | Aktivní | formula | - |
| AA | Pořadí v Přehledu | formula | - |

Date validation: `J4:K103 O4:O103`. Dropdown `E4:E103 N4:N103` share one rule.

### 6.2 Formulas (row 4 verbatim; one pattern per column across rows 4-103)

```
P4:  =IF($A4="","",COUNTIFS(Scénáře!$C$4:$C$503,$A4,Scénáře!$W$4:$W$503,"<>Zrušeno"))
Q4:  =IF($A4="","",COUNTIFS(Scénáře!$C$4:$C$503,$A4,Scénáře!$W$4:$W$503,"Schváleno"))
R4:  =IF($A4="","",SUMPRODUCT((Scénáře!$C$4:$C$503=$A4)*((Scénáře!$AA$4:$AA$503="Natočeno")+(Scénáře!$AA$4:$AA$503="Ve střihu")+(Scénáře!$AA$4:$AA$503="Sestříháno")+(Scénáře!$AA$4:$AA$503="Publikováno"))))
S4:  =IF($A4="","",COUNTIFS(Scénáře!$C$4:$C$503,$A4,Scénáře!$AF$4:$AF$503,">0"))
T4:  =IF($A4="","",IF(N(G4)>0,S4/G4,""))
U4:  =IF($A4="","",MAX(0,N(G4)-S4))
V4:  =IF($A4="","",SUMIFS(Scénáře!$AE$4:$AE$503,Scénáře!$C$4:$C$503,$A4))
W4:  =IF($A4="","",COUNTIFS(Publikace!$C$4:$C$503,$A4,Publikace!$G$4:$G$503,""))
X4:  =IF($A4="","",IF(N(G4)=0,"Doplňte plánovaný počet dílů",TRIM(IF(S4<G4,"Publikováno "&S4&" z "&G4&". ","")&IF(V4>0,"Otevřené připomínky: "&V4&". ","")&IF(W4>0,"Chybí odkazy: "&W4&". ",""))&IF(AND(S4>=G4,V4=0,W4=0),"ANO – podmínky splněny","")))
Y4:  =IF($A4="","",TRIM(IF(AND(M4="Uzavřená",OR(N4="",O4="")),"Uzavřeno bez potvrzení (kdo / kdy). ","")&IF(AND(M4="Uzavřená",LEFT(X4,3)<>"ANO"),"Uzavřeno, ale podmínky nejsou splněny. ","")&IF(AND(H4<>"",G4<>H4,I4=""),"Změněn rozsah bez uvedení důvodu. ","")&IF(P4>N(G4),"Více dílů než plán. ","")))
Z4:  =IF($A4="","",IF(OR(M4="Uzavřená",M4="Zrušená"),"NE","ANO"))
AA4: =IF(Z4="ANO",COUNTIF($Z$4:Z4,"ANO"),"")
```

Business logic:
- P: episodes (Scénáře rows with this series ID) excluding `Zrušeno` (Odloženo still counts).
- Q: episodes with `Stav schválení = Schváleno`.
- R: episodes whose `Stav výroby` is Natočeno / Ve střihu / Sestříháno / Publikováno (not excluding cancelled).
- S: episodes having at least one publication (`Počet publikací` > 0); one video counts once however many publications it has.
- T: S / planned episodes (G); "" if G is blank/0. Number format 0.0 %.
- U: remaining = max(0, G - S).
- V: sum of open comments (AE) across the series' episodes.
- W: Publikace rows of this series whose `Odkaz` (G) is empty. (Relies on Publikace!C = series ID.)
- X "Lze uzavřít?": if G=0 -> "Doplňte plánovaný počet dílů"; else trimmed concatenation of reasons ("Publikováno S z G. ", "Otevřené připomínky: n. ", "Chybí odkazy: n. "); if S>=G, V=0 and W=0 it ends with "ANO – podmínky splněny" (all three conditions must hold).
- Y "Kontrola": flags (a) Stav = Uzavřená without confirmer or date, (b) Uzavřená while X doesn't begin with "ANO", (c) G <> H and no reason (I blank) while H is set, (d) more episodes (P) than planned (G).
- Z "Aktivní": "NE" if Stav is `Uzavřená` or `Zrušená`, else "ANO" (so `Dokončená`, `Pozastavená` stay active).
- AA: running rank 1,2,3... among active series (`COUNTIF($Z$4:Z4,"ANO")`), "" for inactive; used by Přehled to list series.

Conditional formatting: `M4:M103` - `Uzavřená`/`Dokončená` green `C6EFCE`; `Ve výrobě`/`V publikaci`/`Rozpracovaná` blue `BDD7EE`; `Návrh` yellow `FFEB9C`; `Pozastavená`/`Zrušená` grey `D9D9D9`. `T4:T103` `AND($T4<>"",$T4>=1)` green. `X4:X103` `LEFT($X4,3)="ANO"` green. `Y4:Y103` `$Y4<>""` red `F8CBAD`.

### 6.3 Data rows (both "UKÁZKA")

| Row | A | B | C | D | E Garant | F Marketér | G | H | J | K | L | M | P | Q | R | S | T | U | V | W | X | Y | Z | AA |
|-----|---|---|---|---|----------|-----------|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|----|
| 4 | S01 | UKÁZKA – Investiční chyby začátečníků | Produktové a poradenské tipy | Ukázat, že investování má pravidla, a přivést diváky k poradenství. | Radek | Marketér A | 8 | 8 | 2026-11-01 | 2027-01-31 | - | Rozpracovaná | 3 | 1 | 0 | 0 | 0 | 8 | 0 | 0 | Publikováno 0 z 8. | "" | ANO | 1 |
| 5 | S02 | UKÁZKA – Zákulisí finančního poradce | Osobní brand & Lifestyle | Lidská stránka práce poradce – každodenní realita, humor, tým. | Honza | Marketér B | 5 | 5 | 2026-12-01 | 2027-02-28 | Koncept zatím k odsouhlasení. | Návrh | 0 | 0 | 0 | 0 | 0 | 5 | 0 | 0 | Publikováno 0 z 5. | "" | ANO | 2 |

(I = Důvod změny rozsahu, N, O are empty on both rows.) S01's episodes in Scénáře: V004, V005 (cycle 2026-11) and V006 (2026-12) = P 3; only V004 approved = Q 1; R=0 (all `Čeká na natáčení`/blank).

---

## 7. Sheet `Přehled` (dashboard)

Frozen at `A7` (rows 1-6 fixed). Sheet is protected (no password); only `C3` and `C4` unlocked. Columns A:L used. Merged cells: `D30:H30` ... `D42:H42` (13 merges, the "Poznámka" column in section 4).

### 7.1 Header block (rows 1-6) and the two input cells

| Cell | Content | Kind |
|------|---------|------|
| A1 | `GTA PARTNERS – PŘEHLED PLÁNOVÁNÍ A KONTROLY VIDEOOBSAHU` | title |
| A2 | "Měňte pouze dvě žluté buňky (měsíc a natáčecí cyklus). Vše ostatní se počítá automaticky z listů Scénáře, Publikace, Série a Nastavení." | hint |
| A3 / **C3** | "Vyhodnocovaný měsíc publikace" / **`2026-11`** (text, yellow, unlocked) | **INPUT 1**. DV list `Nastavení!$U$4:$U$42` |
| A4 / **C4** | "Natáčecí cyklus" / **`2026-11`** (text, yellow, unlocked) | **INPUT 2**. DV list `Nastavení!$A$30:$A$53` |
| A5 / C5 | "Dnes" / `=TODAY()` (cached 2026-10-26) | formula |
| E3 / G3 | "Cíl videí za měsíc" / `=Nastavení!$B$3` -> 16 | |
| E4 / G4 | "Datum natáčení" / `=IFERROR(IF(VLOOKUP($C$4,Nastavení!$A$30:$G$53,2,FALSE())=0,"",VLOOKUP($C$4,Nastavení!$A$30:$G$53,2,FALSE())),"")` -> 2026-11-20 | |
| E5 / G5 | "Termín schválení scénářů" / `=IFERROR(IF(VLOOKUP($C$4,Nastavení!$A$30:$G$53,3,FALSE())=0,"",VLOOKUP($C$4,Nastavení!$A$30:$G$53,3,FALSE())),"")` -> 2026-11-13 | |
| E6 / G6 | "Plán videí pro cyklus" / `=IFERROR(IF(VLOOKUP($C$4,Nastavení!$A$30:$G$53,4,FALSE())=0,Nastavení!$B$3,VLOOKUP($C$4,Nastavení!$A$30:$G$53,4,FALSE())),Nastavení!$B$3)` -> 16 | falls back to monthly target if cycle row missing or D=0 |
| I4 / K4 | "Dní do natáčení" / `=IF($G$4="","– (doplňte datum v Nastavení)",$G$4-TODAY())` -> 25 | |
| I5 / K5 | "Dní do termínu schválení" / `=IF($G$5="","–",$G$5-TODAY())` -> 18 | CF: red `F8CBAD` if <0, yellow `FFEB9C` if 0..3 |
| I6 / K6 | "Cíl klipů z natáčecího dne" / `=IFERROR(VLOOKUP($C$4,Nastavení!$A$30:$G$53,6,FALSE()),"30–40")` -> `30–40` | |

Two selectors: `C3` (month key, drives sections 1, 2, 3 and the bold-row highlight in 7) and `C4` (cycle key, drives header block, sections 4 and 5). They are independent.

### 7.2 Section map (cell ranges)

| Section | Title cell | Header row | Data rows | Total row | Columns |
|---------|-----------|-----------|----------|-----------|---------|
| 1 Tematický mix - měsíc | A8 (formula, includes $C$3) | 9 | 10-13 | 14 | A:J |
| 2 Odborně hodnotná vs. Instagramová | A16 (formula) | 17 | 18-19 | 20 | A:J |
| 3 Charakter osobních profilů | A22 (formula, includes tolerance) | 23 | 24-27 (Honza Osobní/Pracovní, Radek Osobní/Pracovní) | - | A:I |
| 4 Stav scénářů a schvalování - cyklus | A29 (formula) | 30 | 31-42 | - | A:D (D:H merged = Poznámka) |
| 5 Tematický mix pro natáčecí cyklus | A44 (formula) | 45 | 46-49 | 50 | A:H |
| 6 Obsahové série | A52 (static text) | 53 | 54-65 (12 slots) | note row 66 | A:L |
| 7 Historie po měsících | A68 (static text) | 69 | 70-93 (24 months) | - | A:L |

Title formulas:
- A8: `="1. TEMATICKÝ MIX – plánovaný měsíc publikace "&$C$3&"  (Plán = kolik videí má vyjít; Publikováno = skutečně zveřejněno v tomto měsíci)"`
- A16: `="2. ODBORNĚ HODNOTNÁ vs. INSTAGRAMOVÁ VIDEA – měsíc "&$C$3`
- A22: `="3. CHARAKTER OSOBNÍCH PROFILŮ (osobní 70 % / pracovní 30 %) – měsíc "&$C$3&"  (tolerance ±"&Nastavení!$B$5&" p. b.)"` (the "70 % / 30 %" in the title is **hard-coded text**, not driven by Nastavení)
- A29: `="4. STAV SCÉNÁŘŮ A SCHVALOVÁNÍ – natáčecí cyklus "&$C$4&"  (kdo má udělat další krok)"`
- A44: `="5. TEMATICKÝ MIX PRO NATÁČECÍ CYKLUS "&$C$4&"  (plán "&$G$6&" videí – fáze plánování a schvalování)"`
- A52: static "6. OBSAHOVÉ SÉRIE – všechny kromě uzavřených a zrušených (pozastavené zůstávají vidět)"; A66: "Zobrazuje se prvních 12 aktivních sérií. Detail dílů: list Scénáře → filtr sloupce ID série."
- A68: static "7. HISTORIE PO MĚSÍCÍCH – dlouhodobý přehled (Publikováno = podle skutečného data zveřejnění)"

"Natočeno" everywhere = production status in {`Natočeno`, `Ve střihu`, `Sestříháno`, `Publikováno`}. "Navrženo" = not `Zrušeno` and not `Odloženo` (blank W counts).

### 7.3 Section 1 - Tematický mix by month (A9:J14)

Headers (row 9): `Kategorie | Cíl % | Plán (ks) | Navrženo (scénáře) | Schváleno | Chybí ke schválení | Natočeno | Publikováno | Plnění publikace | Stav`.

Row 10 formulas (verbatim; rows 11-13 change `A10` -> `A11` etc. and `Nastavení!$A$10/$B$10/$E$10` -> rows 11-13):
```
A10: =Nastavení!$A$10                   (category name; rows 11-13 -> $A$11..$A$13)
B10: =Nastavení!$B$10                   (target share)
C10: =Nastavení!$E$10                   (planned count, rounded with remainder absorption; NOT month-specific)
D10: =COUNTIFS(Scénáře!$F$4:$F$503,$C$3,Scénáře!$G$4:$G$503,$A10,Scénáře!$W$4:$W$503,"<>Zrušeno",Scénáře!$W$4:$W$503,"<>Odloženo")
E10: =COUNTIFS(Scénáře!$F$4:$F$503,$C$3,Scénáře!$G$4:$G$503,$A10,Scénáře!$W$4:$W$503,"Schváleno")
F10: =MAX(0,C10-E10)
G10: =SUMPRODUCT((Scénáře!$F$4:$F$503=$C$3)*(Scénáře!$G$4:$G$503=$A10)*((Scénáře!$AA$4:$AA$503="Natočeno")+(Scénáře!$AA$4:$AA$503="Ve střihu")+(Scénáře!$AA$4:$AA$503="Sestříháno")+(Scénáře!$AA$4:$AA$503="Publikováno")))
H10: =COUNTIFS(Scénáře!$AH$4:$AH$503,$C$3,Scénáře!$G$4:$G$503,$A10)
I10: =IF(C10=0,"",H10/C10)
J10: =IF(C10=0,"–",IF(H10>=C10,"Publikováno ✔",IF(E10>=C10,"Schváleno ✔",IF(D10>=C10,"Čeká na schválení","CHYBÍ SCÉNÁŘE"))))
```
Row 14 (Celkem): `B14 =SUM(B10:B13)`, `C14..H14 =SUM(C10:C13)...`, `I14 =IF(C14=0,"",H14/C14)`, `J14` same status formula on row 14.

Logic: month filter = *planned* month `Scénáře!F` for D/E/G; but "Publikováno" H uses the *actual* publication month `Scénáře!AH` (first publication). Status: published >= plan -> "Publikováno ✔"; else approved >= plan -> "Schváleno ✔"; else proposed >= plan -> "Čeká na schválení"; else "CHYBÍ SCÉNÁŘE". Note: the plan is always `Nastavení!E10:E13` (monthly target split), regardless of the selected month.

CF: F10:F14 red if >0; I10:I14 green if >=1, yellow if 0.5-<1, red if <0.5 (note: red also when 0); J10:J14 text-prefix colours (`CHYBÍ`/`MIMO` red, `Čeká` yellow, `Schv`/`Publ`/`OK` green).

### 7.4 Section 2 - Odborně hodnotné vs. Instagramové (A17:J20)

Same columns as section 1; key = `Scénáře!H` (Typ zpracování) instead of G. Row 18 formulas: `A18 =Nastavení!$A$18`, `B18 =Nastavení!$B$18`, `C18 =Nastavení!$E$18`, `D18 =COUNTIFS(Scénáře!$F$4:$F$503,$C$3,Scénáře!$H$4:$H$503,$A18,Scénáře!$W$4:$W$503,"<>Zrušeno",Scénáře!$W$4:$W$503,"<>Odloženo")`, `E18 =COUNTIFS(...F=$C$3, H=$A18, W="Schváleno")`, `F18 =MAX(0,C18-E18)`, `G18` SUMPRODUCT with `$H` in place of `$G`, `H18 =COUNTIFS(Scénáře!$AH$4:$AH$503,$C$3,Scénáře!$H$4:$H$503,$A18)`, `I18 =IF(C18=0,"",H18/C18)`, `J18` same status formula. Row 19 = Instagramové (Nastavení row 19). Row 20 Celkem sums. Same CF as section 1.

### 7.5 Section 3 - Charakter osobních profilů (A23:I27)

Headers (row 23): `Profil | Charakter | Cíl % | Scénáře (ks) | Scénáře % | Stav přípravy | Publikováno (ks) | Publikováno % | Stav publikace`.
Rows: 24 `Honza`/`Osobní`, 25 `Honza`/`Pracovní`, 26 `Radek`/`Osobní`, 27 `Radek`/`Pracovní` (A and B are **constants**). GTA Partners is not evaluated.

```
C24: =Nastavení!$B$24      (C25: =Nastavení!$B$25; C26: =Nastavení!$B$24; C27: =Nastavení!$B$25)
D24: =COUNTIFS(Scénáře!$F$4:$F$503,$C$3,Scénáře!$I$4:$I$503,$A24,Scénáře!$J$4:$J$503,$B24,Scénáře!$W$4:$W$503,"<>Zrušeno",Scénáře!$W$4:$W$503,"<>Odloženo")
E24: =IF(D24+D25=0,"",D24/(D24+D25))      (E25: =IF(D24+D25=0,"",D25/(D24+D25)); rows 26/27 use D26+D27)
F24: =IF(E24="","– (žádné scénáře)",IF(ABS(E24-C24)<=Nastavení!$B$5/100,"OK","MIMO POMĚR"))
G24: =COUNTIFS(Scénáře!$AH$4:$AH$503,$C$3,Scénáře!$I$4:$I$503,$A24,Scénáře!$J$4:$J$503,$B24)
H24: =IF(G24+G25=0,"",G24/(G24+G25))      (H25: ...G25/(G24+G25); rows 26/27 use G26+G27)
I24: =IF(H24="","– (nic nepublikováno)",IF(ABS(H24-C24)<=Nastavení!$B$5/100,"OK","MIMO POMĚR"))
```
Logic: for each personal profile, the share of Osobní vs Pracovní among its scénáře (planned month = C3, excluding Zrušeno/Odloženo) and among its publications (actual month AH = C3); the share is within tolerance (`Nastavení!B5` percentage points, i.e. `|actual% - target%| <= 10/100`) -> "OK", else "MIMO POMĚR". With 2 categories both rows of a profile deviate equally. CF: `OK` green, `MIMO` red bold, `Čeká`/`CHYBÍ` etc.

### 7.6 Section 4 - Stav scénářů a schvalování - cyklus (A30:D42)

Headers (row 30): `Ukazatel | Vybraný cyklus | Všechny cykly | Poznámka` (D:H merged per row).
"Vybraný cyklus" filters by `Scénáře!E = $C$4`; "Všechny cykly" ignores the cycle.

| Row | A Ukazatel | B (selected cycle) | C (all cycles) | D Poznámka |
|-----|-----------|--------------------|----------------|-----------|
| 31 | Plán videí pro cyklus | `=$G$6` | (empty) | Z listu Nastavení (tabulka cyklů). |
| 32 | Scénářů celkem (bez odložených a zrušených) | `=COUNTIFS(Scénáře!$E$4:$E$503,$C$4,Scénáře!$W$4:$W$503,"<>Zrušeno",Scénáře!$W$4:$W$503,"<>Odloženo")` | `=COUNTIFS(Scénáře!$A$4:$A$503,"<>",Scénáře!$W$4:$W$503,"<>Zrušeno",Scénáře!$W$4:$W$503,"<>Odloženo")` | Vše, co marketéři vložili. |
| 33 | Čeká na zpětnou vazbu vedení (K připomínkám + K finálnímu schválení) | `=COUNTIFS(Scénáře!$E$4:$E$503,$C$4,Scénáře!$W$4:$W$503,"K připomínkám")+COUNTIFS(Scénáře!$E$4:$E$503,$C$4,Scénáře!$W$4:$W$503,"K finálnímu schválení")` | `=COUNTIFS(Scénáře!$W$4:$W$503,"K připomínkám")+COUNTIFS(Scénáře!$W$4:$W$503,"K finálnímu schválení")` | Další krok: Honza / Radek. |
| 34 | Čeká na marketéry (Rozpracováno + K dopracování) | same with `"Rozpracováno"` + `"K dopracování"` | same without cycle filter | Další krok: marketing. |
| 35 | Schváleno | `=COUNTIFS(Scénáře!$E$4:$E$503,$C$4,Scénáře!$W$4:$W$503,"Schváleno")` | `=COUNTIFS(Scénáře!$W$4:$W$503,"Schváleno")` | - |
| 36 | Chybí schválených do plánu cyklu | `=MAX(0,B31-B35)` | (empty) | Plán − schváleno. |
| 37 | Schváleno a čeká na natáčení | `=COUNTIFS(E=$C$4,W="Schváleno",AA="Čeká na natáčení")+COUNTIFS(E=$C$4,W="Schváleno",AA="")` | same w/o cycle filter | Před natáčením vyfiltrujte v listu Scénáře: Stav schválení = Schváleno. |
| 38 | Po termínu odevzdání scénáře (neschválené) | `=SUMPRODUCT((Scénáře!$E$4:$E$503=$C$4)*(Scénáře!$U$4:$U$503<>"")*(Scénáře!$U$4:$U$503<TODAY())*(Scénáře!$W$4:$W$503<>"Schváleno")*(Scénáře!$W$4:$W$503<>"Odloženo")*(Scénáře!$W$4:$W$503<>"Zrušeno"))` | same without the E term | Termín odevzdání scénáře už prošel. |
| 39 | Neschváleno po termínu schválení cyklu | `=COUNTIFS(Scénáře!$E$4:$E$503,$C$4,Scénáře!$AI$4:$AI$503,"*Neschváleno po termínu cyklu*")` | `=COUNTIF(Scénáře!$AI$4:$AI$503,"*Neschváleno po termínu cyklu*")` | Termín schválení (datum natáčení − 7 dní) prošel a scénář není schválen. |
| 40 | Otevřené připomínky (Nevyřešeno) | `=SUMIFS(Scénáře!$AE$4:$AE$503,Scénáře!$E$4:$E$503,$C$4)` | `=SUM(Scénáře!$AE$4:$AE$503)` | Z listu Připomínky. |
| 41 | Natočeno (vč. ve střihu a publikovaných) | `=SUMPRODUCT((Scénáře!$E$4:$E$503=$C$4)*((AA="Natočeno")+(AA="Ve střihu")+(AA="Sestříháno")+(AA="Publikováno")))` | same w/o cycle term | - |
| 42 | Odloženo / Zrušeno | `=COUNTIFS(E=$C$4,W="Odloženo")+COUNTIFS(E=$C$4,W="Zrušeno")` | `=COUNTIFS(W="Odloženo")+COUNTIFS(W="Zrušeno")` | - |

(`Scénáře!$AA$4:$AA$503` etc. abbreviated in rows 37/41 for readability; ranges are exactly `$4:$503`.)
CF: `B33:C34` yellow if >0; `B36:C36` red bold if >0; `B38:C40` red bold if >0.

### 7.7 Section 5 - Tematický mix pro natáčecí cyklus (A45:H50)

Headers (row 45): `Kategorie | Cíl % | Plán (ks) | Navrženo (scénáře) | Schváleno | Chybí ke schválení | Natočeno | Stav`.
Rows 46-49 = four categories, row 50 = Celkem.

```
A46: =Nastavení!$A$10          (A47..A49 -> $A$11..$A$13)
B46: =Nastavení!$B$10
C46: =IF(ROW()-46+1=MATCH(MAX($B$46:$B$49),$B$46:$B$49,0),$G$6-(ROUND($G$6*$B46,0)+ROUND($G$6*$B47,0)+ROUND($G$6*$B48,0)+ROUND($G$6*$B49,0))+ROUND($G$6*$B46,0),ROUND($G$6*$B46,0))
D46: =COUNTIFS(Scénáře!$E$4:$E$503,$C$4,Scénáře!$G$4:$G$503,$A46,Scénáře!$W$4:$W$503,"<>Zrušeno",Scénáře!$W$4:$W$503,"<>Odloženo")
E46: =COUNTIFS(Scénáře!$E$4:$E$503,$C$4,Scénáře!$G$4:$G$503,$A46,Scénáře!$W$4:$W$503,"Schváleno")
F46: =MAX(0,C46-E46)
G46: =SUMPRODUCT((Scénáře!$E$4:$E$503=$C$4)*(Scénáře!$G$4:$G$503=$A46)*((Scénáře!$AA$4:$AA$503="Natočeno")+(Scénáře!$AA$4:$AA$503="Ve střihu")+(Scénáře!$AA$4:$AA$503="Sestříháno")+(Scénáře!$AA$4:$AA$503="Publikováno")))
H46: =IF(C46=0,"–",IF(E46>=C46,"Schváleno ✔",IF(D46>=C46,"Čeká na schválení","CHYBÍ SCÉNÁŘE")))
```
Logic: same as section 1 but filtered by the shooting cycle (`Scénáře!E = $C$4`), the plan C is computed from the cycle plan `$G$6` (cycle `Plán videí`, fallback monthly target) with the same remainder-absorption rounding (here the sum of `ROUND(G6*B)` is recomputed inline). No "Publikováno" column (planning/approval phase only). Row 50: SUMs for B..G, `H50` status formula.

### 7.8 Section 6 - Obsahové série (A53:L65, 12 slots)

Headers (row 53): `Název série | ID | Stav | Garant | Plán dílů | Díly se scénářem | Schváleno | Natočeno | Publikováno | Plnění | Zbývá dílů | Otevřené připomínky`.
Row n (54-65) shows the n-th active series (`Série!AA = n`). Pattern, row 54 verbatim (`MATCH(1,...)` -> `MATCH(2,...)` ... `MATCH(12,...)`, verified for rows 54-65):
```
A54: =IFERROR(INDEX(Série!$B$4:$B$103,MATCH(1,Série!$AA$4:$AA$103,0)),"")     name  (Série B)
B54: =IFERROR(INDEX(Série!$A$4:$A$103,MATCH(1,Série!$AA$4:$AA$103,0)),"")     ID    (Série A)
C54: ... INDEX(Série!$M$4:$M$103 ...)   Stav       (Série M)
D54: ... INDEX(Série!$E$4:$E$103 ...)   Garant     (Série E)
E54: ... INDEX(Série!$G$4:$G$103 ...)   Plán dílů  (Série G)
F54: ... INDEX(Série!$P$4:$P$103 ...)   Díly se scénářem (Série P)
G54: ... INDEX(Série!$Q$4:$Q$103 ...)   Schváleno  (Série Q)
H54: ... INDEX(Série!$R$4:$R$103 ...)   Natočeno   (Série R)
I54: ... INDEX(Série!$S$4:$S$103 ...)   Publikováno (Série S)
J54: ... INDEX(Série!$T$4:$T$103 ...)   Plnění     (Série T)
K54: ... INDEX(Série!$U$4:$U$103 ...)   Zbývá dílů (Série U)
L54: ... INDEX(Série!$V$4:$V$103 ...)   Otevřené připomínky (Série V)
```
Only series with `Série!Z = "ANO"` (not Uzavřená/Zrušená) appear, in sheet order; beyond 12 active series the rest are silently not shown. CF: C54:C65 `Návrh` yellow, `Pozastavená` grey; J54:J65 green if >=1; L54:L65 red bold if >0.

### 7.9 Section 7 - Historie po měsících (A69:L93)

Headers (row 69): `Měsíc | Plán (ks) | Scénáře (plán. měsíc) | Schváleno | Publikováno | Plnění | Nábor a vedení | Osobní brand | Trendy a trh | Produkt. tipy | Odborné | Instagramové`.
24 rows (70-93), months `Nastavení!$U$4` ... `$U$27` (= 2026-10 ... 2028-09). Row 70 verbatim:
```
A70: =Nastavení!$U$4
B70: =Nastavení!$B$3
C70: =COUNTIFS(Scénáře!$F$4:$F$503,$A70,Scénáře!$W$4:$W$503,"<>Zrušeno",Scénáře!$W$4:$W$503,"<>Odloženo")
D70: =COUNTIFS(Scénáře!$F$4:$F$503,$A70,Scénáře!$W$4:$W$503,"Schváleno")
E70: =COUNTIFS(Scénáře!$AH$4:$AH$503,$A70)
F70: =IF(B70=0,"",E70/B70)
G70: =COUNTIFS(Scénáře!$AH$4:$AH$503,$A70,Scénáře!$G$4:$G$503,Nastavení!$A$10)     (H: $A$11; I: $A$12; J: $A$13)
K70: =COUNTIFS(Scénáře!$AH$4:$AH$503,$A70,Scénáře!$H$4:$H$503,Nastavení!$A$18)     (L: $A$19)
```
(All 24 rows follow this pattern exactly; verified programmatically.) G:J = published videos in actual month by category; K:L = by Typ zpracování. CF: whole row bold when `$A70=$C$3`; F green if >=1, yellow if <1 and E>0.

### 7.10 Cached values for the selected state - **month C3 = `2026-11`, cycle C4 = `2026-11`, TODAY() cached = 2026-10-26**

Use these as test expectations (computed by Excel on 2026-10-26; TODAY-dependent cells flagged with *).

Header block: G3=16, G4=2026-11-20, G5=2026-11-13, G6=16, K4=25*, K5=18*, K6=`30–40`, C5=2026-10-26*.

**Section 1** (month 2026-11):

| Row | Kategorie | Cíl % | Plán | Navrženo | Schváleno | Chybí | Natočeno | Publikováno | Plnění | Stav |
|-----|-----------|------|------|----------|-----------|-------|----------|-------------|--------|------|
| 10 | Nábor, vedení lidí a práce s týmem | 0.3 | 5 | 2 | 1 | 4 | 1 | 0 | 0 | CHYBÍ SCÉNÁŘE |
| 11 | Osobní brand & Lifestyle | 0.4 | 6 | 2 | 1 | 5 | 0 | 0 | 0 | CHYBÍ SCÉNÁŘE |
| 12 | Trendy a reakce na trh | 0.2 | 3 | 1 | 0 | 3 | 0 | 0 | 0 | CHYBÍ SCÉNÁŘE |
| 13 | Produktové a poradenské tipy | 0.1 | 2 | 2 | 1 | 1 | 0 | 0 | 0 | Čeká na schválení |
| 14 | Celkem | 0.9999999999999999 | 16 | 7 | 3 | 13 | 1 | 0 | 0 | CHYBÍ SCÉNÁŘE |

**Section 2** (month 2026-11):

| Row | Typ | Cíl % | Plán | Navrženo | Schváleno | Chybí | Natočeno | Publikováno | Plnění | Stav |
|-----|-----|------|------|----------|-----------|-------|----------|-------------|--------|------|
| 18 | Odborně hodnotné | 0.3 | 5 | 2 | 1 | 4 | 0 | 0 | 0 | CHYBÍ SCÉNÁŘE |
| 19 | Instagramové | 0.7 | 11 | 5 | 2 | 9 | 1 | 0 | 0 | CHYBÍ SCÉNÁŘE |
| 20 | Celkem | 1 | 16 | 7 | 3 | 13 | 1 | 0 | 0 | CHYBÍ SCÉNÁŘE |

**Section 3** (month 2026-11, tolerance 10 p. b.):

| Row | Profil | Charakter | Cíl % | Scénáře (ks) | Scénáře % | Stav přípravy | Publikováno (ks) | Publikováno % | Stav publikace |
|-----|--------|-----------|------|--------------|-----------|----------------|------------------|----------------|----------------|
| 24 | Honza | Osobní | 0.7 | 1 | 0.5 | MIMO POMĚR | 0 | "" | – (nic nepublikováno) |
| 25 | Honza | Pracovní | 0.3 | 1 | 0.5 | MIMO POMĚR | 0 | "" | – (nic nepublikováno) |
| 26 | Radek | Osobní | 0.7 | 1 | 0.25 | MIMO POMĚR | 0 | "" | – (nic nepublikováno) |
| 27 | Radek | Pracovní | 0.3 | 3 | 0.75 | MIMO POMĚR | 0 | "" | – (nic nepublikováno) |

(A22 title cached: `3. CHARAKTER OSOBNÍCH PROFILŮ (osobní 70 % / pracovní 30 %) – měsíc 2026-11  (tolerance ±10 p. b.)`.)

**Section 4** (cycle 2026-11):

| Row | Ukazatel | Vybraný cyklus | Všechny cykly |
|-----|---------|----------------|---------------|
| 31 | Plán videí pro cyklus | 16 | - |
| 32 | Scénářů celkem (bez odložených a zrušených) | 7 | 10 |
| 33 | Čeká na zpětnou vazbu vedení | 2 | 2 |
| 34 | Čeká na marketéry | 2 | 3 |
| 35 | Schváleno | 3 | 5 |
| 36 | Chybí schválených do plánu cyklu | 13 | - |
| 37 | Schváleno a čeká na natáčení | 2 | 2 |
| 38 | Po termínu odevzdání scénáře (neschválené) | 1* | 1* |
| 39 | Neschváleno po termínu schválení cyklu | 0* | 0* |
| 40 | Otevřené připomínky (Nevyřešeno) | 2 | 2 |
| 41 | Natočeno (vč. ve střihu a publikovaných) | 1 | 3 |
| 42 | Odloženo / Zrušeno | 0 | 0 |

Note: cycle 2026-11 contains V003, V004, V005, V007, V008, V009, V010 (7); V006 is in cycle 2026-12 and V001/V002 in 2026-10. Row 38 = V007 (U = 2026-10-20 < today; status K dopracování). Row 39 would become non-zero for unapproved items after 2026-11-13.

**Section 5** (cycle 2026-11, plan 16):

| Row | Kategorie | Cíl % | Plán | Navrženo | Schváleno | Chybí | Natočeno | Stav |
|-----|-----------|------|------|----------|-----------|-------|----------|------|
| 46 | Nábor, vedení lidí a práce s týmem | 0.3 | 5 | 2 | 1 | 4 | 1 | CHYBÍ SCÉNÁŘE |
| 47 | Osobní brand & Lifestyle | 0.4 | 6 | 2 | 1 | 5 | 0 | CHYBÍ SCÉNÁŘE |
| 48 | Trendy a reakce na trh | 0.2 | 3 | 1 | 0 | 3 | 0 | CHYBÍ SCÉNÁŘE |
| 49 | Produktové a poradenské tipy | 0.1 | 2 | 2 | 1 | 1 | 0 | Čeká na schválení |
| 50 | Celkem | 0.9999999999999999 | 16 | 7 | 3 | 13 | 1 | CHYBÍ SCÉNÁŘE |

(A44 cached: `5. TEMATICKÝ MIX PRO NATÁČECÍ CYKLUS 2026-11  (plán 16 videí – fáze plánování a schvalování)`.)

**Section 6** (rows 54-55; rows 56-65 = ""):

| Row | Název | ID | Stav | Garant | Plán dílů | Díly se scénářem | Schváleno | Natočeno | Publikováno | Plnění | Zbývá | Otevřené připomínky |
|-----|-------|----|------|--------|-----------|------------------|-----------|----------|-------------|--------|-------|---------------------|
| 54 | UKÁZKA – Investiční chyby začátečníků | S01 | Rozpracovaná | Radek | 8 | 3 | 1 | 0 | 0 | 0 | 8 | 0 |
| 55 | UKÁZKA – Zákulisí finančního poradce | S02 | Návrh | Honza | 5 | 0 | 0 | 0 | 0 | 0 | 5 | 0 |

**Section 7** (history; C3=2026-11 highlighted bold on row 71):

| Měsíc | Plán | Scénáře | Schváleno | Publikováno | Plnění | Nábor | Osobní brand | Trendy | Produkt. tipy | Odborné | Instagramové |
|-------|------|---------|-----------|-------------|--------|-------|--------------|--------|---------------|---------|--------------|
| 2026-10 | 16 | 2 | 2 | 2 | 0.125 | 1 | 1 | 0 | 0 | 1 | 1 |
| 2026-11 | 16 | 7 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2026-12 | 16 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2027-01 ... 2028-09 (21 rows) | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Cached values are present for every formula cell (none missing); empty-string results are cached as "".

---

## 8. Cross-sheet dependency summary (port-oriented)

- `Scénáře` is the single source: Přehled sections 1-5 and 7 are pure COUNTIFS/SUMPRODUCT aggregations over `Scénáře!F, G, H, I, J, E, W, AA, U, AE, AH, AI` (rows 4-503); section 6 reads `Série`.
- `Scénáře` computed columns depend on `Připomínky!A,J` (AE), `Publikace!A,E` (AF/AG/AH), `Nastavení!A30:G53` col 3 (cycle approval deadline in AI) and `TODAY()`.
- `Série` computed columns depend on `Scénáře!C,W,AA,AE,AF` and `Publikace!C,G`.
- `Publikace!B,C` and `Připomínky!B` look up `Scénáře!A:C`.
- `Nastavení` feeds category names/targets (Přehled), the cycle table (VLOOKUP col 2/3/4/6 on `A30:G53`) and all dropdown lists.
- Volatile inputs: `TODAY()` is used in Přehled C5, K4, K5, B38, C38, Scénáře AI and CF (U column) and Nastavení B6.
- Statuses compared as literal strings (see 2.6). Month keys are text `YYYY-MM`.

---

## 9. Inconsistencies, edge cases and surprises

1. **Hidden dropdowns for openpyxl**: all list validations live in `x14:dataValidations` extension nodes (cross-sheet references); openpyxl warns "Data Validation extension is not supported and will be removed" - loading + saving with openpyxl would **delete every dropdown**. Only date validations (standard `dataValidation`) survive.
2. **Dropdown ranges include blank slots**: `Nastavení!$I$4:$I$18` (marketers, 12 blank), `$K$4:$K$11` (profiles, 5 blank), `$J$4:$J$8` (approvers, 3 blank). With allowBlank on, blanks are harmless; extending the lists beyond these ranges silently won't be offered. `Nastavení!U4:U42` months list (39 months, through 2029-12) is longer than both the cycle table (24 cycles, through 2028-09) and the Přehled history (24 months, through 2028-09): choosing a month after 2028-09 gives no cycle and no history row; the cycle dropdown and `Scénáře!E` can only reach 2028-09.
3. **Floating point**: `Nastavení!B14`/`Přehled!B14`/`B50` cached `0.9999999999999999`; the CF "notEqual 1" on `Nastavení!B14` would be true under strict IEEE comparison.
4. **Section 3 hard-codes** profile names (`Honza`, `Radek`) and characters (`Osobní`, `Pracovní`) in A24:B27, and the title text says "70 % / 30 %" literally even though the targets come from Nastavení!B24:B25. `Scénáře!J = "Nevztahuje se"` rows for Honza/Radek are excluded from section 3 (and flagged in AI).
5. **Section 1/2 plan ignores month**: `Plán (ks)` is always `Nastavení!E10:E13` (monthly target); section 7 "Plán" is `Nastavení!B3` for every month; only the cycle plan (`G6`, Nastavení col D) can differ.
6. **Mixed month bases**: "Navrženo/Schváleno/Natočeno" in section 1-2 use planned month (`F`), "Publikováno" uses actual first-publication month (`AH`). A video published in a different month than planned counts in the planned month for approval but in the actual month for publication. Natočeno (G) does not exclude `Zrušeno`/`Odloženo`, unlike Navrženo.
7. **Dates that are text-like keys**: `COUNTIFS(..., $C$3)` compares text `2026-11`. In Excel, COUNTIFS criteria that look like dates/numbers may be coerced; cached results show the text match works in Excel 16, but behaviour may differ in other engines (Google Sheets, LibreOffice). A port should use exact string equality.
8. **AG/AH edge case**: a Publikace row with an ID but empty date makes `MINIFS` return 0 -> `AG` = 0 (date 1899/1900) -> `AH` = `1900-01`; AF counts such a row as a publication. Conversely, `AH` is only blank when no Publikace rows exist.
9. **Odloženo counted differently**: `Série!P` excludes only `Zrušeno` (Odloženo counted), whereas Přehled "Navrženo" excludes both; `Série!R` (Natočené) and `Q` count regardless of cancellation. `Série!S` counts a video as published if AF>0 even without the "Publikováno" production status.
10. **"Aktivní" series**: `Dokončená` and `Pozastavená` remain active (Z="ANO") although the status `Dokončená` is highlighted green; the Přehled shows only the first 12 active series with no overflow indicator beyond the static note in A66.
11. **`Nastavení!B6` is unused** by formulas (each uses `TODAY()` directly), so "today" cannot be overridden in the sheet; a port needs an injectable clock. All TODAY-dependent expectations above assume 2026-10-26.
12. **`Nastavení!E30:E53`** ("Které měsíce publikace pokrývá") and `F30:F53` ("30–40" text) are informational only; F is read only in Přehled!K6. `D30:D53` is yellow (editable) but pre-filled with `=$B$3`.
13. **Návod vs. workbook**: Návod says formulas are prepared "do řádku 503; u sérií do 103" (matches: 500 rows for Scénáře/Připomínky/Publikace, 100 for Série). Návod's "Stav výroby (Natočeno → Ve střihu → Sestříháno → Publikováno)" omits `Čeká na natáčení` and `Nenatočeno`, which exist in the list; `Nenatočeno` is not counted as shot anywhere.
14. **Sample/data oddities**: V010 (`Nový střih existujícího videa`, "Bez natáčení – jen střih") has status `Ve střihu` and so counts as "Natočeno" in Přehled though nothing was shot (original footage from V001); V006 has blank `Stav výroby` (the only row; not approved, so the `AA=""` clause in "Schváleno a čeká na natáčení" is not exercised by sample data). Připomínky row 5 (2026-11-04) and reactions dated 2026-11-06 lie after the file's modification date (2026-10-26). V002's `Schválil` is Radek although the profile is Honza (fine - any approver).
15. **Sheet protection** on Přehled has no password; only C3/C4 are unlocked, so a port should treat all other Přehled cells as read-only outputs.
16. **No named ranges and no macros**; no data in Návod other than text. `Připomínky!A` dropdown references `Scénáře!A4:A503` (video IDs entered earlier), so IDs must exist in Scénáře first; mismatched IDs surface as `ID nenalezeno` in B.
17. **Date validation** uses serial `36526` (= 2000-01-01) as lower bound; error message says "DD.MM.RRRR" (Czech format) but cells store true date serials.
18. **Case/diacritics sensitivity**: formulas compare literal Czech strings (`Schváleno` vs `Schvaleno` would not match); COUNTIFS in Excel is case-insensitive, a port must replicate or normalise.
