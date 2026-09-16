# Architecture

GST Engine is a Shopify **embedded app** plus a set of **framework-agnostic packages**.
Shopify is the database (see [DATABASE.md](DATABASE.md)); the only external dependency is a
pluggable GST verification API. Every architectural decision is recorded in
[DECISIONS.md](DECISIONS.md).

## Principles

1. **Separation of concerns.** GST verification (external, may fail) and invoicing (ours,
   must always work) are independent modules. A verification outage never blocks checkout.
2. **Framework-agnostic core.** All GST/tax/invoice/numbering/report logic lives in
   `packages/*` with **zero Shopify imports**. Only `apps/shopify` and `extensions/*` know
   about Shopify. This is what lets the real GST API drop in later, and what would let a
   future WooCommerce/Magento build reuse the engine.
3. **Everything pluggable.** GST provider, email, PDF renderer, storage, and invoice
   numbering are all interfaces with swappable implementations.
4. **Idempotent by construction.** Order metafields are the dedup markers; the invoice
   reconciler is safe to run repeatedly.

## System diagram

```
                       STOREFRONT (rinstruments.com — Shopify Basic)
   ┌──────────────────────────────────────────────────────────────┐
   │  extensions/theme-gst-ui  (Theme App Extension on Cart page)   │
   │   Need GST Invoice? → GSTIN → [Verify] → auto-filled fields    │
   └───────────────┬───────────────────────────────────────────────┘
                   │ POST /apps/gst/verify   (App Proxy, HMAC-signed)
                   ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                 apps/shopify  (Remix embedded app, Vercel)     │
   │  App Proxy · webhooks · Vercel Cron route · Polaris admin      │
   │        │              │                │                       │
   │        ▼              ▼                ▼                       │
   │   Verify service   Webhook intake   Cron reconciler           │
   │        │              │                │  (concurrency 1)      │
   │        └──────────────┴────────────────┘                       │
   │                        │  calls into                            │
   │  ┌─────────────────────▼──────────────────────────────────┐   │
   │  │  packages/*  (pure TS)                                   │   │
   │  │  core · gst · tax · invoice · pdf · email · reports ·    │   │
   │  │  exports · storage · shared                              │   │
   │  └─────────────────────────────────────────────────────────┘   │
   │        │                 │                │                     │
   │        ▼                 ▼                ▼                     │
   │  Provider iface     Shopify Admin     Shopify Files            │
   │  ├ MockGSTProvider  GraphQL API +     (PDFs + JSONL logs)      │
   │  └ GSTVerify(stub)  Metafields                                 │
   └────────┼──────────────────────────────────────────────────────┘
            ▼                            ▲                    ▲
   ┌────────────────┐          ┌─────────┴────────┐   ┌──────┴─────────┐
   │ GST Verify API │          │ Shopify Webhooks │   │ Email provider │
   │ (external,     │          │ (HMAC-verified)  │   │ (Resend/SES)   │
   │  pluggable)    │          └──────────────────┘   └────────────────┘
   └────────────────┘

   ADMIN:    apps/shopify — embedded Remix + Polaris + App Bridge
   PORTAL:   extensions/customer-account-ui (availability verified before M8; L6)
```

## Packages and responsibilities

| Package               | Responsibility                                                                                             | Shopify-coupled? |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------- |
| `@gst-engine/shared`  | types, errors, logging, env parsing                                                                        | No               |
| `@gst-engine/core`    | domain models, `Money` (paise, decimal-safe), state-code table, validation, shared interfaces              | No               |
| `@gst-engine/gst`     | `GSTVerificationProvider` interface, response normalization, `MockGSTProvider`, `GSTVerifyProvider` (stub) | No               |
| `@gst-engine/tax`     | place-of-supply → CGST/SGST/IGST, rounding                                                                 | No               |
| `@gst-engine/invoice` | invoice model + math, `InvoiceNumberProvider` interface (+ metafield impl)                                 | No               |
| `@gst-engine/pdf`     | HTML templates + `PdfRenderer` interface (Puppeteer impl)                                                  | No               |
| `@gst-engine/email`   | `EmailProvider` interface (console/Resend/SES)                                                             | No               |
| `@gst-engine/reports` | sales register, tax summary, GSTR-1/3B datasets                                                            | No               |
| `@gst-engine/exports` | CSV/XLSX + Tally mapping                                                                                   | No               |
| `@gst-engine/storage` | `Storage` interface → Shopify Files implementation                                                         | No               |
| `apps/shopify`        | Remix app: auth, App Proxy, webhooks, cron, admin, Shopify adapter                                         | **Yes**          |
| `extensions/*`        | theme cart UI, customer-account portal, admin blocks                                                       | **Yes**          |

## Core data flow — verify → invoice

1. Buyer toggles **Need GST Invoice?** on the cart page and enters a GSTIN.
2. Theme extension does client-side format + checksum validation, then calls
   `/apps/gst/verify` (App Proxy, HMAC-verified).
3. Verify service runs server-side format validation → calls the selected
   `GSTVerificationProvider` → normalizes the response → returns
   `{ legalName, registeredAddress, city, state, stateCode, status }`.
4. Fields auto-fill; buyer confirms. Verified data is written as **cart attributes** and,
   for logged-in customers, saved to `gst.*` customer metafields (with consent).
5. Order is placed. Webhook marks it as work; the **Cron reconciler** (concurrency 1)
   picks up orders lacking `invoice.number`.
6. Reconciler: resolve seller GSTIN → build immutable `gst.snapshot` → resolve HSN/rate
   from product metafields → take tax amounts from the order `tax_lines`, classify
   CGST/SGST vs IGST → allocate invoice number → write `invoice.*` metafields → render
   PDF → upload to Shopify Files → send email → mark status.
7. Customer later downloads the invoice from the portal / email link.

**If verification fails at step 3:** the UI shows a clear message and the buyer can still
check out normally. The invoice is generated from order data regardless.

## The five Shopify edges (and how they are handled)

See [DECISIONS.md](DECISIONS.md) L1–L6. Summary: atomic numbering → single-writer cron
(D3/D4); public PDF URLs → storage interface + gated listing (D6); offline token → Vercel
secret (D7); non-queryable metafields → Bulk Operations for reports (L4); logs → JSONL in
Files (L5); customer-account extension availability → verify + App-Proxy fallback (L6).

## Development milestones

| M                       | Deliverable                                                                      | Prerequisite                 |
| ----------------------- | -------------------------------------------------------------------------------- | ---------------------------- |
| **M1** Foundation       | monorepo, Remix app, token-exchange auth, Polaris shell, docs, CI/tests          | dev store                    |
| **M2** GST module       | GSTIN validation, provider interface, MockGSTProvider, verify service, App Proxy | plan tier (done: Basic)      |
| **M3** Customer profile | `gst.*` metafields, consent, returning-customer reuse                            | —                            |
| **M4** Storefront UI    | cart Theme App Extension, states, auto-fill, guest + logged-in                   | —                            |
| **M5** Invoice engine   | tax engine, numbering interface + impl, invoice metafields                       | HSN source + numbering start |
| **M6** PDF              | templates + Puppeteer, Files upload, URL on order                                | logo asset                   |
| **M7** Automation       | webhooks + Cron reconciler, EmailProvider, portal                                | verified email domain        |
| **M8** Credits/reports  | credit notes, sales register, tax summary, GSTR-1/3B, CSV/XLSX                   | customer-account ext (L6)    |
| **M9** Tally/admin      | Tally CSV, bulk ops, dashboard, verification/audit logs                          | Tally field spec             |
| **M10** GST API         | real GSTVerifyProvider, sandbox + edge tests                                     | **GST API docs**             |
| **M11** Production      | 4 audit items, security/perf review, E2E, migration + rollback                   | go-live window               |

## Open blockers

- **M10 (external):** GST verification API credentials/docs. Everything else runs on mock.
- **M7:** verified email sending domain (current sender is unverified Gmail — D8).
- **M5:** where GST Pro currently stores HSN (migrate vs backfill — see MIGRATION.md); the
  new invoice series start number; whether storefront prices are tax-inclusive.
- **Deploy checkpoints (M11, non-blocking now):** Taxes & Duties, Seller GST Registration,
  User Permissions, Existing Metafields.
