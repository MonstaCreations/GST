/**
 * Structured server logger. One line per event, with a machine-readable meta object,
 * so Vercel's log drain can be queried by field.
 *
 * Server-only: never import this from a component. Callers are responsible for not
 * passing secrets or unnecessary taxpayer data — GSTINs are masked at the call site
 * (see `maskGstin` in @gst-engine/gst).
 */
import type { Logger } from '@gst-engine/shared';

/* eslint-disable no-console */
export const serverLogger: Logger = {
  debug: (message, meta) => console.debug(message, meta ?? {}),
  info: (message, meta) => console.info(message, meta ?? {}),
  warn: (message, meta) => console.warn(message, meta ?? {}),
  error: (message, meta) => console.error(message, meta ?? {}),
};
/* eslint-enable no-console */
