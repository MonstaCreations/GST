# tests

Cross-cutting test suites. Package-local unit tests live next to their source in
`packages/*/src/**/*.test.ts`; this folder holds suites that span packages or the app.

```
unit/          cross-package unit tests
integration/   Shopify API (fixtures), mock provider, PDF, email
e2e/           Playwright end-to-end flows (against a Shopify dev store)
```

See [`docs/TESTING.md`](../docs/TESTING.md) for the full strategy and commands.
