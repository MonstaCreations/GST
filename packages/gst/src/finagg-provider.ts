/**
 * FinAGGProvider — the real GST verification adapter, backed by FinAGG's
 * Common GST Search API (`action=SEARCHGSTIN`).
 *
 * Implements the existing `GSTVerificationProvider` contract unchanged: it returns a
 * normalized `GSTVerificationResult`, or throws one of the typed provider errors that
 * the verification service already knows how to turn into a safe outcome.
 *
 * ## HTTP / API outcome → verification outcome
 *
 *   2xx, active taxpayer            → ACTIVE            → verified
 *   2xx, cancelled/inactive/susp.   → CANCELLED/INACTIVE→ inactive
 *   2xx, empty or "not found"       → NOT_FOUND         → not_found
 *   2xx, "invalid GSTIN"            → ProviderInvalidGstinError → invalid
 *   400, GSTIN rejected by FinAGG   → ProviderInvalidGstinError → invalid
 *   400, malformed request (GEN5007)→ ProviderUnavailableError  → unavailable
 *   401 / 403                       → ProviderUnavailableError  → unavailable
 *   404                             → ProviderUnavailableError  → unavailable
 *   429                             → ProviderUnavailableError  → unavailable
 *   500 / 503 / other non-2xx       → ProviderUnavailableError  → unavailable
 *   timeout                         → ProviderTimeoutError      → unavailable
 *   network failure                 → ProviderUnavailableError  → unavailable
 *   unparseable / partial body      → ProviderUnavailableError  → unavailable
 *
 * Two deliberate calls worth naming:
 *
 *  - **404 is `unavailable`, not `not_found`.** The OpenAPI document describes 404 as
 *    "Resource not found" — the endpoint — and describes a missing taxpayer as an
 *    empty/failed 200 body. A wrong `FINAGG_FINAGG_VERSION`/`FINAGG_GSP_VERSION`
 *    produces exactly a 404, and we must not tell a customer their GSTIN does not
 *    exist because of our own misconfiguration.
 *  - **A 400 we cannot parse is `unavailable`, not `invalid`.** A JSON 400 naming the
 *    GSTIN maps to `invalid` as specified; an opaque 400 (e.g. an HTML gateway page)
 *    tells us nothing about the GSTIN, so we decline to blame the customer for it.
 *
 * No raw provider text ever reaches the caller: every thrown error carries only our
 * own message, and the verification service converts it to a generic outcome.
 */
import type { GSTVerificationProvider, GSTVerificationResult } from './provider';
import {
  ProviderInvalidGstinError,
  ProviderTimeoutError,
  ProviderUnavailableError,
} from './provider';
import type { Logger } from '@gst-engine/shared';
import type { FinaggConfig } from './finagg-config';
import type { FetchLike } from './finagg-client';
import { FinaggClient, type FinaggClientDeps } from './finagg-client';
import { parseFinaggSearchBody } from './finagg-mapping';
import { normalizeVerificationResult, type RawVerification } from './normalize';

export interface FinAGGProviderDeps {
  /** Injected in tests; defaults to the global fetch. */
  readonly fetch?: FetchLike;
  readonly logger?: Logger;
  readonly now?: () => Date;
}

export const FINAGG_PROVIDER_NAME = 'finagg';

export class FinAGGProvider implements GSTVerificationProvider {
  readonly name = FINAGG_PROVIDER_NAME;

  private readonly client: FinaggClient;
  private readonly now: () => Date;

  constructor(config: FinaggConfig, deps: FinAGGProviderDeps = {}) {
    // Built conditionally: `exactOptionalPropertyTypes` rejects an explicit `undefined`.
    const clientDeps: { -readonly [K in keyof FinaggClientDeps]: FinaggClientDeps[K] } = {};
    if (deps.fetch) clientDeps.fetch = deps.fetch;
    if (deps.logger) clientDeps.logger = deps.logger;

    this.client = new FinaggClient(config, clientDeps);
    this.now = deps.now ?? (() => new Date());
  }

  async verifyGSTIN(gstin: string): Promise<GSTVerificationResult> {
    const http = await this.client.searchGstin(gstin);

    if (http.kind === 'timeout') throw new ProviderTimeoutError(this.name);
    if (http.kind === 'network') throw new ProviderUnavailableError(this.name);

    const { status, body, parsed } = http;

    if (status === 400) {
      if (!parsed) throw new ProviderUnavailableError(this.name);
      const outcome = parseFinaggSearchBody(body, gstin);
      switch (outcome.kind) {
        case 'not_found':
          return this.notFound(gstin);
        case 'provider_error':
        case 'malformed':
          throw new ProviderUnavailableError(this.name);
        default:
          // Documented: "Invalid GSTIN format → 400 error".
          throw new ProviderInvalidGstinError(this.name);
      }
    }

    if (status < 200 || status >= 300) {
      // 401 / 403 / 404 / 429 / 500 / 503 and anything else: never the customer's fault.
      throw new ProviderUnavailableError(this.name);
    }

    if (!parsed) throw new ProviderUnavailableError(this.name);

    const outcome = parseFinaggSearchBody(body, gstin);
    switch (outcome.kind) {
      case 'found':
        return normalizeVerificationResult(outcome.raw, this.name, this.now);
      case 'not_found':
        return this.notFound(gstin);
      case 'invalid_gstin':
        throw new ProviderInvalidGstinError(this.name);
      case 'provider_error':
      case 'malformed':
        throw new ProviderUnavailableError(this.name);
    }
  }

  private notFound(gstin: string): GSTVerificationResult {
    const raw: RawVerification = {
      gstin,
      legalName: '',
      registeredAddress: '',
      city: '',
      status: 'NOT_FOUND',
    };
    return normalizeVerificationResult(raw, this.name, this.now);
  }
}
