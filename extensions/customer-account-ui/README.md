# extensions/customer-account-ui

**Customer Account UI Extension** — the invoice portal inside the customer account:
list invoices, download invoice PDFs and credit notes, view invoice number/date.

Generated in Milestone M8.

> ⚠️ **Verify before building (DECISIONS.md L6):** confirm Customer Account UI Extension
> availability on the store's **Basic** plan against the current Shopify docs. If it is not
> available on Basic, the fallback (same backend, same auth) is an **App-Proxy-served
> portal page** linked from the account and the invoice email. Record the outcome in
> DECISIONS.md before implementation.

Access control: the extension calls the app backend with a session token; the backend
authorizes that the requesting customer owns the order/invoice before returning links.
