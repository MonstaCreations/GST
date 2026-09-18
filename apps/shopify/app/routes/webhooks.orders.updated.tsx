/**
 * Webhook: orders/updated.
 * M1: verify + acknowledge. M7 will reconcile pre-invoice changes only (an issued
 * invoice is immutable; later changes are handled via credit notes).
 */
import type { ActionFunctionArgs } from 'react-router';
import { authenticate } from '../shopify.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  // eslint-disable-next-line no-console
  console.log(`[webhook] ${topic} ${shop}`);
  // TODO(M7): reconcile pre-invoice order changes.
  return new Response();
};
