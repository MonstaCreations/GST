import type { Invoice } from '@gst-engine/invoice';

export interface InvoiceBankDetails {
  name?: string;
  account?: string;
  ifsc?: string;
  branch?: string;
}

export interface RenderOptions {
  /** absolute or data URL of the seller logo (reserved; not embedded yet) */
  logoUrl?: string;
  /** reserved payload for a future e-invoice IRN/QR (DECISIONS.md D9) */
  qrPayload?: string;
  /** bank details printed on the invoice footer when configured */
  bank?: InvoiceBankDetails;
  /** e.g. "ORIGINAL FOR RECIPIENT" / "DUPLICATE FOR TRANSPORTER" */
  copyLabel?: string;
  /** seller phone/email line */
  sellerContact?: string;
}

export interface PdfRenderer {
  readonly name: string;
  /** Render an invoice to a PDF byte buffer (serverless-safe). */
  renderInvoice(invoice: Invoice, options?: RenderOptions): Promise<Uint8Array>;
}
