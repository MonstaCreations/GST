/**
 * Webhook: customers/update.
 * M1: verify + acknowledge. M5/M7 will refresh the customer GST profile cache if
 * needed. Order snapshots remain immutable regardless of later profile changes.
 */
import type { ActionFunctionArgs } from 'react-router';
import { authenticate } from '../shopify.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  // eslint-disable-next-line no-console
  console.log(`[webhook] ${topic} ${shop}`);
  // TODO(M5): reconcile customer GST profile.
  return new Response();
};
