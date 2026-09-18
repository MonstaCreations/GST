/**
 * @gst-engine/pdf — invoice HTML template + serverless-safe PDF rendering.
 * PdfLibRenderer (pdf-lib) is the default; no Chromium/Puppeteer dependency
 * (DECISIONS.md D14). The renderer is behind the PdfRenderer interface so it can
 * be swapped without touching callers.
 */
export * from './types';
export * from './template';
export * from './pdf-lib-renderer';
