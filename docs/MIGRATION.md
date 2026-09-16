# Migration from GST Pro

Goal: fully replace GST Pro with zero data loss and no invoice-numbering conflicts. GST Pro
stays installed and untouched until cutover is validated.

## Current-state facts

- GST Pro is installed and generating invoices today.
- **Invoice numbering currently mirrors Shopify order numbers.**
- Invoices already show **HSN, GST rate, and tax calculations** — so that data exists
  somewhere (product metafields owned by GST Pro, or internal to GST Pro).

## Step 1 — Audit (before M5)

Inspect the store's existing metafields (one of the four audit items):

- Where does GST Pro store **HSN / GST rate**? If in readable product metafields → migrate
  into `tax.hsn_code` / `tax.gst_rate`. If internal to GST Pro → backfill our product
  metafields (CSV import or admin tooling).
- Where does GST Pro store **customer GST details**? Migrate into `gst.*` customer
  metafields where present.

## Step 2 — Numbering cutover decision

GST Pro uses order-number-mirrored invoice numbers. We move to an independent FY series
`INV/2026-27/000001`. GST permits starting a new consecutive series.

- **Recommended:** start the new series at `000001` on cutover date.
- Historical GST Pro invoices keep their old numbers — no clash because the format/prefix
  differ. Record the chosen start in [DECISIONS.md](DECISIONS.md).

## Step 3 — Shadow run (parallel)

Run GST Engine alongside GST Pro. New orders generate **our** invoices while GST Pro still
runs. Reconcile on a sample of orders:

- totals and tax split (CGST/SGST vs IGST) match what Shopify charged (D5);
- invoice numbering is unique and consecutive;
- email delivery works (verified domain — D8);
- customer downloads work;
- reports (sales register, tax summary, GSTR-1/3B) tie out.

## Step 4 — Validate historical access

Confirm the client's retention needs for historical GST Pro invoices are met (export/
archive if required) before removing GST Pro.

## Step 5 — Cutover

After sign-off: make GST Engine the source of record, stop GST Pro's generation, and
uninstall GST Pro.

## Rollback

Re-enable GST Pro and disable our reconciler. All data remains in Shopify, so no records are
lost. See [DEPLOYMENT.md](DEPLOYMENT.md).
