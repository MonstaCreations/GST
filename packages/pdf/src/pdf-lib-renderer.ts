/**
 * PdfLibRenderer — serverless-safe PDF generation via pdf-lib (no Chromium/Puppeteer).
 * Draws a professional Indian GST tax invoice. Uses StandardFonts (WinAnsi), so all
 * text is ASCII/Latin-1 — amounts use "Rs." (the ₹ glyph is not in the standard font).
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { paiseToRupees, type Paise } from '@gst-engine/core';
import type { Invoice } from '@gst-engine/invoice';
import type { PdfRenderer, RenderOptions } from './types';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 40;
const RIGHT = PAGE_W - M;
const INK = rgb(0.1, 0.12, 0.17);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.84, 0.86, 0.88);

const money = (p: Paise): string => paiseToRupees(p);

interface Col {
  key: string;
  label: string;
  x: number;
  w: number;
  right?: boolean;
}
const COLS: Col[] = [
  { key: 'sr', label: '#', x: 40, w: 18 },
  { key: 'desc', label: 'Description', x: 58, w: 132 },
  { key: 'hsn', label: 'HSN', x: 190, w: 40 },
  { key: 'qty', label: 'Qty', x: 230, w: 26, right: true },
  { key: 'rate', label: 'Rate', x: 256, w: 50, right: true },
  { key: 'taxable', label: 'Taxable', x: 306, w: 56, right: true },
  { key: 'gst', label: 'GST%', x: 362, w: 28, right: true },
  { key: 'cgst', label: 'CGST', x: 390, w: 44, right: true },
  { key: 'sgst', label: 'SGST', x: 434, w: 44, right: true },
  { key: 'igst', label: 'IGST', x: 478, w: 40, right: true },
  { key: 'total', label: 'Total', x: 518, w: 37, right: true },
];

export class PdfLibRenderer implements PdfRenderer {
  readonly name = 'pdf-lib';

  async renderInvoice(invoice: Invoice, options: RenderOptions = {}): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.setTitle(`Invoice ${invoice.number}`);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    let page = doc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - M;

    const text = (
      x: number,
      yy: number,
      str: string,
      opts: { size?: number; bold?: boolean; color?: typeof INK } = {},
    ): void => {
      page.drawText(str, {
        x,
        y: yy,
        size: opts.size ?? 9,
        font: opts.bold ? bold : font,
        color: opts.color ?? INK,
      });
    };
    const textRight = (
      xRight: number,
      yy: number,
      str: string,
      opts: { size?: number; bold?: boolean; color?: typeof INK } = {},
    ): void => {
      const size = opts.size ?? 9;
      const f = opts.bold ? bold : font;
      text(xRight - f.widthOfTextAtSize(str, size), yy, str, opts);
    };
    const hr = (yy: number): void => {
      page.drawLine({
        start: { x: M, y: yy },
        end: { x: RIGHT, y: yy },
        thickness: 0.5,
        color: LINE,
      });
    };
    const truncate = (str: string, f: PDFFont, size: number, maxW: number): string => {
      if (f.widthOfTextAtSize(str, size) <= maxW) return str;
      let s = str;
      while (s.length > 1 && f.widthOfTextAtSize(s + '...', size) > maxW) s = s.slice(0, -1);
      return s + '...';
    };

    // ---- Header: seller (left) + invoice meta (right) ----
    const s = invoice.seller;
    text(M, y, s.legalName, { size: 14, bold: true });
    textRight(RIGHT, y, 'TAX INVOICE', { size: 13, bold: true });
    y -= 14;
    textRight(RIGHT, y, (options.copyLabel ?? 'Original for Recipient').toUpperCase(), {
      size: 7,
      color: MUTED,
    });
    text(M, y, `${s.address.line}, ${s.address.city}`, { size: 9 });
    y -= 12;
    text(
      M,
      y,
      `${s.address.state} (${s.address.stateCode})${s.address.pincode ? ' - ' + s.address.pincode : ''}`,
      { size: 9 },
    );
    textRight(RIGHT, y, `Invoice: ${invoice.number}`, { size: 9, bold: true });
    y -= 12;
    text(M, y, `GSTIN: ${s.gstin}`, { size: 9, bold: true });
    textRight(RIGHT, y, `Date: ${invoice.date.slice(0, 10)}`, { size: 9 });
    y -= 12;
    if (options.sellerContact) text(M, y, options.sellerContact, { size: 9, color: MUTED });
    textRight(RIGHT, y, `Order: ${invoice.orderId}`, { size: 9 });
    y -= 12;
    textRight(RIGHT, y, `Place of Supply: ${invoice.placeOfSupplyStateCode}`, { size: 9 });
    y -= 10;
    hr(y);
    y -= 16;

    // ---- Bill To ----
    const b = invoice.buyer;
    text(M, y, 'BILL TO', { size: 8, bold: true, color: MUTED });
    y -= 13;
    text(M, y, `${b.legalName}${b.tradeName ? ' (' + b.tradeName + ')' : ''}`, {
      size: 10,
      bold: true,
    });
    y -= 12;
    text(
      M,
      y,
      truncate(
        `${b.address.line}, ${b.address.city}, ${b.address.state} (${b.address.stateCode})`,
        font,
        9,
        RIGHT - M,
      ),
      { size: 9 },
    );
    y -= 12;
    text(M, y, `GSTIN: ${b.gstin}`, { size: 9, bold: true });
    y -= 16;

    // ---- Items table ----
    const drawHeader = (): void => {
      page.drawRectangle({
        x: M,
        y: y - 3,
        width: RIGHT - M,
        height: 15,
        color: rgb(0.95, 0.96, 0.97),
      });
      for (const c of COLS) {
        if (c.right) textRight(c.x + c.w, y, c.label, { size: 7, bold: true, color: MUTED });
        else text(c.x, y, c.label, { size: 7, bold: true, color: MUTED });
      }
      y -= 16;
    };
    drawHeader();

    for (let i = 0; i < invoice.items.length; i++) {
      const it = invoice.items[i]!;
      if (y < M + 120) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - M;
        drawHeader();
      }
      const cell: Record<string, string> = {
        sr: String(i + 1),
        desc: truncate(it.name, font, 7, COLS[1]!.w - 2),
        hsn: it.hsnCode,
        qty: String(it.quantity),
        rate: money(it.unitPrice),
        taxable: money(it.tax.taxable),
        gst: `${it.gstRatePercent}%`,
        cgst: money(it.tax.cgst),
        sgst: money(it.tax.sgst),
        igst: money(it.tax.igst),
        total: money(it.lineTotal),
      };
      for (const c of COLS) {
        const v = cell[c.key] ?? '';
        if (c.right) textRight(c.x + c.w, y, v, { size: 7 });
        else text(c.x, y, v, { size: 7 });
      }
      y -= 13;
    }
    y -= 4;
    hr(y);
    y -= 16;

    // ---- Totals (right block) ----
    const totalRow = (label: string, value: string, strong = false): void => {
      text(RIGHT - 200, y, label, { size: 9, bold: strong });
      textRight(RIGHT, y, value, { size: 9, bold: strong });
      y -= 13;
    };
    totalRow('Taxable', `Rs. ${money(invoice.taxableTotal)}`);
    totalRow('CGST', `Rs. ${money(invoice.cgstTotal)}`);
    totalRow('SGST', `Rs. ${money(invoice.sgstTotal)}`);
    totalRow('IGST', `Rs. ${money(invoice.igstTotal)}`);
    y -= 2;
    hr(y + 8);
    totalRow('Grand Total', `Rs. ${money(invoice.grandTotal)}`, true);
    y -= 6;

    // ---- Amount in words ----
    text(M, y, invoice.amountInWords, { size: 9, color: INK });
    y -= 20;

    // ---- Bank details ----
    if (options.bank) {
      const bk = options.bank;
      text(M, y, 'Bank details', { size: 9, bold: true });
      y -= 12;
      const parts = [
        bk.name,
        bk.account ? `A/C ${bk.account}` : '',
        bk.ifsc ? `IFSC ${bk.ifsc}` : '',
        bk.branch,
      ].filter(Boolean);
      text(M, y, parts.join('  ·  '), { size: 9, color: MUTED });
      y -= 18;
    }

    // ---- Footer ----
    text(M, M, 'This is a computer-generated tax invoice.', { size: 8, color: MUTED });
    if (options.qrPayload)
      textRight(RIGHT, M, '[e-invoice QR reserved]', { size: 8, color: MUTED });

    return doc.save();
  }
}
