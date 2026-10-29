# Nasazení na Vercel (Neon Postgres)

## Proměnné prostředí (Vercel > Settings > Environment Variables)

| Proměnná | Povinná | Poznámka |
| --- | --- | --- |
| `DATABASE_URL` | ano | Nastaví integrace Vercel Neon (pooled pgbouncer URL). Musí být zapnutá pro **Preview** i **Production**. |
| `AUTH_SECRET` | ano | Náhodný řetězec, minimálně 32 znaků (např. `openssl rand -base64 48`). |
| `ALLOW_DEV_LOGIN` | ne | `1` jen pro testování: zapne přihlášení bez e-mailu. V ostrém provozu nenastavovat. |
| `SEED_DEMO` | ne | `1` nahraje při buildu ukázková data. Seed je idempotentní a nepřepisuje úpravy. |
| `RESEND_API_KEY`, `MAIL_FROM` | později | Odesílání přihlašovacích e-mailů. Bez klíče se e-maily jen vypisují do logu. |
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

Za běhu na Vercelu se migrace už nespouštějí. Lokálně: `npm run db:migrate` (vyžaduje Postgres URL).
