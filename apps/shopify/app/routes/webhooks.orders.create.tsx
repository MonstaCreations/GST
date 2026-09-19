/**
 * Webhook: orders/create.
 *
 * Captures the buyer's GST details onto the order (and, when verification returns
 * authoritative data, onto the customer profile). Cart attributes are client-writable,
 * so the GSTIN is re-verified server-side here — see lib/gst/order-gst.server.ts.
 *
 * Always returns 2xx: a GST capture failure must never cause Shopify to retry forever.
 * M7 will additionally enqueue the order for the invoice reconciler.
 */
import type { ActionFunctionArgs } from 'react-router';
import { authenticate } from '../shopify.server';
import { persistOrderGst } from '../lib/gst/order-gst.server';
import { claimWebhook } from '../lib/webhooks/idempotency.server';
import { serverLogger } from '../lib/logger.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, admin, webhookId } = await authenticate.webhook(request);

  if (!claimWebhook(webhookId)) {
    serverLogger.info('webhook.duplicate', { topic, shop, webhookId });
    return new Response();
  }

  // `admin` is undefined when the app is already uninstalled for this shop.
  if (!admin) {
    serverLogger.warn('webhook.no_admin_client', { topic, shop });
    return new Response();
  }

  const result = await persistOrderGst(admin.graphql, payload, serverLogger);
  serverLogger.info('webhook.orders.create', { topic, shop, gst: result.status });

  // TODO(M7): mark order as pending invoice for the reconciler.
  return new Response();
};
