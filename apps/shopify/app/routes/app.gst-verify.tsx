/**
 * Admin-only GST verification test page.
 *
 * Lets us enter a real company GSTIN and exercise the configured provider
 * (FinAGG in production) end to end, through exactly the same verification service
 * the storefront App Proxy uses. Merchant-admin authenticated, so it is never
 * publicly reachable, and it renders only the normalized result — the FinAGG API key
 * is read server-side and never crosses into the loader/action payload.
 */
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from 'react-router';
import { useFetcher, useLoaderData } from 'react-router';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { authenticate } from '../shopify.server';
import { describeGstProvider, getVerificationService } from '../lib/gst/provider.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { config: describeGstProvider() };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const form = await request.formData();
  const gstin = String(form.get('gstin') ?? '');
  if (!gstin.trim()) {
    return { outcome: { kind: 'invalid' as const, gstin: '', reason: 'format' as const } };
  }

  const startedAt = Date.now();
  const outcome = await getVerificationService().verify(gstin);
  return { outcome, durationMs: Date.now() - startedAt };
};

export default function GstVerifyTestPage() {
  const fetcher = useFetcher<typeof action>();
  const { config } = useLoaderData<typeof loader>();
  const busy = fetcher.state !== 'idle';
  const outcome = fetcher.data?.outcome;

  return (
    <s-page heading="GST verification test">
      <s-section heading="Test a GSTIN">
        <s-paragraph>
          Runs a real verification through the configured provider, using the same service the
          storefront calls. Enter a valid company GSTIN.
        </s-paragraph>
        <fetcher.Form method="post">
          <s-stack direction="block" gap="base">
            <s-text-field
              label="GSTIN"
              name="gstin"
              placeholder="27AAPFU0939F1ZV"
              maxLength={15}
              autocomplete="off"
            />
            <s-button type="submit" variant="primary" {...(busy ? { loading: true } : {})}>
              Verify
            </s-button>
          </s-stack>
        </fetcher.Form>
      </s-section>

      {outcome && (
        <s-section heading="Result">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              <s-text>Outcome: </s-text>
              <s-badge tone={outcome.kind === 'verified' ? 'success' : 'warning'}>
                {outcome.kind}
              </s-badge>
              {typeof fetcher.data?.durationMs === 'number' && (
                <s-text> · {fetcher.data.durationMs} ms</s-text>
              )}
            </s-paragraph>
            <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                <code>{JSON.stringify(outcome, null, 2)}</code>
              </pre>
            </s-box>
          </s-stack>
        </s-section>
      )}

      <s-section slot="aside" heading="Active provider">
        <s-paragraph>
          <s-text>Provider: </s-text>
          <s-badge>{config.provider}</s-badge>
        </s-paragraph>
        {config.provider === 'finagg' && (
          <>
            <s-paragraph>
              <s-text>Endpoint: </s-text>
              <code>{config.endpoint}</code>
            </s-paragraph>
            <s-paragraph>
              <s-text>API key: </s-text>
              <s-badge tone={config.apiKeyConfigured ? 'success' : 'critical'}>
                {config.apiKeyConfigured ? 'configured' : 'missing'}
              </s-badge>
            </s-paragraph>
          </>
        )}
        <s-paragraph>
          Set <code>GST_PROVIDER=finagg</code> with the FinAGG environment variables to test
          against the live API. The API key is never exposed to this page.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
