/**
 * Invoice numbering behind an interface (DECISIONS.md D4).
 *
 * The production implementation (M5, in apps/shopify) is an app-installation
 * metafield counter, called only by the single-concurrency cron reconciler (D3)
 * so allocation is serialized. This in-memory implementation is for tests/dev and
 * exercises the same contract.
 */

export interface InvoiceNumberProvider {
  /** Allocate the next number for a financial-year series (e.g. "2026-27"). */
  next(financialYear: string): Promise<string>;
}

/** Indian financial year (April–March) for a date, e.g. 2026-09-16 → "2026-27". */
export function financialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = January
  const startYear = month >= 3 ? year : year - 1; // FY starts in April
  const endYY = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYY}`;
}

export interface InMemoryNumberingOptions {
  prefix?: string;
  pad?: number;
  start?: number;
}

/**
 * In-memory, gap-free sequential numbering per FY series.
 * Allocation increments synchronously before resolving, so concurrent callers
 * (Promise.all) still receive unique, consecutive numbers.
 */
export class InMemoryInvoiceNumberProvider implements InvoiceNumberProvider {
  private readonly counters = new Map<string, number>();
  private readonly prefix: string;
  private readonly pad: number;
  private readonly start: number;

  constructor(options: InMemoryNumberingOptions = {}) {
    this.prefix = options.prefix ?? 'INV';
    this.pad = options.pad ?? 6;
    this.start = options.start ?? 1;
  }

  next(financialYearSeries: string): Promise<string> {
    const current = this.counters.get(financialYearSeries) ?? this.start;
    this.counters.set(financialYearSeries, current + 1);
    const seq = String(current).padStart(this.pad, '0');
    return Promise.resolve(`${this.prefix}/${financialYearSeries}/${seq}`);
  }
}
