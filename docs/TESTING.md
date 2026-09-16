# Testing strategy

Tooling: **Vitest** (unit + integration) and **Playwright** (E2E). Pure `packages/*` logic
is tested in isolation with no Shopify dependency — that is the payoff of the
framework-agnostic core.

## Layers

### Unit (Vitest, in each package)

- GSTIN format + **checksum** validation (valid / malformed / wrong checksum).
- Tax engine: intra-state CGST+SGST (seller state 27) vs inter-state IGST; rounding.
- `Money` decimal-safe arithmetic (no floating-point drift).
- Invoice totals, taxable-value derivation, amount-in-words.
- **Invoice numbering:** simulated serialized allocation → no duplicates, no gaps.
- Credit-note math (full / partial / cancellation).
- Report aggregations.

### Integration (Vitest)

- `MockGSTProvider` end-to-end through the verify service (including timeout/unavailable
  fallbacks).
- Shopify Admin API interactions against recorded fixtures (metafield read/write).
- PDF render smoke test (`PdfRenderer` produces a valid PDF from a template).
- `EmailProvider` console/sandbox path.

### E2E (Playwright)

1. Verified-GST cart flow → auto-fill → checkout → order → invoice → PDF → email → portal
   download.
2. Invalid GSTIN and inactive GSTIN paths.
3. Provider timeout → checkout still completes.
4. Guest checkout vs returning (logged-in) customer.
5. Same-state vs inter-state orders (tax split).
6. Partial refund and full refund → credit note.
7. **Duplicate webhook delivery → exactly one invoice and one email** (idempotency).

## Commands

```bash
pnpm test         # unit + integration across the workspace (turbo)
pnpm test:unit    # vitest only
pnpm test:e2e     # playwright
pnpm typecheck    # tsc -b (project references)
pnpm lint
```

## CI

CI runs `typecheck`, `lint`, and `test` on every PR. E2E runs against a Shopify dev store
in a dedicated job. Coverage thresholds are enforced on the `packages/*` core (the pure
logic), where correctness matters most.
