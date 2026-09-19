/**
 * Maps a FinAGG Common GST Search (`action=SEARCHGSTIN`) response body onto our
 * provider-agnostic `RawVerification`.
 *
 * ## What the documentation actually specifies
 *
 * The FinAGG OpenAPI document (https://developer.gsp.finagg.in/) defines two envelopes:
 *
 *   ErrorResponse   { status_cd: "0", error: { error_cd, message } }
 *   SuccessResponse { status_cd, status_desc, data: { gstin, legalName, state, regDate, sts } }
 *
 * and its `SuccessData` response says, verbatim: "In case of successful response you
 * will get the JSON according to the API endpoints. Please refer GST API Developer API
 * link https://developer.gst.gov.in/apiportal". In other words FinAGG passes the GSTN
 * payload through, and `SuccessResponse` above is an illustrative summary of it.
 *
 * So this module reads **both** documented spellings of each field — the FinAGG summary
 * schema and the GSTN SEARCHGSTIN payload it wraps — and nothing else. Every key below
 * comes from one of those two documents; none are invented. The two tables are kept
 * side by side precisely so that the first real production response can confirm or
 * trim them in one edit.
 *
 *   normalized field   | FinAGG SuccessResponse | GSTN SEARCHGSTIN payload
 *   -------------------|------------------------|--------------------------------
 *   gstin              | data.gstin             | gstin
 *   legalName          | data.legalName         | lgnm
 *   tradeName          | —                      | tradeNam
 *   registeredAddress  | —                      | pradr.adr (or pradr.addr parts)
 *   city               | —                      | pradr.addr.city / .dst / .loc
 *   state              | data.state             | pradr.addr.stcd
 *   pincode            | —                      | pradr.addr.pncd
 *   status             | data.sts               | sts
 *   businessType       | —                      | ctb
 */
import type { GstStatus } from './provider';
import type { RawVerification } from './normalize';

export type FinaggSearchParse =
  | { readonly kind: 'found'; readonly raw: RawVerification }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'invalid_gstin' }
  | { readonly kind: 'provider_error'; readonly errorCode: string | undefined }
  | { readonly kind: 'malformed' };

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

/** Read a non-empty trimmed string field, or undefined. */
function str(record: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!record) return undefined;
  const value = record[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * GSTN `sts` / FinAGG `data.sts` label → our status enum.
 *
 * "Suspended" and "Provisional" both map to INACTIVE: neither is a confirmed active
 * registration, and INACTIVE is the conservative answer for an invoicing decision.
 * An unrecognised label returns undefined so the caller can treat it as malformed
 * rather than guess "active".
 */
export function mapTaxpayerStatus(label: string): GstStatus | undefined {
  const s = label.trim().toLowerCase();
  if (s === '') return undefined;
  if (s.includes('cancel')) return 'CANCELLED';
  // Checked before "active" — "inactive" contains "active".
  if (s.includes('inactive')) return 'INACTIVE';
  if (s.includes('suspend') || s.includes('provisional')) return 'INACTIVE';
  if (s.includes('active')) return 'ACTIVE';
  return undefined;
}

/** GSTN principal-address line parts, in the order GSTN documents them. */
const ADDRESS_LINE_KEYS = ['flno', 'bno', 'bnm', 'st', 'loc'] as const;

function composeAddress(addr: Record<string, unknown> | undefined): string {
  if (!addr) return '';
  const parts: string[] = [];
  for (const key of ADDRESS_LINE_KEYS) {
    const value = str(addr, key);
    if (value && !parts.includes(value)) parts.push(value);
  }
  return parts.join(', ');
}

/**
 * Error classification. Only the semantics the documentation states are encoded:
 * "GSTIN not found → empty/failed response", "Invalid GSTIN format → 400 error",
 * and GEN5007 "Malformed Request" (a fault in *our* request, not the taxpayer's GSTIN).
 */
const MALFORMED_REQUEST_HINTS = ['malformed request', 'gen5007'];
const NOT_FOUND_HINTS = ['not found', 'no record', 'does not exist', 'no such'];
const INVALID_GSTIN_HINTS = ['invalid gstin', 'invalid uid', 'gstin is invalid'];

export function classifyFinaggError(
  errorCode: string | undefined,
  message: string | undefined,
): FinaggSearchParse {
  const text = `${errorCode ?? ''} ${message ?? ''}`.toLowerCase();
  if (MALFORMED_REQUEST_HINTS.some((h) => text.includes(h))) {
    return { kind: 'provider_error', errorCode };
  }
  if (NOT_FOUND_HINTS.some((h) => text.includes(h))) return { kind: 'not_found' };
  if (INVALID_GSTIN_HINTS.some((h) => text.includes(h))) return { kind: 'invalid_gstin' };
  return { kind: 'provider_error', errorCode };
}

/**
 * Parse a 2xx FinAGG search body.
 *
 * `null`/empty is treated as `not_found`, matching the documented failure scenario
 * "GSTIN not found → empty/failed response". Non-2xx bodies are classified by the
 * caller, which knows the HTTP status.
 */
export function parseFinaggSearchBody(body: unknown, requestedGstin: string): FinaggSearchParse {
  if (body === null || body === undefined) return { kind: 'not_found' };

  const root = asRecord(body);
  if (!root) return { kind: 'malformed' };

  const error = asRecord(root['error']);
  if (error) {
    return classifyFinaggError(str(error, 'error_cd'), str(error, 'message'));
  }

  const statusCd = str(root, 'status_cd');
  // ErrorResponse uses status_cd "0"; a "0" with no error object tells us nothing usable.
  if (statusCd === '0') return { kind: 'provider_error', errorCode: undefined };

  // SuccessResponse nests the taxpayer under `data`; a raw GSTN passthrough does not.
  const dataValue = root['data'];
  if (dataValue === null) return { kind: 'not_found' };
  const data = asRecord(dataValue) ?? root;
  if (Object.keys(data).length === 0) return { kind: 'not_found' };

  const statusLabel = str(data, 'sts');
  const legalName = str(data, 'lgnm') ?? str(data, 'legalName');

  // Neither documented shape can omit both of these for a real taxpayer.
  if (!statusLabel && !legalName) return { kind: 'not_found' };
  if (!statusLabel) return { kind: 'malformed' };

  const status = mapTaxpayerStatus(statusLabel);
  if (!status) return { kind: 'malformed' };

  const principal = asRecord(data['pradr']);
  const addr = asRecord(principal?.['addr']);

  const gstin = str(data, 'gstin') ?? requestedGstin;
  const registeredAddress = str(principal, 'adr') ?? composeAddress(addr);
  const city = str(addr, 'city') ?? str(addr, 'dst') ?? str(addr, 'loc') ?? '';
  const state = str(addr, 'stcd') ?? str(data, 'state');
  const tradeName = str(data, 'tradeNam');
  const pincode = str(addr, 'pncd');
  const businessType = str(data, 'ctb');

  const raw: RawVerification = {
    gstin,
    legalName: legalName ?? '',
    registeredAddress,
    city,
    status,
  };
  if (state !== undefined) raw.state = state;
  if (tradeName !== undefined) raw.tradeName = tradeName;
  if (pincode !== undefined) raw.pincode = pincode;
  if (businessType !== undefined) raw.businessType = businessType;

  return { kind: 'found', raw };
}
