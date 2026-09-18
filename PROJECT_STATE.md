# PROJECT_STATE

Living status for GST Engine. Updated at each milestone. See `docs/` for detail.

**Last updated:** 2026-09-18 · **Current phase:** M1 — Shopify Integration Wiring (complete)

---

## Current phase

**M1 wiring — DONE and verified.** Next: M2/M3 (customer GST profile persistence) or M6 (PDF), both buildable on the current dev store + mock provider.

## Verification (this milestone)

- `tsc -b` (packages) — ✅
- App `react-router typegen && tsc --noEmit` — ✅
- App `react-router build` (client + SSR, bundles `@gst-engine/gst`) — ✅
- Vitest — ✅ **69 tests** (65 engine + 4 metafield-definition specs)

## Completed features (BUILT + TESTED)

- **Engine packages** (unchanged, reused): core, shared, gst, tax, invoice — 65 tests.
- **M1 Shopify wiring:**
  - API version reconciled to `2026-07` in both `shopify.app.toml` and `shopify.server.ts`.
  - Admin API **scopes** set: `read/write` customers, orders, products, files.
  - **Metafield definitions** (18) as pure data + idempotent `ensureMetafieldDefinitions()` wired into `afterAuth` (customer `gst.*`, product `tax.*`, order `invoice.*`/`gst.snapshot`/`credit_note.reference`). Spec tested.
  - **App Proxy verify route** `proxy.verify.tsx` (`/apps/gst/verify`) → `getVerificationService()` → `@gst-engine/gst` (MockGSTProvider); signature-verified, rate-limited, safe errors, never blocks checkout.
  - **Theme App Extension** `extensions/theme-gst-ui/` — cart-page GST block (toggle → GSTIN → Verify → states → auto-fill → "Use Verified Details" writes cart attributes). Functional liquid + JS + CSS.
  - **Webhook handlers** registered + scaffolded: `orders/create`, `orders/paid`, `orders/updated`, `refunds/create`, `customers/update` (+ existing `app/uninstalled`, `app/scopes_update`).
  - Prisma session storage **preserved** (auth intact).

## Pending features (designed, not yet built)

- M3 customer GST profile read/write to metafields + guest cart-attribute path + returning-customer reuse.
- M5 wiring: real Shopify orders → invoice records (order metafields), production `InvoiceNumberProvider` (app-installation counter).
- M6 PDF template + Puppeteer renderer + Shopify Files upload.
- M7 invoice automation (reconciler) + email provider + customer portal.
- M8 credit notes + reports; M9 Tally + admin dashboard + verification logs; M10 real GST provider; M11 deploy + migration.

## Blocked features

- **Real GST provider (M10):** awaiting API credentials. (Mock in use — not blocking.)
- **Production email (M7):** needs a verified sending domain.
- **Deploy (M11):** session storage must move off SQLite/Prisma for serverless (see Known issues); Vercel adapter + `vercel.json` not yet added.

## Known issues

1. **Session storage vs serverless + expiring tokens.** `future.expiringOfflineAccessTokens: true` + SQLite Prisma store won't work on Vercel; a durable session store (Turso/Neon/KV) must be chosen before deploy (session infra only — business data stays in Shopify). See DECISIONS D7/D11 + PART 6 of the audit.
2. **App `lint` script broken** (template uses ESLint-8 `--ignore-path` while ESLint-9 flat config is resolved from repo root). App code still type-checks + builds; fix is a tooling reconciliation (own flat config for the app). Root/packages lint is clean.
3. **App Proxy URL** in toml uses the placeholder host; `shopify app dev` updates it to the tunnel. Verify the `/apps/gst/verify` → `/proxy/verify` mapping live.
4. **Distribution = AppStore** in code (see D13) — must be confirmed/changed for a custom single-merchant app before production.

## Required merchant inputs (not blocking current build)

- App **distribution** decision (custom vs App Store).
- Session-storage choice for production.
- Seller GST identity + **bank details** for invoices.
- Invoice numbering **start number** at cutover.
- GST API provider + credentials.
- Tax-inclusive vs exclusive pricing; current HSN source on products.
- Email provider + verified domain; invoice logo asset.
- Customer accounts type (new vs classic) for the portal extension.

## Next action

Proceed to **M3 (customer GST profile persistence)** and **M5 wiring (orders → invoice records)** on the dev store with the mock provider; then M6 PDF. Continue committing per milestone.
