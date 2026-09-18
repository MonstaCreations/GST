/**
 * Webhook: refunds/create.
 * M1: verify + acknowledge. M13 will generate a credit note (idempotent on the
 * refund id), preserving original invoice immutability.
 */
import type { ActionFunctionArgs } from 'react-router';
import { authenticate } from '../shopify.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const refundId = (payload as { admin_graphql_api_id?: string }).admin_graphql_api_id;
  // eslint-disable-next-line no-console
  console.log(`[webhook] ${topic} ${shop} refund=${refundId ?? '?'}`);
  // TODO(M13): generate credit note for the refunded items/taxes.
  return new Response();
};
