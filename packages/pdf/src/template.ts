/**
 * HTML invoice template — used for email bodies and on-screen preview. (The PDF is
 * produced by PdfLibRenderer, which does not depend on HTML/Chromium.)
 */
import { paiseToRupees, type Paise } from '@gst-engine/core';
import type { Invoice } from '@gst-engine/invoice';
import type { RenderOptions } from './types';

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const inr = (p: Paise): string => `₹${paiseToRupees(p)}`;

export function renderInvoiceHtml(invoice: Invoice, options: RenderOptions = {}): string {
  const s = invoice.seller;
  const b = invoice.buyer;
  const rows = invoice.items
    .map(
      (it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(it.name)}<br><span class="muted">${esc(it.sku)}</span></td>
        <td>${esc(it.hsnCode)}</td>
        <td class="r">${it.quantity}</td>
        <td class="r">${inr(it.unitPrice)}</td>
        <td class="r">${inr(it.tax.taxable)}</td>
        <td class="r">${it.gstRatePercent}%</td>
        <td class="r">${inr(it.tax.cgst)}</td>
        <td class="r">${inr(it.tax.sgst)}</td>
        <td class="r">${inr(it.tax.igst)}</td>
        <td class="r">${inr(it.lineTotal)}</td>
      </tr>`,
    )
    .join('');

  const bank = options.bank;
  const bankBlock = bank
    ? `<div class="bank"><strong>Bank details</strong><br>
        ${esc(bank.name ?? '')} ${bank.account ? '· A/C ' + esc(bank.account) : ''}
        ${bank.ifsc ? '· IFSC ' + esc(bank.ifsc) : ''} ${bank.branch ? '· ' + esc(bank.branch) : ''}</div>`
    : '';

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#1a1f2b;font-size:12px;margin:0;padding:24px}
    h1{font-size:18px;margin:0}
    .muted{color:#6b7280;font-size:10px}
    .top{display:flex;justify-content:space-between;gap:24px}
    .copy{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th,td{border:1px solid #d7dbe0;padding:6px 8px;text-align:left;vertical-align:top}
    th{background:#f3f4f6;font-size:10px;text-transform:uppercase;letter-spacing:.03em}
    .r{text-align:right}
    .totals{margin-top:12px;width:280px;margin-left:auto}
    .totals td{border:none;padding:3px 8px}
    .grand{font-weight:700;border-top:1px solid #1a1f2b !important}
    .words{margin-top:10px;font-style:italic}
    .bank{margin-top:14px;font-size:11px}
    .foot{margin-top:18px;font-size:10px;color:#6b7280}
  </style></head><body>
    <div class="top">
      <div>
        <h1>${esc(s.legalName)}</h1>
        <div>${esc(s.address.line)}, ${esc(s.address.city)}</div>
        <div>${esc(s.address.state)} (${esc(s.address.stateCode)})${s.address.pincode ? ' - ' + esc(s.address.pincode) : ''}</div>
        <div><strong>GSTIN:</strong> ${esc(s.gstin)}</div>
        ${options.sellerContact ? `<div>${esc(options.sellerContact)}</div>` : ''}
      </div>
      <div style="text-align:right">
        <div style="font-size:15px;font-weight:700">TAX INVOICE</div>
        <div class="copy">${esc(options.copyLabel ?? 'Original for Recipient')}</div>
        <div style="margin-top:8px"><strong>Invoice:</strong> ${esc(invoice.number)}</div>
        <div><strong>Date:</strong> ${esc(invoice.date.slice(0, 10))}</div>
        <div><strong>Order:</strong> ${esc(invoice.orderId)}</div>
        <div><strong>Place of Supply:</strong> ${esc(invoice.placeOfSupplyStateCode)}</div>
      </div>
    </div>

    <div style="margin-top:14px;border:1px solid #d7dbe0;padding:10px">
      <strong>Bill To</strong><br>
      ${esc(b.legalName)}${b.tradeName ? ' (' + esc(b.tradeName) + ')' : ''}<br>
      ${esc(b.address.line)}, ${esc(b.address.city)}, ${esc(b.address.state)} (${esc(b.address.stateCode)})<br>
      <strong>GSTIN:</strong> ${esc(b.gstin)}
    </div>

    <table>
      <thead><tr>
        <th>#</th><th>Description</th><th>HSN</th><th class="r">Qty</th><th class="r">Rate</th>
        <th class="r">Taxable</th><th class="r">GST%</th><th class="r">CGST</th><th class="r">SGST</th>
        <th class="r">IGST</th><th class="r">Total</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <table class="totals">
      <tr><td>Taxable</td><td class="r">${inr(invoice.taxableTotal)}</td></tr>
      <tr><td>CGST</td><td class="r">${inr(invoice.cgstTotal)}</td></tr>
      <tr><td>SGST</td><td class="r">${inr(invoice.sgstTotal)}</td></tr>
      <tr><td>IGST</td><td class="r">${inr(invoice.igstTotal)}</td></tr>
      <tr class="grand"><td>Grand Total</td><td class="r">${inr(invoice.grandTotal)}</td></tr>
    </table>

    <div class="words">${esc(invoice.amountInWords)}</div>
    ${bankBlock}
    <div class="foot">
      This is a computer-generated tax invoice.
      ${options.qrPayload ? '<br>[e-invoice QR reserved]' : ''}
    </div>
  </body></html>`;
}
