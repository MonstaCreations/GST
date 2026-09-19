/**
 * Minimal HTTP client for the FinAGG Common GST Search API.
 *
 * Request shape, taken verbatim from the FinAGG OpenAPI document:
 *
 *   GET {baseUrl}/basic/gstn/{finaggVersion}/commonapi/{gspVersion}/search
 *       ?action=SEARCHGSTIN&gstin={GSTIN}
 *   x-api-key: <FINAGG_API_KEY>
 *
 * `action` is declared in `components.parameters.action` (in: query, required) and the
 * endpoint description states "Requires `action=SEARCHGSTIN`". `gstin` is the query
 * parameter this API family uses for the taxpayer identifier throughout the document
 * (e.g. the File Download path key `...returns?gstin=xxxx&ret_period=xxxx&action=FILEDET`).
 *
 * Retry policy: at most ONE extra attempt, and only for failures that are transient by
 * definition — network error, timeout, or HTTP 503 ("GSTN system unavailable"). 429 is
 * never retried, and neither is any 4xx or 500.
 *
 * Logging: the API key, the request headers, and every response body are deliberately
 * never logged. The GSTIN is masked. Only the transport outcome is recorded.
 */
import type { Logger } from '@gst-engine/shared';
import type { FinaggConfig } from './finagg-config';
import { FINAGG_PATH_PREFIX } from './finagg-config';

/** The `action` value the Common GST Search API requires. */
export const FINAGG_SEARCH_ACTION = 'SEARCHGSTIN';

export interface FinaggRequestInit {
  readonly method: 'GET';
  readonly headers: Record<string, string>;
  readonly signal: AbortSignal;
}

export interface FinaggHttpResponse {
  readonly status: number;
  text(): Promise<string>;
}

/** Narrow structural subset of `fetch`, so tests can inject a stub. */
export type FetchLike = (url: string, init: FinaggRequestInit) => Promise<FinaggHttpResponse>;

export type FinaggHttpResult =
  | {
      readonly kind: 'response';
      readonly status: number;
      /** Parsed JSON, or null for an empty body. Meaningful only when `parsed` is true. */
      readonly body: unknown;
      /** False when the body was present but not valid JSON. */
      readonly parsed: boolean;
      readonly attempts: number;
    }
  | { readonly kind: 'timeout'; readonly attempts: number }
  | { readonly kind: 'network'; readonly attempts: number };

export interface FinaggClientDeps {
  readonly fetch?: FetchLike;
  readonly logger?: Logger;
}

/** Build the documented search URL. Exported so tests can assert the exact request shape. */
export function buildFinaggSearchUrl(config: FinaggConfig, gstin: string): string {
  const path =
    `${config.baseUrl}${FINAGG_PATH_PREFIX}/` +
    `${encodeURIComponent(config.finaggVersion)}/commonapi/` +
    `${encodeURIComponent(config.gspVersion)}/search`;
  const url = new URL(path);
  url.searchParams.set('action', FINAGG_SEARCH_ACTION);
  url.searchParams.set('gstin', gstin);
  return url.toString();
}

/** `27AAPFU0939F1ZV` → `27*********F1ZV`. Keeps the state code and tail for support. */
export function maskGstin(gstin: string): string {
  const g = gstin.trim();
  if (g.length < 8) return '***';
  return `${g.slice(0, 2)}${'*'.repeat(g.length - 6)}${g.slice(-4)}`;
}

function isTransient(result: FinaggHttpResult): boolean {
  if (result.kind === 'timeout' || result.kind === 'network') return true;
  return result.status === 503;
}

export class FinaggClient {
  private readonly config: FinaggConfig;
  private readonly fetchImpl: FetchLike;
  private readonly logger: Logger | undefined;

  constructor(config: FinaggConfig, deps: FinaggClientDeps = {}) {
    this.config = config;
    this.fetchImpl = deps.fetch ?? (globalThis.fetch as unknown as FetchLike);
    this.logger = deps.logger;
  }

  async searchGstin(gstin: string): Promise<FinaggHttpResult> {
    const url = buildFinaggSearchUrl(this.config, gstin);

    const first = await this.attempt(url, gstin, 1);
    if (!this.config.retryOnce || !isTransient(first)) return first;

    return this.attempt(url, gstin, 2);
  }

  private async attempt(url: string, gstin: string, attempt: number): Promise<FinaggHttpResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        headers: {
          'x-api-key': this.config.apiKey,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      const text = await response.text();
      let body: unknown = null;
      let parsed = true;
      if (text.trim() !== '') {
        try {
          body = JSON.parse(text);
        } catch {
          parsed = false;
          body = null;
        }
      }

      this.log('finagg.search.response', gstin, attempt, startedAt, {
        status: response.status,
        parsed,
      });
      return { kind: 'response', status: response.status, body, parsed, attempts: attempt };
    } catch (error) {
      const timedOut = controller.signal.aborted;
      // Only the error's constructor name is recorded: messages can carry the request
      // URL (and therefore the GSTIN) or provider detail we do not want in logs.
      this.log('finagg.search.failed', gstin, attempt, startedAt, {
        outcome: timedOut ? 'timeout' : 'network',
        errorName: error instanceof Error ? error.name : 'unknown',
      });
      return timedOut
        ? { kind: 'timeout', attempts: attempt }
        : { kind: 'network', attempts: attempt };
    } finally {
      clearTimeout(timer);
    }
  }

  private log(
    message: string,
    gstin: string,
    attempt: number,
    startedAt: number,
    meta: Record<string, unknown>,
  ): void {
    this.logger?.info(message, {
      provider: 'finagg',
      gstin: maskGstin(gstin),
      attempt,
      durationMs: Date.now() - startedAt,
      ...meta,
    });
  }
}
