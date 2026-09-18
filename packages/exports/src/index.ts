/**
 * @gst-engine/exports — CSV / Tally exporters (pure; no I/O).
 * CSV is the development baseline. XLSX and Tally XML seams are kept but not built
 * (avoid heavy/serverless-unfriendly deps until a real requirement exists).
 */
import type { ReportTable } from '@gst-engine/reports';

export interface ExportedFile {
  filename: string;
  content: Uint8Array;
  contentType: string;
}

export interface Exporter {
  readonly format: 'csv' | 'xlsx' | 'tally-csv' | 'tally-xml';
  export(table: ReportTable): ExportedFile;
}

/** RFC-4180 cell escaping. */
function csvCell(value: string | number): string {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize a ReportTable to RFC-4180 CSV text. */
export function tableToCsv(table: ReportTable): string {
  const lines = [table.columns, ...table.rows].map((row) => row.map(csvCell).join(','));
  return lines.join('\r\n') + '\r\n';
}

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function toCsv(table: ReportTable, filename: string): ExportedFile {
  return {
    filename: filename.endsWith('.csv') ? filename : `${filename}.csv`,
    content: encode(tableToCsv(table)),
    contentType: 'text/csv;charset=utf-8',
  };
}

/**
 * Tally-compatible CSV. Tally imports vary by merchant/ledger setup, so the column
 * mapping is configurable rather than hard-coded. Default is a pass-through of the
 * report columns; supply a mapping to rename/reorder to the accountant's template.
 */
export interface TallyColumnMap {
  /** source column name in the ReportTable */
  source: string;
  /** target column header expected by the Tally import */
  target: string;
}

export function toTallyCsv(
  table: ReportTable,
  filename: string,
  mapping?: TallyColumnMap[],
): ExportedFile {
  let out: ReportTable = table;
  if (mapping && mapping.length > 0) {
    const indexOf = new Map(table.columns.map((c, i) => [c, i]));
    const cols = mapping.map((m) => m.target);
    const rows = table.rows.map((row) =>
      mapping.map((m) => {
        const i = indexOf.get(m.source);
        return i === undefined ? '' : (row[i] ?? '');
      }),
    );
    out = { columns: cols, rows };
  }
  return {
    filename: filename.endsWith('.csv') ? filename : `${filename}.csv`,
    content: encode(tableToCsv(out)),
    contentType: 'text/csv;charset=utf-8',
  };
}

/** XLSX seam kept; not implemented (CSV is the baseline). */
export function toXlsx(_table: ReportTable, _filename: string): ExportedFile {
  throw new Error('XLSX export not implemented yet — use toCsv (CSV is the current baseline).');
}
