/**
 * Webhook idempotency guard.
 *
 * Shopify retries a webhook until it receives a 2xx and may deliver the same event
 * more than once. `webhookId` (the `X-Shopify-Webhook-Id` header, surfaced by
 * `authenticate.webhook`) is Shopify's idempotency key, so remembering recently seen
 * ids collapses the common retry case before any work is done.
 *
 * NOTE: in-memory and per-instance, exactly like rate-limit.server.ts. On serverless
 * each instance keeps its own view, so this is a cheap first line of defence ONLY.
 * Every handler must also be *durably* idempotent against Shopify state — the GST
 * snapshot writer, for example, refuses to overwrite an existing `gst.snapshot`
 * metafield. Do not rely on this guard alone for correctness.
 */
const TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 1_000;

const seen = new Map<string, number>();

function prune(now: number): void {
  for (const [id, expiresAt] of seen) {
    if (expiresAt <= now) seen.delete(id);
  }
  // Bound memory even if every entry is still live (oldest inserted first).
  while (seen.size > MAX_ENTRIES) {
    const oldest = seen.keys().next();
    if (oldest.done) break;
    seen.delete(oldest.value);
  }
}

/**
 * Claim a webhook for processing.
 *
 * Returns true the first time an id is seen (caller should process it) and false for
 * a repeat within the TTL (caller should acknowledge and skip).
 */
export function claimWebhook(webhookId: string, now: number = Date.now()): boolean {
  if (!webhookId) return true; // No id to dedupe on — let the durable guard decide.
  prune(now);
  if (seen.has(webhookId)) return false;
  seen.set(webhookId, now + TTL_MS);
  return true;
}

/** Test seam: drop all remembered ids. */
export function resetWebhookIdempotency(): void {
  seen.clear();
}
