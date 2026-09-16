/**
 * @gst-engine/exports — CSV / XLSX / Tally exporters.
 * Phase 0: contract + stubs. CSV/XLSX in M8; Tally CSV in M9 (XML seam kept).
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

/** TODO(M8): RFC-4180 CSV. */
export declare function toCsv(table: ReportTable, filename: string): ExportedFile;

/** TODO(M8): XLSX workbook. */
export declare function toXlsx(table: ReportTable, filename: string): ExportedFile;

/**
 * TODO(M9): Tally-compatible CSV using the merchant's ledger/tax mapping.
 * XML export intentionally deferred until exact merchant requirements exist.
 */
export declare function toTallyCsv(table: ReportTable, filename: string): ExportedFile;
