/**
 * @gst-engine/gst — GSTIN validation + verification provider abstraction.
 * The only external dependency of the system lives behind this interface.
 * See docs/GST_PROVIDER.md.
 */
export * from './provider';
export * from './gstin';
export * from './normalize';
export * from './mock-provider';
export * from './gstverify-provider';
export * from './verify-service';
