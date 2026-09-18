/**
 * App Proxy endpoint: GST verification.
 *
 * Storefront (theme extension) → /apps/gst/verify → Shopify App Proxy → this route.
 * The browser never calls the external GST API directly; it only reaches this
 * signature-verified server route, which uses the GST verification service
 * (MockGSTProvider today). Verification failure returns a safe outcome and MUST
 * NOT block checkout.
 *
 * Configured via [app_proxy] in shopify.app.toml (prefix "apps", subpath "gst").
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { authenticate } from '../shopify.server';
import { getVerificationService } from '../lib/gst/provider.server';
import { rateLimit } from '../lib/rate-limit.server';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET is used by the theme extension to confirm the proxy is reachable.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.public.appProxy(request);
  return json({ ok: true, service: 'gst-verify' });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);

  const shop = session?.shop ?? new URL(request.url).searchParams.get('shop') ?? 'unknown';
  const limit = rateLimit(`verify:${shop}`, 20, 60_000);
  if (!limit.allowed) {
    return json({ kind: 'unavailable', message: 'Too many requests. Please retry shortly.' }, 429);
  }

  let gstin = '';
  try {
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { gstin?: unknown };
      gstin = typeof body.gstin === 'string' ? body.gstin : '';
    } else {
      const form = await request.formData();
      gstin = String(form.get('gstin') ?? '');
    }
  } catch {
    return json({ kind: 'invalid', gstin: '', reason: 'format' }, 400);
  }

  if (!gstin.trim()) {
    return json({ kind: 'invalid', gstin: '', reason: 'format' }, 400);
  }

  try {
    const outcome = await getVerificationService().verify(gstin);
    return json(outcome);
  } catch (error) {
    // Never surface internals or block checkout.
    // eslint-disable-next-line no-console
    console.error('proxy.verify failed', error);
    return json({
      kind: 'unavailable',
      gstin: gstin.trim(),
      message: 'Verification is temporarily unavailable.',
    });
  }
};
