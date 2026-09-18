# GST Engine — Progress Report

_Status snapshot as of 2026-09-17. Written to be shared/pasted into another AI or teammate for full context._

---

## 1. What we're building

**GST Engine** — a production, Shopify **embedded app** that owns the complete Indian GST
workflow for a real client store and **replaces the third-party GST app (GST Pro)** entirely.

- **Client:** Rinstruments (https://rinstruments.com) — Indian laboratory / testing-instrument supplier.
- **Store facts:** Shopify **Basic** plan, single location **Thane, Maharashtra (state code 27)**, Customer Accounts enabled, GST Pro currently installed (to be replaced).
- **Signature feature:** buyer enters only a **GSTIN** on the cart page → we **verify** it → company name + registered address + city + state **auto-fill** → an order is placed → our engine generates a **GST-compliant invoice** (PDF + email + customer download portal).
- **Scope:** GSTIN verification, customer GST profiles, invoice generation, PDF, email, customer portal, credit notes, GSTR-1/3B-oriented reports, sales register, Tally export, embedded admin dashboard.

**The one external dependency** is a GST verification API (provider not yet chosen/credentialed). Everything else is built in-house. Until credentials arrive, a **mock provider** stands in behind a clean interface.

---

## 2. Locked architecture & tech stack

These are **fixed decisions** (do not redesign without a proven blocker):

- **Shopify is the primary database** in Phase 1 — no PostgreSQL/Prisma/Firebase/Mongo. Data lives in:
  - Customer GST profile → **customer metafields** (`gst.*`)
  - Product HSN / GST rate → **product metafields** (`tax.*`)
  - Order GST snapshot, invoice number/date/url/status → **order metafields** (`gst.*`, `invoice.*`)
  - Seller GST settings → **app-installation metafields** (`settings.*`)
  - Invoice PDFs → **Shopify Files**
- **Framework-agnostic core:** all GST/tax/invoice/numbering/report logic lives in `packages/*` with **zero Shopify imports**; only `apps/shopify` + `extensions/*` touch Shopify. (This is what lets the real GST API drop in later, and would let a future WooCommerce/Magento build reuse the engine.)
- **Everything pluggable:** GST provider, email, PDF renderer, storage, invoice numbering are all interfaces with swappable implementations.
- **Tech stack (locked):** Node 22 LTS · pnpm · TypeScript (strict) · Shopify embedded app (**React Router 7** — the current official Shopify template, successor to Remix) · App Bridge · Polaris · Shopify CLI · Vitest + Playwright · **Vercel** deployment · Turborepo monorepo.

### Key design decisions (recorded in `docs/DECISIONS.md`, D1–D11)

- **D3/D4 — Invoice numbering safety.** Metafields have no atomic counters, so invoices are **not** generated in the (parallel) webhook. A **single-concurrency Vercel Cron reconciler** scans recent orders and generates missing invoices, which serializes numbering. Numbering sits behind an `InvoiceNumberProvider` interface (metafield counter now; can swap to an atomic store later).
- **D5 — Tax reconciles to Shopify.** The invoice's tax **amount** comes from the order's actual `tax_lines` (what Shopify charged); our engine **classifies** it into CGST/SGST vs IGST and **validates** it — never silently overrides the charged total.
- **D6 — PDFs in Shopify Files** (public CDN URL; unguessable but not access-controlled — behind a `Storage` interface so we can move to signed URLs later).
- **D7 — Auth without a DB.** Token exchange for admin; the single store's offline token stored as a **Vercel secret** (an offline token can't live in a Shopify metafield — chicken/egg).
- **D8 — Email** via provider abstraction; production needs a verified sending domain (current sender is an unverified Gmail — not viable).
- **D9 — E-invoicing (IRN/QR)** reserved (QR block + `IRPProvider` seam) but not built; only legally required above the ₹5cr turnover threshold (client turnover unconfirmed).
- **D10 — React Router 7** is the current official Shopify app template (Remix was merged into it).
- **D11 — Prisma swap.** The stock template ships Prisma/SQLite session storage; it stays only until the app runs once, then is swapped to honor the no-DB rule.

### Shopify limitations surfaced & handled (L1–L7)

Atomic numbering (→ single-writer cron), public Files URLs (→ storage interface), offline-token storage (→ Vercel secret), metafields not queryable (→ Bulk Operations for reports), metafields size-capped (→ JSONL logs in Files), Customer Account UI extension availability on Basic (→ verify before building; App-Proxy fallback), extensions must live inside the app dir (→ `apps/shopify/extensions/*`).

---

## 3. What's been built and verified

**Repo:** https://github.com/RogbotNative/GST (branch `main`). Every phase is committed + pushed.

| Phase                                                                                | Status                                             | Commit                |
| ------------------------------------------------------------------------------------ | -------------------------------------------------- | --------------------- |
| **Phase 0 — Monorepo scaffold + all docs**                                           | ✅ Done                                            | `dc5e0cf`, `a4daa12`  |
| **M1 — Shopify app scaffold** (React Router 7 template integrated into the monorepo) | ✅ Scaffolded; **not yet linked** to Dev Dashboard | (in scaffold commits) |
| **M2 — GST verification module**                                                     | ✅ Done                                            | `933bb7c`             |
| **M5 core — tax + invoice engine**                                                   | ✅ Done                                            | `4745012`             |

### Verification status (all green)

- `tsc -b` (strict, project references) — passes
- **65 Vitest unit tests** across 9 files — all pass
- ESLint (flat config) + Prettier — clean
- `pnpm install` on Node 22.14 / pnpm 9.12 — clean

### Built for real (with tests)

- **`packages/shared`** — typed errors (`AppError`/`ValidationError`/`ProviderError`), `Logger` interface.
- **`packages/core`** — decimal-safe **Money** (integer paise: `paise`, `rupeesToPaise`, `paiseToRupees`, add/sub/sum/mul/percentage, remainder-safe `splitTaxHalf`); **`amountInWords`** (Indian lakh/crore); full **GST state-code table** (01–38, 97, 99) + helpers; shared domain models.
- **`packages/gst`** — GSTIN **format regex + mod-36 checksum** (verified against the canonical real GSTIN `27AAPFU0939F1ZV`); `validateGstin` (format → state_code → checksum); response **normalization**; **`MockGSTProvider`** (fixtures + synthesis + timeout); **`GSTVerifyProvider`** stub (inert until credentials); **`createVerificationService`** returning a discriminated outcome — `verified / inactive / not_found / invalid / unavailable` (any provider failure → `unavailable`, so **checkout never blocks**).
- **`packages/tax`** — `classifyTax` (intra-state CGST+SGST vs inter-state IGST, splitting the charged amount); `validateChargedTax` (flags rate divergence).
- **`packages/invoice`** — invoice/line models; `buildInvoiceItem`, `computeTotals` (grandTotal reconciles to taxable + taxes), `buildInvoice` (numbered + amount-in-words); `InvoiceNumberProvider` + in-memory impl + `financialYear` (Apr–Mar) — **verified gap-free & unique under `Promise.all` concurrency**.

### Contracts only (stubs, implemented in later milestones)

`packages/pdf` (M6), `packages/email` (M7), `packages/reports` (M8), `packages/exports` (M8/M9), `packages/storage` (M6) — each exports its interface with `TODO(M#)` stubs.

### Shopify app (`apps/shopify`)

Official React Router 7 template, integrated into the pnpm workspace (renamed `@gst-engine/shopify`, `@shopify/cli` added, root ESLint/Prettier ignore it so it self-manages). **Not yet linked** to the Dev Dashboard (`client_id` empty). Still ships the template's default `write_products` scope and Prisma session storage — both to be changed in M1 wiring once linked.

---

## 4. Repository layout

```
gst-engine/  (repo root)
  apps/shopify/        React Router 7 Shopify app (the only Shopify-coupled code)
  packages/
    shared core gst tax invoice   <- built + tested
    pdf email reports exports storage  <- interfaces + stubs
  docs/  ARCHITECTURE DATABASE DECISIONS DEPLOYMENT SHOPIFY_SETUP
         GST_PROVIDER TESTING MIGRATION PROGRESS(this file)
  tests/ unit integration e2e
  turbo.json, pnpm-workspace.yaml, tsconfig.base.json, eslint.config.mjs, CI
```

---

## 5. Development roadmap & where we are

| M           | Deliverable                                                                | State                                                   |
| ----------- | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| Phase 0     | Monorepo + docs                                                            | ✅ done                                                 |
| M1          | Shopify app foundation (auth, Polaris shell, metafield defs)               | 🟡 app scaffolded; wiring blocked on Dev Dashboard link |
| M2          | GST verification (validation, mock provider, service)                      | ✅ done                                                 |
| M3          | Customer GST profile (metafields, reuse)                                   | ⬜ pending (Shopify-coupled)                            |
| M4          | Storefront cart UI (Theme App Extension)                                   | ⬜ pending (Shopify-coupled)                            |
| **M5 core** | Tax + invoice engine (pure logic)                                          | ✅ done                                                 |
| M6          | PDF invoice template + Puppeteer + Shopify Files                           | ⬜ next candidate (HTML template is offline-testable)   |
| M7          | Webhooks + Cron reconciler + email + portal                                | ⬜ pending                                              |
| M8          | Credit notes + reports (sales register, tax summary, GSTR-1/3B) + CSV/XLSX | ⬜ candidate (pure logic, offline)                      |
| M9          | Tally export + admin dashboard + audit/verification logs                   | ⬜ pending                                              |
| M10         | Real GST provider adapter                                                  | ⬜ blocked on API credentials                           |
| M11         | Production: audit items, security review, migration + rollback             | ⬜ pending                                              |

**Working method:** incremental, one milestone at a time, each ending with tests + a committed/pushed checkpoint and a review pause.

---

## 6. What's pending / needed (blockers)

1. **Shopify Dev Dashboard link (interactive).** The app must be linked to the client's/dev org via `shopify app config link` (browser sign-in) — this can't be automated. Once linked, the M1 Shopify wiring proceeds (swap Prisma→no-DB sessions, expand scopes, create metafield definitions).
2. **GST verification API credentials** (URL, key, auth, request/response format). Only needed for M10; everything else runs on the mock.
3. **Verified email sending domain** (SPF/DKIM) for M7 — current sender is an unverified Gmail.
4. **A few product decisions:** invoice-series start number for the new `INV/2026-27/000001` series at cutover; where GST Pro currently stores HSN (migrate vs backfill); client turnover band (e-invoicing applicability); whether storefront prices are tax-inclusive.

**Not blocked (buildable offline now):** M6 PDF invoice template (pure HTML render is testable), M8 reports + credit notes (pure logic).

---

## 7. How to run / verify

```bash
corepack enable pnpm      # Node 22 ships corepack
pnpm install
pnpm typecheck            # tsc -b across project references
pnpm test                 # 65 vitest tests
pnpm lint
```

Shopify app (after linking, run by a human): `cd apps/shopify && pnpm shopify app config link && pnpm shopify app dev`.

---

## 8. One-line summary for a reader

A production Shopify GST app that replaces GST Pro: the framework-agnostic **engine** (GSTIN
verification + validation, decimal-safe tax classification, invoice math + safe numbering,
amount-in-words) is **built and fully unit-tested (65 tests)**; the **Shopify integration
layer** (cart UI, metafields, webhooks, cron-driven invoicing, PDF, email, portal) is
designed and scaffolded and resumes as soon as the app is linked to the Shopify Dev
Dashboard. The only true external dependency — a GST verification API — is mocked behind a
clean interface until credentials arrive.
