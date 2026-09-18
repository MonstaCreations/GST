import '@shopify/shopify-app-react-router/adapters/node';
import { ApiVersion, AppDistribution, shopifyApp } from '@shopify/shopify-app-react-router/server';
import { PrismaSessionStorage } from '@shopify/shopify-app-session-storage-prisma';
import prisma from './db.server';
import { ensureMetafieldDefinitions } from './lib/metafields/ensure.server';

// GST Engine API version. Kept in sync with shopify.app.toml [webhooks].api_version.
// July26 (2026-07) is the latest version supported by the installed SDK; the CLI's
// default of 2026-10 is not yet in @shopify/shopify-api. See docs/DECISIONS.md D12.
const GST_API_VERSION = ApiVersion.July26;

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || '',
  apiVersion: GST_API_VERSION,
  scopes: process.env.SCOPES?.split(','),
  appUrl: process.env.SHOPIFY_APP_URL || '',
  authPathPrefix: '/auth',
  sessionStorage: new PrismaSessionStorage(prisma),
  // ⚠️ Distribution decision pending (docs/DECISIONS.md D13): intended production use is a
  // CUSTOM / single-merchant app for Rinstruments. Left as AppStore until the Dev Dashboard
  // distribution is confirmed — DO NOT switch silently (changing this affects install flow
  // and mandatory compliance webhooks).
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  hooks: {
    afterAuth: async ({ session }) => {
      // Ensure GST metafield definitions exist. Idempotent; never block auth on failure.
      try {
        const { admin } = await shopify.unauthenticated.admin(session.shop);
        await ensureMetafieldDefinitions(admin.graphql);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('afterAuth: ensureMetafieldDefinitions failed', error);
      }
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = GST_API_VERSION;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
