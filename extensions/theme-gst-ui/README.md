# extensions/theme-gst-ui

**Theme App Extension** (app block) that renders the GST capture UI on the **cart page**.
This is the storefront surface on Shopify Basic (no checkout extensibility — DECISIONS.md D2).

Generated in Milestone M4 with:

```bash
shopify app generate extension --type theme_app_extension
```

## UX

```
[ ] Need GST Invoice?
GSTIN  [_______________]  [ Verify ]
        → client-side format + checksum
        → POST /apps/gst/verify  (App Proxy, HMAC)
✓ GST Verified
Company / Registered Address / City / State   (auto-filled, read-only)
[ Use Verified Details ]
```

On confirm: writes verified fields as **cart attributes** (guest-safe) and, for logged-in
customers, to `gst.*` customer metafields. Mobile-first. Verification failure never blocks
checkout.

> Secrets are never present here — the block only calls the HMAC-verified App Proxy.
