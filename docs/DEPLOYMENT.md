# Deployment (Vercel)

Target: **Vercel**. The deployable app is `apps/shopify` (React Router 7); the
`packages/*` are workspace dependencies bundled at build time. Shopify remains the
business-data store; **PostgreSQL is used only for Shopify app session storage** (Prisma).

## Session storage — Prisma + PostgreSQL

The template shipped SQLite (not serverless-safe). It is now **PostgreSQL**:

- `prisma/schema.prisma` → `datasource db { provider = "postgresql"; url = env("DATABASE_URL") }`
- `prisma/migrations/…create_session_table/migration.sql` → PostgreSQL DDL, with
  `migration_lock.toml` (`provider = "postgresql"`).
- `PrismaSessionStorage` in `app/shopify.server.ts` is unchanged (Prisma abstracts the DB).

No GST business data is in Prisma — only the `Session` table.

## Local development (same path as production)

1. Start Postgres (any of): the bundled compose file, a local install, or a hosted dev branch.

   ```bash
   docker compose up -d          # postgres on localhost:5432 (see docker-compose.yml)
   ```

2. Set `DATABASE_URL` in `.env` (see `.env.example`):

   ```
   DATABASE_URL=postgresql://gst:gst@localhost:5432/gst_sessions
   ```

3. Apply the migration and run:

   ```bash
   pnpm --filter @gst-engine/shopify exec prisma migrate deploy
   pnpm --filter @gst-engine/shopify dev     # shopify app dev (sets SHOPIFY_APP_URL to the tunnel)
   ```

`pnpm build` (root) does **not** need a database — it runs `react-router build`. Only
running the app / `prisma migrate deploy` needs `DATABASE_URL`.

## Vercel project setup

- **Root Directory:** `apps/shopify` (Vercel detects the pnpm workspace and installs from the repo root).
- **Build Command:** `pnpm vercel-build` (set in `apps/shopify/vercel.json`) →
  `prisma generate && prisma migrate deploy && react-router build`. Vercel sets `VERCEL=1`,
  which activates the Vercel preset in `react-router.config.ts`.
- **Install Command:** default (`pnpm install`); the app's `postinstall` runs `prisma generate`.
- **Node version:** 22 (matches `engines`).

`prisma migrate deploy` runs at build time, so `DATABASE_URL` must be set in the Vercel
project env for the build. Use a serverless-friendly Postgres (Neon/Supabase/Vercel
Postgres); for pooled connections you may later add a `directUrl` for migrations.

## Environment variables (Vercel → Project → Environment Variables)

Server-side only; never hard-coded. See `.env.example` for the full list.

| Variable                                           | Purpose                               | Needed at       |
| -------------------------------------------------- | ------------------------------------- | --------------- |
| `DATABASE_URL`                                     | Postgres session store                | build + runtime |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET`           | Shopify app credentials               | runtime         |
| `SHOPIFY_APP_URL`                                  | the Vercel production URL (see below) | runtime         |
| `SCOPES`                                           | access scopes (mirror of toml)        | runtime         |
| `SHOP_CUSTOM_DOMAIN`                               | `rinstruments.com`                    | runtime         |
| `SHOPIFY_OFFLINE_ACCESS_TOKEN`                     | webhooks/cron (D7)                    | runtime (later) |
| `GST_PROVIDER` / `GST_API_URL` / `GST_API_KEY`     | GST provider (mock until M10)         | runtime         |
| `EMAIL_PROVIDER` / `EMAIL_FROM` / `RESEND_API_KEY` | email (M7)                            | runtime         |
| `CRON_SECRET`                                      | protects the cron route (M7)          | runtime (later) |

## Shopify config that changes once the Vercel URL is known

Do **not** change these until Vercel gives the production URL, and do **not** run
`shopify app deploy` yet:

- `shopify.app.toml` → `application_url` (currently the `shopify.dev` placeholder)
- `shopify.app.toml` → `[auth].redirect_urls`
- `shopify.app.toml` → `[app_proxy].url` (→ `<vercel-url>/proxy`)
- Vercel env `SHOPIFY_APP_URL`

`automatically_update_urls_on_dev = true` handles these during `shopify app dev`; for
production they are set explicitly to the Vercel URL and deployed with `shopify app deploy`
(a later, separate step).

## Not done here (deliberately)

- No `shopify app deploy`; Shopify config still points at placeholders.
- Distribution stays `AppStore` in code (D13) — the custom/single-merchant decision is separate.

## Rollback

GST Pro runs in parallel until cutover; rollback = re-enable GST Pro as the invoice source
of record. All business data lives in Shopify, so nothing is lost.
