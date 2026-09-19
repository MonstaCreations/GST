/**
 * FinAGG GSP configuration + GST provider selection, both read from the environment.
 *
 * Kept deliberately separate from the provider itself so that configuration can be
 * validated once at startup (see `validateGstProviderConfig`) instead of blowing up
 * mid-checkout, and so switching mock ↔ finagg is an env change only.
 *
 * Source of truth for the endpoint shape: the FinAGG OpenAPI document published at
 * https://developer.gsp.finagg.in/ — `servers` lists the Production origin
 * `https://gsp.finagg.in` and the Sandbox origin `https://sandbox-gsp.finagg.in`;
 * the search path template is
 * `/basic/gstn/{finaggVersion}/commonapi/{gspVersion}/search`.
 *
 * No secret is ever placed in an error message or log line here.
 */
import { AppError } from '@gst-engine/shared';

/** Production origin, from the OpenAPI `servers` block. */
export const FINAGG_PRODUCTION_BASE_URL = 'https://gsp.finagg.in';

/**
 * Sandbox origin, from the OpenAPI `servers` block. NOT a fake-data sandbox —
 * FinAGG have confirmed GSTN provides no separate test environment. Use production
 * unless FinAGG onboarding explicitly directs otherwise.
 */
export const FINAGG_SANDBOX_BASE_URL = 'https://sandbox-gsp.finagg.in';

/** The path prefix baked into every documented FinAGG path template. */
export const FINAGG_PATH_PREFIX = '/basic/gstn';

export const FINAGG_DEFAULT_TIMEOUT_MS = 8_000;

export interface FinaggConfig {
  readonly apiKey: string;
  /** Origin only, e.g. `https://gsp.finagg.in`. `FINAGG_PATH_PREFIX` is appended per request. */
  readonly baseUrl: string;
  /** `{finaggVersion}` path segment. */
  readonly finaggVersion: string;
  /** `{gspVersion}` path segment. */
  readonly gspVersion: string;
  readonly timeoutMs: number;
  /** When true, a single retry is allowed for transient failures only. */
  readonly retryOnce: boolean;
}

export type EnvLike = Readonly<Record<string, string | undefined>>;

/** Configuration is missing or unusable. Thrown at startup, never per request. */
export class GstProviderConfigError extends AppError {
  readonly problems: readonly string[];

  constructor(message: string, problems: readonly string[] = []) {
    super(message, 'GST_PROVIDER_CONFIG_ERROR');
    this.problems = problems;
  }
}

function read(env: EnvLike, key: string): string {
  return (env[key] ?? '').trim();
}

/**
 * Accepts either the origin (`https://gsp.finagg.in`, the OpenAPI `servers` value) or
 * the "Base URL" spelling used in the portal's prose (`https://gsp.finagg.in/basic/gstn/`)
 * and reduces both to the origin, so the documented path is never duplicated.
 */
export function normalizeFinaggBaseUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, '');
  if (url.toLowerCase().endsWith(FINAGG_PATH_PREFIX)) {
    url = url.slice(0, -FINAGG_PATH_PREFIX.length).replace(/\/+$/, '');
  }
  return url;
}

/**
 * Build a FinaggConfig from environment variables, collecting *every* problem before
 * throwing so a misconfiguration is fixed in one pass.
 *
 * Required: FINAGG_API_KEY, FINAGG_BASE_URL, FINAGG_FINAGG_VERSION, FINAGG_GSP_VERSION.
 * Optional: FINAGG_TIMEOUT_MS (default 8000), FINAGG_RETRY (default on).
 *
 * The versions have no default on purpose: `fin-v1` / `v1.1` appear in the OpenAPI
 * document only as examples, and guessing them yields a 404 at runtime.
 */
export function loadFinaggConfig(env: EnvLike): FinaggConfig {
  const problems: string[] = [];

  const apiKey = read(env, 'FINAGG_API_KEY');
  if (!apiKey) problems.push('FINAGG_API_KEY is required (sent as the x-api-key header)');

  const rawBaseUrl = read(env, 'FINAGG_BASE_URL');
  const baseUrl = normalizeFinaggBaseUrl(rawBaseUrl);
  if (!rawBaseUrl) {
    problems.push(`FINAGG_BASE_URL is required (production: ${FINAGG_PRODUCTION_BASE_URL})`);
  } else {
    let protocol = '';
    try {
      protocol = new URL(baseUrl).protocol;
    } catch {
      protocol = '';
    }
    if (protocol !== 'http:' && protocol !== 'https:') {
      problems.push(
        `FINAGG_BASE_URL must be an absolute http(s) URL (production: ${FINAGG_PRODUCTION_BASE_URL})`,
      );
    }
  }

  const finaggVersion = read(env, 'FINAGG_FINAGG_VERSION');
  if (!finaggVersion) {
    problems.push('FINAGG_FINAGG_VERSION is required (the {finaggVersion} path segment)');
  }

  const gspVersion = read(env, 'FINAGG_GSP_VERSION');
  if (!gspVersion) {
    problems.push('FINAGG_GSP_VERSION is required (the {gspVersion} path segment)');
  }

  let timeoutMs = FINAGG_DEFAULT_TIMEOUT_MS;
  const rawTimeout = read(env, 'FINAGG_TIMEOUT_MS');
  if (rawTimeout) {
    const parsed = Number(rawTimeout);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      problems.push('FINAGG_TIMEOUT_MS must be a positive integer number of milliseconds');
    } else {
      timeoutMs = parsed;
    }
  }

  const rawRetry = read(env, 'FINAGG_RETRY').toLowerCase();
  const retryOnce = !(rawRetry === 'false' || rawRetry === '0' || rawRetry === 'off');

  if (problems.length > 0) {
    throw new GstProviderConfigError(
      `GST_PROVIDER=finagg but the FinAGG configuration is incomplete:\n  - ${problems.join('\n  - ')}`,
      problems,
    );
  }

  return { apiKey, baseUrl, finaggVersion, gspVersion, timeoutMs, retryOnce };
}

export type GstProviderSelection =
  | { readonly provider: 'mock' }
  | { readonly provider: 'gstverify' }
  | { readonly provider: 'finagg'; readonly config: FinaggConfig };

/**
 * Decide which provider the environment asks for, validating its configuration.
 *
 * Unset/empty keeps the historical default of `mock`. `finagg` never silently falls
 * back to `mock`: an incomplete FinAGG configuration throws. An unrecognised value
 * also throws rather than quietly degrading to mock, so a typo cannot ship to
 * production as "verification always succeeds".
 */
export function resolveGstProviderSelection(env: EnvLike): GstProviderSelection {
  const name = read(env, 'GST_PROVIDER').toLowerCase();
  switch (name) {
    case '':
    case 'mock':
      return { provider: 'mock' };
    case 'gstverify':
      return { provider: 'gstverify' };
    case 'finagg':
      return { provider: 'finagg', config: loadFinaggConfig(env) };
    default:
      throw new GstProviderConfigError(
        `GST_PROVIDER="${name}" is not a known GST provider (expected "mock" or "finagg")`,
        [`unknown GST_PROVIDER value "${name}"`],
      );
  }
}

/** Startup guard: throws `GstProviderConfigError` if the environment is unusable. */
export function validateGstProviderConfig(env: EnvLike): void {
  resolveGstProviderSelection(env);
}
