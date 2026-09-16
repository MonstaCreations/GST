# Data model — Shopify as the database

There is no external database in Phase 1 (see [DECISIONS.md](DECISIONS.md) D1). Every
record lives in a Shopify primitive. This document is the schema.

## Metafield namespaces & keys

All definitions are created and **pinned** at install so they appear in the Shopify admin
and have stable types. Types are chosen deliberately — a wrong type breaks reads.

### Customer metafields — namespace `gst`

| Key                   | Type                     | Notes                                                |
| --------------------- | ------------------------ | ---------------------------------------------------- |
| `gstin`               | `single_line_text_field` | 15-char GSTIN                                        |
| `legal_name`          | `single_line_text_field` | from verification                                    |
| `trade_name`          | `single_line_text_field` | optional                                             |
| `registered_address`  | `multi_line_text_field`  |                                                      |
| `city`                | `single_line_text_field` |                                                      |
| `state`               | `single_line_text_field` |                                                      |
| `state_code`          | `single_line_text_field` | 2-digit; matches GSTIN prefix                        |
| `pincode`             | `single_line_text_field` |                                                      |
| `verification_status` | `single_line_text_field` | `ACTIVE` \| `INACTIVE` \| `CANCELLED` \| `NOT_FOUND` |
| `verified_at`         | `date_time`              |                                                      |

### Product metafields — namespace `tax`

| Key        | Type                     | Notes                 |
| ---------- | ------------------------ | --------------------- |
| `hsn_code` | `single_line_text_field` | HSN/SAC               |
| `gst_rate` | `number_decimal`         | percentage, e.g. `18` |

> HSN/GST rate already appear on today's GST Pro invoices. Before M5 we audit **where**
> GST Pro stores them; if in readable metafields we migrate, otherwise we backfill these.
> See [MIGRATION.md](MIGRATION.md).

### Order metafields — namespaces `invoice`, `gst`, `credit_note`

| Key                     | Type                     | Notes                                                                     |
| ----------------------- | ------------------------ | ------------------------------------------------------------------------- |
| `invoice.number`        | `single_line_text_field` | e.g. `INV/2026-27/000001`. Presence ⇒ invoice exists (idempotency marker) |
| `invoice.date`          | `date_time`              |                                                                           |
| `invoice.url`           | `url`                    | Shopify Files URL of the PDF                                              |
| `invoice.status`        | `single_line_text_field` | `pending` \| `issued` \| `emailed` \| `failed`                            |
| `gst.snapshot`          | `json`                   | **immutable** buyer + seller + line snapshot at issue time                |
| `credit_note.reference` | `json`                   | credit note number(s) + link(s)                                           |

### App-installation metafields — namespace `settings`

Seller configuration, owned by the app. Includes: `legal_name`, `gstin`, `state` (`27`),
`state_code`, `address`, `logo_url`, `invoice_prefix`, `financial_year`,
`next_invoice_seq` (the numbering counter — D4), `gst_provider`, `tax_config` (`json`).

> **Namespace note:** app-owned metafields will use the app-reserved namespace mechanism
> where appropriate for access control; this is validated against the current Admin API
> version during M1 before definitions are created. The logical keys above are stable.

## Files

- **Invoice / credit-note PDFs** → Shopify Files. URL stored in `invoice.url`. Public-URL
  caveat: see D6.
- **Audit & verification logs** → append-only JSONL in Shopify Files, rotated (L5). A small
  "recent N" summary is kept in an app metafield for the dashboard.

## Immutability

`gst.snapshot`, `invoice.*`, and issued PDFs are **write-once**. Corrections are made by
issuing a credit note, never by editing an issued invoice. This is enforced in the service
layer (Shopify does not enforce it) and backed by the audit log.

## Reading & reporting (the query story)

Metafields are not queryable (L4). Reports and the admin dashboard read orders in bulk via
the **Shopify Bulk Operations API** (`bulkOperationRunQuery` → JSONL export), then compute
aggregates in `packages/reports`. This is asynchronous and rate-limited but adequate for a
single store's volume. Dashboard "today/this month" widgets use narrower date-filtered
order queries.

## Idempotency keys (no DB constraints available)

| Concern                                  | Marker                                                |
| ---------------------------------------- | ----------------------------------------------------- |
| Invoice already generated                | order `invoice.number` present                        |
| Email already sent                       | order `invoice.status = emailed` (or `email_sent_at`) |
| Credit note already created for a refund | `credit_note.reference` contains the refund id        |

Because the reconciler runs single-concurrency (D3), read-then-write races on these markers
do not occur in practice.
