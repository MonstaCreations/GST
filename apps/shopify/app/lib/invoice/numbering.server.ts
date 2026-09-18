/**
 * Production InvoiceNumberProvider backed by the app-installation settings counter
 * (`settings.next_invoice_seq`). Implements the @gst-engine/invoice interface so the
 * engine is unaware of the storage mechanism.
 *
 * CONCURRENCY (DECISIONS.md D4): read-modify-write on a metafield is NOT atomic.
 * Order-level idempotency (skip if the order already has invoice.number) prevents
 * duplicate invoices per order, but two DIFFERENT orders generated at the same instant
 * could read the same sequence. Therefore invoice generation MUST run through a single
 * writer (the webhook/admin action processed one order at a time, or a serialized cron).
 * This provider is behind an interface so it can later be backed by an atomic store.
 */
import type { InvoiceNumberProvider } from '@gst-engine/invoice';
import type { AdminGraphql } from '../shopify/graphql';
import { readSettings, writeSettings } from '../settings.server';

export function createMetafieldInvoiceNumberProvider(
  admin: AdminGraphql,
  pad = 6,
): InvoiceNumberProvider {
  return {
    async next(financialYear: string): Promise<string> {
      const settings = await readSettings(admin);
      const seq = settings.nextInvoiceSeq;
      const prefix = settings.invoicePrefix || 'INV';
      // Persist the next value before returning so a retry does not reuse this number.
      await writeSettings(admin, { nextInvoiceSeq: seq + 1 });
      return `${prefix}/${financialYear}/${String(seq).padStart(pad, '0')}`;
    },
  };
}
