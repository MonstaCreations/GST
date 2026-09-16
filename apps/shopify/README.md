# @gst-engine/shopify

The Shopify **embedded app** — the only Shopify-coupled workspace. Scaffolded from
Shopify's official **React Router 7** app template (see DECISIONS.md **D10**) and being
integrated into the GST Engine monorepo.

## What this is

- React Router 7 + `@shopify/shopify-app-react-router` + App Bridge + Polaris.
- Routes under `app/` (admin UI, `auth.$`, `webhooks.*`).
- `shopify.app.toml` holds app config; `client_id` is empty until the app is **linked**
  to your Dev Dashboard org (interactive — see below).

## ⚠️ Linking — the one step that must be run interactively by you

The generator/link/deploy steps authenticate with your Shopify Dev Dashboard through a
**browser login**, which cannot run inside the automated session. Run these in your own
terminal from this folder:

```bash
cd apps/shopify
pnpm shopify app config link     # sign in, pick your org + app → writes client_id to shopify.app.toml
pnpm shopify app dev             # starts the dev server + tunnel against your dev store
```

Alternatively, to let the generator create/link the app for you, provide your org id
(found in the Dev Dashboard URL `https://dev.shopify.com/dashboard/<organization-id>`):

```bash
npm init @shopify/app@latest -- --organization-id <ORG_ID> --name gst-engine \
  --template reactRouter --flavor typescript -d pnpm
```

## Pending integration tasks (M1) — tracked, not yet done

1. **Swap Prisma/SQLite session storage** for a database-less strategy (token exchange +
   offline token as a Vercel secret) to honor DECISIONS.md **D1/D11**. Prisma is retained
   only until the app is confirmed running once.
2. **Expand access scopes** in `shopify.app.toml` from the template default
   (`write_products`) to the set in [`../../docs/SHOPIFY_SETUP.md`](../../docs/SHOPIFY_SETUP.md).
3. **Wire `packages/*`** (core/gst/tax/invoice/…) as dependencies of this app.
4. **Vercel deployment preset** for React Router + the cron reconciler (DECISIONS.md D3).
5. **Extensions** are generated under `apps/shopify/extensions/*` (Shopify CLI convention —
   DECISIONS.md **L7**); the design specs currently in the repo-root `extensions/` will be
   consolidated here.

## Scripts (from the template)

`pnpm --filter @gst-engine/shopify <script>`: `dev`, `build`, `deploy`, `config:link`,
`generate`, `typecheck`, `lint`. This app self-lints/formats with its own config; the root
ESLint/Prettier intentionally ignore `apps/**`.
