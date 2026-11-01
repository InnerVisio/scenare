# Fáze 1b — rozdělení videí, ukázky, rychlost

Stav: schváleno uživatelem 1. 11. 2026 („hlavně kontrola a zapisování scénářů, ukázka z TikToku/IG, scénáře se musí dobře počítat do rozdělení“).
Pořadí práce: **A rychlost → B ukázky → C rozdělení.** Každý blok = jeden úkol pro subagenta (sonnet, bez revize).

---

## A · Rychlost

Problém: na Vercelu je všechno pomalé, tlačítka reagují pozdě.
Podezření (z kódu): hodně dotazů po sobě na stránku (layout + stránka), dotazy ve smyčkách, autosave editoru každých 1,5 s přepočítává celý layout (`revalidatePath('/', 'layout')`), kontrola se obnovuje každých 10 s, tlačítka nemají okamžitou odezvu.

1. **Změřit** počet SQL dotazů pro každý loader stránky (layout, `/`, `/kontrola/[code]`, `/scenare`, `/scenare/[code]`, editor) a pro akce `saveDraft`, `decide`, `createComment` — test nad PGlite s počítadlem dotazů (`tests/perf/queryCount.test.ts`). Čísla před/po do reportu.
2. **Opravit:**
   - žádný dotaz ve smyčce (dávkovat přes `inArray`, mapy v paměti); nezávislé dotazy mimo transakci přes `Promise.all`;
   - layout: data pro menu a zvonek co nejmenším počtem dotazů;
   - autosave (`saveDraftAction`) **nevolá** `revalidatePath` — vrací jen `savedAt`;
   - polling kontroly 10 s → 30 s a neběží, když probíhá akce;
   - každé tlačítko, které volá server (Schválit, Vrátit, Odeslat, poslat komentář, Přijmout/Odmítnout, Zapracováno, dev-login), je okamžitě `disabled` + ukazuje „…“/spinner (`useTransition`/`useFormStatus`), aby bylo vidět, že se klik chytil.
3. Cíl: každá stránka ≤ 10 dotazů včetně layoutu, žádný počet dotazů nezávislý na počtu scénářů/komentářů. Test hlídá strop.
4. Region Vercelu se nemění (nevíme, kde je databáze).

## B · Ukázky (odkaz na TikTok / Instagram / YouTube)

Účel: některé scénáře se špatně vysvětlují — k videu (nebo konkrétní scéně) se přiloží odkaz na vzorové video, aby Honza a Radek věděli, jak to má vypadat.

- Data: `videos.references jsonb not null default '[]'` — pole `{ id, url, note, sceneId | null, addedBy, addedAt }`. Neverzuje se (je to podklad, ne obsah scénáře).
- Use casy (`src/server/references.ts`): `addReference(db, actor, { videoId, url, note, sceneId }, now)`, `removeReference(db, actor, { videoId, referenceId }, now)`.
  - Přidat smí každý přihlášený (Admin i vedení). Odebrat autor ukázky nebo Admin.
  - URL jen `http(s)://`, max 500 znaků; poznámka max 300 znaků; max 10 ukázek na video. Chyby česky („Vlož odkaz začínající https://“).
  - `sceneId` musí existovat v aktuálním těle (koncept / poslední verze), jinak `null`.
  - Aktivita `reference.added` / `reference.removed` → „Admin přidal ukázku k V031“; bez notifikací.
- Platforma z URL (čistá funkce `detectPlatform`): tiktok.com → „TikTok“, instagram.com → „Instagram“, youtube.com/youtu.be → „YouTube“, jinak „Odkaz“ + doména.
- UI (komponenta `ReferenceList` + `ReferenceForm`):
  - **Editor:** sekce „Ukázky“ pod detaily videa (vložit odkaz, poznámka, výběr „Celé video / Scéna N“) + u každé scény malé tlačítko „+ ukázka“ (předvyplní scénu).
  - **Kontrola (`/kontrola/[code]`) a detail (`/scenare/[code]`):** blok „Ukázky“ nad textem scénáře; ukázky ke scéně i jako malý odkaz „▶ ukázka“ v záhlaví dané scény. Karta: ikona/štítek platformy, poznámka, doména; celá karta je odkaz (`target="_blank" rel="noopener noreferrer"`) — na telefonu otevře aplikaci TikTok/IG. Žádné vkládání přehrávače (pomalé, cizí skripty).
  - Mobil: karta ≥ 48 px vysoká, celá šířka.
- Testy: unit `detectPlatform`, integrační add/remove (oprávnění, validace, limit), e2e: Admin přidá ukázku ke scéně v editoru → Radek ji vidí v kontrole.

## C · Rozdělení videí (tematický mix) — scénáře se musí správně počítat

Podle Excelu (Přehled, sekce 5 a 2–3), ale pro **natáčecí cyklus** (tak se pracuje: cyklus = jeden natáčecí den). Pohled po měsících publikace = fáze 3.

### Výpočet (čistá doména `src/domain/metrics/mix.ts`, přesně jako Excel)
- `splitTarget(total, items[{key, share}])`: každému `round(total*share)` (zaokrouhlení od nuly), rozdíl do součtu dorovná položka s největším podílem (první při shodě). 16 × 30/40/20/10 → 5/6/3/2; 16 × 30/70 → 5/11.
- `buildMix(videos, items, plan)` pro dimenzi **kategorie** (30/40/20/10) a **typ zpracování** (Odborně hodnotné 30 / Instagramové 70). Řádek: `plan`, `proposed` (vše kromě Odloženo/Zrušeno), `approved`, `missing = max(0, plan − approved)`, `status`: plan 0 → `none`; approved ≥ plan → `approved` („Schváleno ✔“); proposed ≥ plan → `pending` („Čeká na schválení“); jinak `missing` („Chybí scénáře“). Plus řádek Celkem a počet `unassigned` (scénáře bez kategorie/typu).
- `buildCharacterMix(videos, profiles, characters, tolerancePp)`: jen profily s `data.personal === true` (Honza, Radek); podíl Osobní/Pracovní mezi jejich scénáři (bez Odloženo/Zrušeno); `ok` když `|podíl − cíl| ≤ tolerance/100`, jinak `out` („Mimo poměr“); 0 scénářů → `none`.
- Plán cyklu = `shooting_cycles.plannedVideos`; podíly z číselníků (`data.share`), tolerance z nastavení.
- Test s demo daty + test přesně podle hodnot Excelu (16 → 5/6/3/2, 5/11; Radek 1 osobní / 3 pracovní → 25 % → Mimo poměr).

### Aby se scénáře počítaly správně
- **Odeslání ke kontrole vyžaduje** kategorii, typ zpracování, cyklus, profil; u osobního profilu i charakter (Osobní/Pracovní). Jinak `VALIDATION` „Před odesláním doplň: kategorii, typ zpracování…“ (výčet chybějících). Dialog Odeslat v editoru chybějící pole vypíše předem a tlačítko zablokuje.
- Seznam scénářů: filtr „Nezařazené“ (chybí kategorie nebo typ).

### Kde je to vidět
1. **Nástěnka:** místo zástupné karty „Přehled mixu…“ karta **„Rozdělení cyklu 2026-11“**: řádek na kategorii (barevná tečka, název, pruh: schválené plně + navržené světle vůči plánu, text „1 / 5 schváleno · 2 navrženo · chybí 4“, štítek stavu), pod tím Odborné/Instagramové a Honza/Radek osobní vs. pracovní (OK / Mimo poměr). Klik na řádek → `/scenare?cyklus=…&kategorie=…`. Upozornění „3 scénáře nejsou zařazené“ → filtr Nezařazené.
2. **Editor:** u výběru kategorie a typu zpracování nápověda podle cyklu („Trendy: 1 / 3 schváleno, chybí 2“) a v rozbalovacím seznamu u každé položky „(chybí N)“; u charakteru „Radek: osobní 25 % · cíl 70 %“. Admin tak píše to, co chybí.
3. **Kontrola:** v záhlaví scénáře štítek „Trendy · 2. ze 3 v cyklu“ — vedení vidí, jak scénář zapadá.
- Loader `getCycleMix(db, cycleId)` = 1–3 dotazy (videa cyklu + číselníky + nastavení), použitý nástěnkou, editorem i kontrolou.
