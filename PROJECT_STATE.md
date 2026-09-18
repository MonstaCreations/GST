# PROJECT_STATE

Living status for GST Engine. Updated at each milestone. See `docs/` for detail.

**Last updated:** 2026-09-18 · **Current phase:** Vercel deployment prep (complete)

---

## Current phase

**Vercel-readiness — DONE and verified.** The app builds for Vercel, session storage is
PostgreSQL (serverless-safe), and nothing is hard-coded. Actual deploy is gated only on a
Vercel project + `DATABASE_URL` + the production URL (see Blocked). No GST features were
added in this phase.

## Verification (this phase)
- `pnpm exec tsc -b` (packages) — ✅
- App `react-router typegen && tsc --noEmit` — ✅
- `pnpm build` (turbo, 11 tasks incl. app) — ✅ (no DB needed)
- `VERCEL=1 react-router build` (Vercel preset active) — ✅
- `prisma generate` (postgres client) — ✅
- Vitest — ✅ **69 tests**
- Root lint + Prettier — ✅

## Completed features (BUILT + TESTED)
- **Engine packages:** core, shared, gst, tax, invoice (65 tests).
- **M1 Shopify wiring:** API version 2026-07, scopes, metafield definitions + afterAuth,
  App-Proxy verify route, theme extension, order/refund/customer webhooks (4 metafield tests).
- **Vercel deployment prep:**
  - Prisma datasource **sqlite → postgresql**, `url = env("DATABASE_URL")`; migration
    regenerated as Postgres DDL + `migration_lock.toml`. `PrismaSessionStorage` unchanged.
  - Prisma stays **session-storage only** (no GST business data).
  - `react-router.config.ts` with the **Vercel preset** (guarded by `VERCEL` so local
    `pnpm build` stays a standard, testable Node build).
  - Scripts: `postinstall: prisma generate`, `vercel-build: prisma generate && prisma
    migrate deploy && react-router build`; `apps/shopify/vercel.json` sets the build command.
  - `@vercel/react-router` added; `@shopify/shopify-app-session-storage-prisma@9.0.1`
    confirmed compatible with the installed Prisma 6.19.3 (no upgrade).
  - `docker-compose.yml` (local Postgres) + `.env.example` `DATABASE_URL` so the Postgres
    path is testable locally (no production-only code path).

## Pending features (designed, not yet built)
- M3 customer GST profile persistence · M5 wiring (orders→invoice records) · M6 PDF ·
  M7 automation + email + portal · M8 credit notes + reports · M9 Tally + admin + logs ·
  M10 real GST provider.

## Blocked features
- **Actual Vercel deploy:** needs a Vercel project (Root Directory `apps/shopify`), a
  hosted `DATABASE_URL`, and the production URL. Then update Shopify URLs + `shopify app
  deploy` (a separate, deliberate step — not done here).
- **Real GST provider (M10):** API credentials. **Production email (M7):** verified domain.

## Known issues
1. ~~Session storage vs serverless~~ — **resolved**: PostgreSQL + Vercel preset. (For pooled
   Postgres, optionally add a `directUrl` for migrations later.)
2. **App `lint` script broken** (ESLint 8/9 template clash; code type-checks + builds).
   Root/packages lint clean. Tooling fix pending.
3. **Shopify URLs are placeholders** in `shopify.app.toml` (`application_url`,
   `redirect_urls`, `app_proxy.url`) — set to the Vercel URL before `shopify app deploy`.
4. **Distribution = AppStore** in code (D13) — confirm custom/single-merchant before prod.

## Required merchant inputs (not blocking current build)
- Vercel project + hosted Postgres URL · production domain · app distribution decision ·
  seller GST identity + bank details · invoice numbering start · GST API creds · email
  provider + verified domain · logo · tax-inclusive pricing + HSN source.

## Next action
Repository is Vercel-ready. Either (a) create the Vercel project + Postgres and deploy
(needs the URL, then update Shopify config), or (b) resume GST features at **M3/M5/M6** on
the dev store with the mock provider. Continue committing per milestone.
