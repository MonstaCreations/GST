import type { Config } from '@react-router/dev/config';
import { vercelPreset } from '@vercel/react-router/vite';

// SSR app. On Vercel (`vercel-build`), apply the Vercel preset so `react-router build`
// emits Vercel Build Output. Locally, `pnpm build` produces the standard Node server
// build (served by @react-router/serve / `shopify app dev`), so the app stays fully
// testable without Vercel. See docs/DEPLOYMENT.md.
export default {
  ssr: true,
  presets: process.env.VERCEL ? [vercelPreset()] : [],
} satisfies Config;
