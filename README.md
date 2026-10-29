# Scénáře

Interní webová aplikace pro psaní a schvalování scénářů krátkých videí. Admin scénář napíše v editoru a odešle ke kontrole, vedení (Radek a Honza) v něm komentuje, navrhuje změny a vrací ho k dopracování nebo schvaluje. Scénář je schválený, až když ho schválí oba. Celé rozhraní je česky.

## Požadavky

- Node.js 22 (`22.x`)
- npm

Databáze není potřeba instalovat: lokálně běží vestavěný PGlite (data v `.data/pglite`).

## Rychlý start

```bash
npm install
cp .env.example .env.local      # volitelné, výchozí hodnoty stačí pro lokální běh
npm run db:seed -- --demo       # ukázková data
npm run dev                     # http://localhost:3000
```

Přihlášení bez e-mailu: otevři `/dev-login` a vyber uživatele (Admin, Radek nebo Honza). Funguje jen s `ALLOW_DEV_LOGIN=1`.

## Testy

```bash
npm test             # jednotkové a integrační testy (Vitest)
npm run lint
npm run typecheck
npm run test:e2e     # Playwright, mobil 390×844 a desktop 1440×900
```

E2E testy samy sestaví aplikaci, vytvoří a naplní databázi `.data/e2e` a spustí server na portu 3100. Hlavní scénář je v `tests/e2e/review-flow.spec.ts`: od napsání scénáře přes komentáře a návrhy až po schválení oběma.
Při prvním spuštění je potřeba `npx playwright install chromium`.

## Proměnné prostředí

Vzor je v `.env.example`.

| Proměnná | Význam |
| --- | --- |
| `DATABASE_URL` | Připojení k databázi. Nevyplněno nebo `pglite:<složka>` = lokální PGlite; jinak `postgres://…`. |
| `DATABASE_URL_UNPOOLED` | Přímé připojení bez poolingu (Neon ho nastaví sám). Používá se pro migrace a seed, jinak `DATABASE_URL`. |
| `AUTH_SECRET` | Tajný klíč pro relace a přihlašovací odkazy, min. 32 znaků. |
| `APP_URL` | Veřejná adresa aplikace pro odkazy v e-mailech. Na Vercelu se odvodí automaticky, nastav ji jen pro vlastní doménu. |
| `RESEND_API_KEY` | Klíč k Resendu pro odesílání e-mailů. Bez něj se e-maily jen vypisují do konzole. |
| `MAIL_FROM` | Odesílatel e-mailů, např. `Scénáře <scenare@example.com>`. |
| `ALLOW_DEV_LOGIN` | `1` zapne `/dev-login`. V produkci nesmí být zapnuté. |
| `SEED_DEMO` | `1` při Vercel buildu po migraci nahraje ukázková data (seed je idempotentní a nepřepisuje úpravy). |

## Nasazení (Vercel + Neon)

1. Naimportuj repozitář do Vercelu a připoj Neon (Storage / Marketplace), který nastaví `DATABASE_URL` a `DATABASE_URL_UNPOOLED`.
2. Nastav `AUTH_SECRET`, případně `RESEND_API_KEY`, `MAIL_FROM` a pro vlastní doménu `APP_URL`.
3. Při každém buildu (`vercel-build`) se nejdřív spustí migrace databáze, volitelně seed (`SEED_DEMO=1`) a pak `next build`.

Podrobný postup: [docs/nasazeni-vercel.md](docs/nasazeni-vercel.md).
