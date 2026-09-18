/**
 * Webhook: orders/paid — the primary invoice trigger.
 * M1: verify + acknowledge. M7 will (idempotently) generate the invoice via the
 * reconciler; an order that already has invoice.number is skipped.
 */
import type { ActionFunctionArgs } from 'react-router';
import { authenticate } from '../shopify.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const orderId = (payload as { admin_graphql_api_id?: string }).admin_graphql_api_id;
  // eslint-disable-next-line no-console
  console.log(`[webhook] ${topic} ${shop} order=${orderId ?? '?'}`);
  // TODO(M7): trigger idempotent invoice generation.
  return new Response();
};
