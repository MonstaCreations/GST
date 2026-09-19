# GST verification provider

GSTIN verification is the **only external dependency**. It is behind an interface so the
real provider can be dropped in later by changing one adapter and some env vars — no
architecture change (see [DECISIONS.md](DECISIONS.md) D1, and the client rule: replace only
the provider adapter).

## Contract (`packages/gst`)

```ts
export interface GSTVerificationProvider {
  readonly name: string;
  verifyGSTIN(gstin: string): Promise<GSTVerificationResult>;
}

export interface GSTVerificationResult {
  gstin: string;
  legalName: string;
  tradeName?: string;
  registeredAddress: string;
  city: string;
  state: string;
  stateCode: string; // 2-digit; must equal gstin.slice(0,2)
  pincode?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'NOT_FOUND';
  businessType?: string;
  verifiedAt: string; // ISO 8601
  provider: string; // provider.name
}
```

Each provider is responsible for mapping its own raw response shape into
`GSTVerificationResult`. **No provider-specific field names leak into the rest of the app** —
everything downstream consumes the normalized result only.

## Implementations

| Name                | Status      | Purpose                                                                                                                    |
| ------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| `MockGSTProvider`   | built (M2)  | deterministic fixtures for all states (active, inactive, cancelled, not-found, timeout). Kept for local UI/demo and tests. |
| `FinAGGProvider`    | built (M10) | real adapter over FinAGG's Common GST Search API (`action=SEARCHGSTIN`).                                                   |
| `GSTVerifyProvider` | **stub**    | legacy placeholder; throws `ProviderNotConfiguredError`. Superseded by `FinAGGProvider`.                                   |

Selection is by env: `GST_PROVIDER=mock` (default), `finagg`, or `gstverify`. Credentials are
**server-side only** and never reach the browser or theme extension.

## FinAGG (`FinAGGProvider`)

Docs: <https://developer.gsp.finagg.in/>. One endpoint is integrated — GSTIN search. No
returns, GSTR-1/3B, OTP taxpayer authentication, or file-download endpoints.

```
GET {FINAGG_BASE_URL}/basic/gstn/{FINAGG_FINAGG_VERSION}/commonapi/{FINAGG_GSP_VERSION}/search
    ?action=SEARCHGSTIN&gstin={GSTIN}
x-api-key: {FINAGG_API_KEY}
```

| Variable                | Required     | Notes                                                             |
| ----------------------- | ------------ | ----------------------------------------------------------------- |
| `FINAGG_API_KEY`        | yes          | Request from gsp@finagg.in. Never logged, never sent to a client. |
| `FINAGG_BASE_URL`       | yes          | `https://gsp.finagg.in` (production).                             |
| `FINAGG_FINAGG_VERSION` | yes          | `{finaggVersion}` path segment. No default — guessing yields 404. |
| `FINAGG_GSP_VERSION`    | yes          | `{gspVersion}` path segment.                                      |
| `FINAGG_TIMEOUT_MS`     | no (8000)    | Per-attempt request timeout.                                      |
| `FINAGG_RETRY`          | no (enabled) | `false` disables the single transient retry.                      |

`FINAGG_BASE_URL` may be written as the origin or with the documented `/basic/gstn/` suffix;
both reduce to the origin, so the path is never duplicated.

**Sandbox:** `https://sandbox-gsp.finagg.in` exists, but it is _not_ a fake-data sandbox.
FinAGG have confirmed GSTN provides no separate test environment — test against production
with real taxpayer GSTINs unless FinAGG onboarding says otherwise.

### Outcome mapping

| FinAGG result                             | Provider                    | Service outcome                         |
| ----------------------------------------- | --------------------------- | --------------------------------------- |
| 2xx, `sts` Active                         | `ACTIVE`                    | `verified`                              |
| 2xx, `sts` Inactive/Suspended/Provisional | `INACTIVE`                  | `inactive`                              |
| 2xx, `sts` Cancelled                      | `CANCELLED`                 | `inactive`                              |
| 2xx, empty body/`data`, or "not found"    | `NOT_FOUND`                 | `not_found`                             |
| 2xx or 400 naming the GSTIN invalid       | `ProviderInvalidGstinError` | `invalid` (`reason: provider_rejected`) |
| 400 `GEN5007` "Malformed Request"         | `ProviderUnavailableError`  | `unavailable`                           |
| 401 / 403 / 404 / 429 / 5xx               | `ProviderUnavailableError`  | `unavailable`                           |
| timeout                                   | `ProviderTimeoutError`      | `unavailable`                           |
| network failure, unparseable/partial      | `ProviderUnavailableError`  | `unavailable`                           |

Two deliberate calls: **404 is `unavailable`, not `not_found`** (it means the endpoint or a
version segment is wrong — never tell a customer their GSTIN does not exist because of our
misconfiguration), and **an unparseable 400 is `unavailable`, not `invalid`** (an opaque
gateway page says nothing about the GSTIN).

Raw provider text never reaches the storefront: thrown errors carry only our own message.

### Resilience

Per-attempt timeout via `AbortController`. At most **one** retry, only for failures that are
transient by definition — network error, timeout, or HTTP 503. Never for 429, 500, or any 4xx.

### Logging

The API key, the request headers, and every response body are never logged. The GSTIN is
masked (`27*********F1ZV`). Only transport outcome, HTTP status, attempt, and duration are.

### Configuration validation

`resolveGstProviderSelection(env)` runs once at module load in
`apps/shopify/app/lib/gst/provider.server.ts`. With `GST_PROVIDER=finagg` it requires the four
variables above and throws `GstProviderConfigError` listing every problem at once — at boot,
not during a customer's checkout. `finagg` never silently falls back to `mock`, and an
unrecognised `GST_PROVIDER` value throws rather than quietly degrading.

### Testing a real GSTIN

The embedded admin page **/app/gst-verify** (merchant-admin authenticated) runs a GSTIN through
the same verification service the storefront uses, and shows the active provider, the resolved
endpoint, and whether a key is present — never the key itself.

## Validation before the API call

1. **Client-side** (theme extension): format + checksum, to avoid wasted calls.
2. **Server-side** (verify service): re-validate format + checksum — never trust the client.
3. Only then call the provider. Normalize. Cross-check `stateCode` against the GSTIN prefix.

## Resilience (checkout must never break)

- Per-attempt timeout, plus one retry for transient failures only (see FinAGG section above).
  A circuit breaker is still open work.
- On any failure, the storefront returns a clear "verification unavailable — you can still
  order" state. The order proceeds; the invoice is generated from order data regardless.

## Switching to FinAGG once the key arrives

1. Set `FINAGG_API_KEY`, `FINAGG_BASE_URL`, `FINAGG_FINAGG_VERSION`, `FINAGG_GSP_VERSION`.
2. Set `GST_PROVIDER=finagg`. A missing or unusable value fails at boot, with the list of
   problems.
3. Open **/app/gst-verify** in the embedded admin and verify a real company GSTIN.
4. Confirm the mapping against the first real response; the two documented field spellings
   live side by side in `packages/gst/src/finagg-mapping.ts` for exactly this.

No UI or business-logic files change — only the environment.
