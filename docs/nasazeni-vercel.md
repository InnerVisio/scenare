# Nasazení na Vercel (Neon Postgres)

## Proměnné prostředí (Vercel > Settings > Environment Variables)

| Proměnná | Povinná | Poznámka |
| --- | --- | --- |
| `DATABASE_URL` | ano | Nastaví integrace Vercel Neon (pooled pgbouncer URL). Musí být zapnutá pro **Preview** i **Production**. |
| `AUTH_SECRET` | ano | Náhodný řetězec, minimálně 32 znaků (např. `openssl rand -base64 48`). |
| `ALLOW_DEV_LOGIN` | ne | `1` jen pro testování: zapne přihlášení bez e-mailu. V ostrém provozu nenastavovat. |
| `SEED_DEMO` | ne | `1` nahraje při buildu ukázková data. Seed je idempotentní a nepřepisuje úpravy. |
| `RESEND_API_KEY`, `MAIL_FROM` | pro e-maily | Odesílání přihlašovacích e-mailů, souhrnů a upozornění. Bez klíče se e-maily jen vypisují do logu. `MAIL_FROM` např. `GTA Scénáře <scenare@tvoje-domena.cz>` (doména musí být ověřená v Resendu). |
| `CRON_SECRET` | pro e-maily | Náhodný řetězec (`openssl rand -hex 32`). Chrání adresu `/api/cron/tick`, kterou volá plánovač. Bez něj vrací 503. |
| `APP_URL` | ne | Na Vercelu se adresa odvodí sama (viz níže). Nastav jen pro vlastní doménu. |

## Preview nasazení a větve

- Každá větev a pull request dostane vlastní preview nasazení s adresou `…-git-<větev>-….vercel.app`.
  Odkazy v e-mailech a kontrola původu přihlášení používají právě tuto adresu (`VERCEL_BRANCH_URL`).
- Větev nastavená jako Production (obvykle `master`) se nasazuje na produkční doménu (`VERCEL_PROJECT_PRODUCTION_URL`).
- Preview nasazení sdílejí databázi z `DATABASE_URL` pro Preview. Pro oddělená data použij v integraci Neon větve databáze.

## Migrace

Vercel místo `build` spouští skript `vercel-build`:

1. `tsx scripts/migrate.ts` – aplikuje migrace ze složky `drizzle/` (při selhání build skončí chybou),
2. `node scripts/maybe-seed.mjs` – při `SEED_DEMO=1` nahraje ukázková data,
3. `next build`.

Migrace i seed používají přednostně `DATABASE_URL_UNPOOLED` (přímé připojení bez pgbouncer, které nastavuje integrace Neon; vhodnější pro DDL a transakce). Když chybí, použije se `DATABASE_URL`. Aplikace za běhu používá pooled `DATABASE_URL`.

Za běhu na Vercelu se migrace už nespouštějí. Lokálně: `npm run db:migrate` (vyžaduje Postgres URL).

## Plánovač e-mailů (GitHub Actions)

Aplikace sama nic nespouští. Workflow `.github/workflows/cron.yml` volá každých 15 minut `GET /api/cron/tick` (funguje na jakémkoli plánu Vercelu). Ten rozešle shrnutí nových událostí (nejdřív po 10 minutách, nejvýš jednou za hodinu na uživatele) a po 8:00 pražského času jednou denně souhrn s připomínkami termínu schválení (3 dny a 1 den předem).

1. Na Vercelu nastav `CRON_SECRET` (stejnou hodnotu použij níže), `RESEND_API_KEY` a `MAIL_FROM`.
2. V GitHubu otevři Settings > Secrets and variables > Actions > New repository secret a přidej:
   - `APP_URL` = `https://scenare.vercel.app` (bez lomítka na konci),
   - `CRON_SECRET` = stejná hodnota jako na Vercelu.
3. V záložce Actions spusť „Plánovač e-mailů“ ručně (Run workflow) a zkontroluj, že doběhl.
4. V aplikaci otevři Nastavení > Diagnostika a pošli si testovací e-mail.

Bez secrets workflow jen vypíše hlášku a skončí.

## Ověření domény v Resendu

1. Na resend.com otevři Domains > Add Domain a zadej svou doménu (např. `tvoje-domena.cz`).
2. Resend ukáže DNS záznamy (SPF, DKIM, případně DMARC). Přidej je u správce domény.
3. Počkej, až u domény svítí „Verified“ (obvykle do hodiny).
4. V API Keys vytvoř klíč s právem „Sending access“ a vlož ho do `RESEND_API_KEY`.
5. Nastav `MAIL_FROM` na adresu z ověřené domény. Z neověřené domény Resend e-maily nedoručí.

## Účty a přihlášení

- **Osobní přihlašovací odkaz** (hlavní cesta): Nastavení → Uživatelé → u uživatele „Přihlašovací odkaz“ (jen admin). Odkaz pošli přes WhatsApp/SMS. Platí 7 dní, jde použít jednou; nový odkaz zneplatní starší nepoužitý. Po otevření a potvrzení zůstane uživatel přihlášený 90 dní (cookie se obnovuje, když je starší 7 dní).
- **Heslo pro admina**: nastav `ADMIN_PASSWORD` (alespoň 12 znaků, jinak je funkce vypnutá). Na /login pak přibude odkaz „Přihlásit heslem (admin)“; funguje jen pro uživatele s rolí admin, 5 chybných pokusů za 15 minut e-mail zablokuje.
- **Vývojové přihlášení**: `ALLOW_DEV_LOGIN=1` dovolí komukoli přihlásit se jako kdokoli. Po rozdání odkazů ho ve Vercelu smaž (Settings → Environment Variables) a nasaď znovu. Diagnostika (/nastaveni/diagnostika) na to upozorní.
