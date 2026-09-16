/**
 * @gst-engine/storage — file storage behind an interface.
 * Phase 0: contract + stub. Shopify Files impl in M6.
 * Note (DECISIONS.md D6): Shopify Files serve from a public CDN URL. The
 * interface exists so PDFs can later move to private storage with signed URLs
 * without touching the invoice engine.
 */

export interface StoredFile {
  /** public URL (Shopify Files) or signed URL (future private storage) */
  url: string;
  /** provider-specific id/handle */
  id: string;
}

export interface Storage {
  readonly name: string;
  put(params: { filename: string; content: Uint8Array; contentType: string }): Promise<StoredFile>;
}

/** Uploads to Shopify Files via the Admin API. TODO(M6): implement. */
export class ShopifyFilesStorage implements Storage {
  readonly name = 'shopify-files';
  put(_params: {
    filename: string;
    content: Uint8Array;
    contentType: string;
  }): Promise<StoredFile> {
    throw new Error('ShopifyFilesStorage.put not implemented — M6');
  }
}
