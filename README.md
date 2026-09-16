# GST Engine

Production Shopify **embedded app** that owns the complete GST workflow for an Indian
Shopify merchant — GSTIN verification, customer GST profiles, invoice generation, PDF,
email, a customer download portal, credit notes, GSTR-oriented reports, and Tally export.

Built to **replace GST Pro** for [Rinstruments](https://rinstruments.com/) (Shopify Basic,
single location — Thane, Maharashtra / state code 27).

> **Architecture in one line:** Shopify is the primary database (metafields + Files +
> app-installation metafields). The only external dependency is a pluggable GST
> Verification API, mocked until credentials arrive. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Status

**Phase 0 — repository scaffolding.** No business logic yet. Milestones in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); every decision is logged in
[`docs/DECISIONS.md`](docs/DECISIONS.md).

## Tech stack (locked)

Node 22 LTS · pnpm · TypeScript (strict) · Shopify embedded app (Remix + App Bridge +
Polaris) · Shopify CLI · Vitest + Playwright · Vercel.

## Repository layout

```
apps/shopify/          Shopify-specific app (the ONLY Shopify-coupled code)
packages/              Framework-agnostic core — zero Shopify imports
  core  gst  tax  invoice  pdf  email  reports  exports  storage  shared
extensions/            theme-gst-ui · customer-account-ui · admin-ui
docs/                  ARCHITECTURE DATABASE DECISIONS DEPLOYMENT SHOPIFY_SETUP
                       GST_PROVIDER TESTING MIGRATION
tests/                 unit · integration · e2e
```

Each package's responsibility is documented in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Prerequisites

- **Node 22** (`nvm use` reads `.nvmrc`)
- **pnpm 9+** — not yet installed on this machine. Enable via Corepack (ships with Node 22):

  ```bash
  corepack enable pnpm
  ```

- **Shopify CLI** and a Shopify Partner account + development store (see
  [`docs/SHOPIFY_SETUP.md`](docs/SHOPIFY_SETUP.md)).

## Getting started

```bash
pnpm install          # install all workspaces
cp .env.example .env  # fill in secrets (never commit .env)
pnpm typecheck        # tsc project-references build
pnpm test             # unit + integration
pnpm lint
```

> The Shopify app in `apps/shopify/` is initialized with the Shopify CLI as the first
> task of Milestone M1 — that step is interactive (it opens a browser to authenticate),
> so it is run by a human, not in CI. Instructions: [`docs/SHOPIFY_SETUP.md`](docs/SHOPIFY_SETUP.md).

## Documentation

| Doc                                       | Purpose                                             |
| ----------------------------------------- | --------------------------------------------------- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)   | System design, modules, data flow, milestones       |
| [DATABASE.md](docs/DATABASE.md)           | Shopify-as-database: the metafield/Files data model |
| [DECISIONS.md](docs/DECISIONS.md)         | Architecture Decision Records (ADRs)                |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md)       | Vercel deploy, cron, secrets, go-live checkpoints   |
| [SHOPIFY_SETUP.md](docs/SHOPIFY_SETUP.md) | App creation, scopes, metafield definitions         |
| [GST_PROVIDER.md](docs/GST_PROVIDER.md)   | The GST verification provider contract              |
| [TESTING.md](docs/TESTING.md)             | Test strategy and how to run tests                  |
| [MIGRATION.md](docs/MIGRATION.md)         | Cutover plan from GST Pro                           |
