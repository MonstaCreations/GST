# Deployment

Target: **Vercel** (locked). The app is the Remix project in `apps/shopify`; the
`packages/*` are workspace dependencies bundled at build time.

## Environments

| Env        | Purpose                                                                          |
| ---------- | -------------------------------------------------------------------------------- |
| Local      | Shopify CLI tunnel to a dev store; `GST_PROVIDER=mock`, `EMAIL_PROVIDER=console` |
| Preview    | Vercel preview deploys per PR                                                    |
| Production | Client store; verified email domain; real GST provider (post-M10)                |

## Secrets (Vercel project → Environment Variables)

All server-side only. See `.env.example` for the full list. Critical ones:

- `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SCOPES`
- `SHOPIFY_OFFLINE_ACCESS_TOKEN` — the single store's offline token (D7)
- `GST_PROVIDER`, `GST_API_URL`, `GST_API_KEY` — GST provider (mock until M10)
- `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY` — email (D8)
- `CRON_SECRET` — protects the cron route

**Never** put any of these in client/theme/extension code.

## Invoice reconciler (Vercel Cron — D3)

A single-concurrency cron drives invoice generation (not the webhook). Example
`vercel.json` (added in M7):

```json
{
  "crons": [{ "path": "/api/cron/reconcile-invoices", "schedule": "*/2 * * * *" }]
}
```

- The route checks `CRON_SECRET`, then scans recent orders lacking `invoice.number`.
- Frequent schedules require **Vercel Pro**. Confirm the deployment tier.
- The route guards against overlapping runs with a best-effort app-metafield lock.

## PDF rendering on Vercel

Puppeteer runs via `@sparticuz/chromium`. Watch function size + duration limits; the
renderer is behind `PdfRenderer` (D6-adjacent) so it can move to a dedicated render
function if limits bite.

## Go-live checkpoints (M11)

1. Taxes & Duties verified (D5). 2. Seller GST registration populated. 3. User permissions/
   scopes confirmed. 4. Existing metafields audited. 5. Verified email domain (D8). 6. Real
   GST provider tested (M10). 7. GST Pro migration validated ([MIGRATION.md](MIGRATION.md)).
2. Rollback plan confirmed.

## Rollback

Because GST Pro runs in parallel until cutover, rollback = re-enable GST Pro as the invoice
source of record and disable our reconciler. No customer data is destroyed (all in Shopify).
