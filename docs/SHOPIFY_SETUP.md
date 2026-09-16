# Shopify setup

Steps to create the app, configure scopes and metafield definitions, and connect the
development store. Interactive steps (browser auth) are run by a human, not CI.

## 1. Prerequisites

- Shopify Partner account + a **development store** (or the client's dev/staging store).
- Shopify CLI installed: `npm i -g @shopify/cli`.
- Node 22 (`nvm use`) and pnpm (`corepack enable pnpm`).

## 2. Initialize the embedded app (M1)

The app lives in `apps/shopify/`. Initialize it there with the Remix template:

```bash
cd apps/shopify
shopify app init            # choose the Remix template; app name: "GST Engine"
```

This opens a browser to authenticate with Shopify Partners. It writes `shopify.app.toml`
and app credentials. Copy `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` into the root `.env`
(see `.env.example`). **Never commit `.env`.**

## 3. App scopes

Request the minimum scopes needed:

```
read_products, write_products,
read_customers, write_customers,
read_orders, write_orders,
read_files, write_files
```

`write_products`/`write_customers` are for writing HSN and GST-profile metafields.
`write_orders` is for invoice metafields. `write_files` is for PDF upload.

## 4. Authentication model (D7)

- **Embedded admin** uses managed install + **token exchange** (no long-lived token stored).
- **Webhooks + Cron reconciler** use the store's **offline access token**, captured once at
  install and stored as a **Vercel encrypted secret** (`SHOPIFY_OFFLINE_ACCESS_TOKEN`).

## 5. Metafield definitions

Created + pinned programmatically on first run (M1/M3/M5). Full list of namespaces, keys,
and types is in [DATABASE.md](DATABASE.md). App-owned namespaces are validated against the
current Admin API version before creation.

## 6. Webhooks

Subscribe to: `orders/create`, `orders/paid`, `orders/updated`, `refunds/create`,
`customers/update`, `app/uninstalled`. All verified via HMAC. Handlers return `200` fast
and defer work to the cron reconciler (see [ARCHITECTURE.md](ARCHITECTURE.md)).

## 7. App Proxy

Configure a proxy so the storefront theme extension can reach the backend:

```
Subpath prefix: apps
Subpath:        gst
Proxy URL:      https://<app-host>/proxy
```

The storefront calls `/apps/gst/verify`; the backend verifies the Shopify **signature**
parameter before processing.

## 8. Store facts (Rinstruments)

- Plan: **Basic** (no checkout extensibility → cart-page capture, D2).
- Location: **Thane, Maharashtra**, state code **27** (single seller GSTIN for now).
- Customer Accounts: **enabled**.
- Current app to replace: **GST Pro** (see [MIGRATION.md](MIGRATION.md)).

## 9. Go-live checkpoints (the four audit items)

Not blockers for development; verify before production (M11):

1. **Taxes & Duties** — confirm GST tax config so invoice totals reconcile (D5).
2. **Seller GST Registration** — populate `settings.*` app metafields.
3. **User Permissions** — confirm app scopes + staff access.
4. **Existing Metafields** — audit GST Pro's namespaces to avoid collisions and enable HSN
   migration.
