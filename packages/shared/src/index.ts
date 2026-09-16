/**
 * @gst-engine/shared — cross-cutting primitives with no domain knowledge.
 * Phase 0: contracts only. No business logic.
 */

/** ISO-8601 timestamp string, e.g. "2026-09-16T10:30:00.000Z". */
export type Iso8601 = string;

/** Structured logger contract. Implemented by apps/shopify at the edge. */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/** Base class for all typed application errors. */
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Input failed validation (format, checksum, schema). */
export class ValidationError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 'VALIDATION_ERROR', cause);
  }
}

/** A pluggable external provider (GST, email, storage) failed. */
export class ProviderError extends AppError {
  constructor(message: string, code = 'PROVIDER_ERROR', cause?: unknown) {
    super(message, code, cause);
  }
}
