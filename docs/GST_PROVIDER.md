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

| Name                | Status     | Purpose                                                                                                                   |
| ------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| `MockGSTProvider`   | built (M2) | deterministic fixtures for all states (active, inactive, cancelled, not-found, timeout). Enables all downstream work now. |
| `GSTVerifyProvider` | **stub**   | throws `ProviderNotConfiguredError` until credentials arrive. Real mapping added in M10.                                  |

Selection is by env: `GST_PROVIDER=mock` (default) or `gstverify`. Credentials
(`GST_API_URL`, `GST_API_KEY`, `GST_API_AUTH_SCHEME`) are **server-side only** and never
reach the browser or theme extension.

## Validation before the API call

1. **Client-side** (theme extension): format + checksum, to avoid wasted calls.
2. **Server-side** (verify service): re-validate format + checksum — never trust the client.
3. Only then call the provider. Normalize. Cross-check `stateCode` against the GSTIN prefix.

## Resilience (checkout must never break)

- Timeout + retry with backoff, and a circuit breaker around the provider.
- On any failure, the storefront returns a clear "verification unavailable — you can still
  order" state. The order proceeds; the invoice is generated from order data regardless.

## When credentials arrive (M10)

1. Fill `GST_API_URL`, `GST_API_KEY`, `GST_API_AUTH_SCHEME` in the environment.
2. Implement request/response mapping inside `GSTVerifyProvider` only.
3. Set `GST_PROVIDER=gstverify`.
4. Run the provider integration tests (sandbox) and the edge-case suite.

No other files change.
