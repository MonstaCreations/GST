/**
 * @gst-engine/pdf — invoice HTML template + PDF rendering behind an interface.
 * Phase 0: contract + stub. HTML template + Puppeteer impl in M6.
 * The renderer is swappable (DECISIONS.md D6-adjacent) if Vercel limits bite.
 */
import type { Invoice } from '@gst-engine/invoice';

export interface RenderOptions {
  /** absolute or data URL of the seller logo */
  logoUrl?: string;
  /** reserved space for a future e-invoice IRN/QR (DECISIONS.md D9) */
  qrPayload?: string;
}

export interface PdfRenderer {
  readonly name: string;
  /** Render an invoice to a PDF byte buffer. */
  renderInvoice(invoice: Invoice, options?: RenderOptions): Promise<Uint8Array>;
}

/** TODO(M6): render the invoice HTML template to a string. */
export declare function renderInvoiceHtml(invoice: Invoice, options?: RenderOptions): string;

/** HTML + Puppeteer (@sparticuz/chromium on Vercel). TODO(M6): implement. */
export class PuppeteerPdfRenderer implements PdfRenderer {
  readonly name = 'puppeteer';
  renderInvoice(_invoice: Invoice, _options?: RenderOptions): Promise<Uint8Array> {
    throw new Error('PuppeteerPdfRenderer.renderInvoice not implemented — M6');
  }
}
