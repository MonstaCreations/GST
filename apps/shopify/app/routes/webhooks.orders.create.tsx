/**
 * Webhook: orders/create.
 * M1: verify + acknowledge. M7 will enqueue the order for the single-writer
 * invoice reconciler (idempotent on invoice.number). No invoice work here yet.
 */
import type { ActionFunctionArgs } from 'react-router';
import { authenticate } from '../shopify.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const orderId = (payload as { admin_graphql_api_id?: string }).admin_graphql_api_id;
  // eslint-disable-next-line no-console
  console.log(`[webhook] ${topic} ${shop} order=${orderId ?? '?'}`);
  // TODO(M7): mark order as pending invoice for the reconciler.
  return new Response();
};
