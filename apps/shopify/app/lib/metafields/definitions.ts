/**
 * GST Engine metafield definitions (Shopify-native data model — docs/DATABASE.md).
 *
 * Pure data so it can be unit-tested without Shopify. Creation is performed by
 * ensure.server.ts. App-installation ("settings") data is app-owned and written
 * via metafieldsSet without a definition, so it is not listed here.
 */

export type MetafieldOwnerType = 'CUSTOMER' | 'PRODUCT' | 'ORDER';

export type MetafieldType =
  | 'single_line_text_field'
  | 'multi_line_text_field'
  | 'date_time'
  | 'number_decimal'
  | 'url'
  | 'json';

export interface MetafieldDefinitionSpec {
  ownerType: MetafieldOwnerType;
  namespace: string;
  key: string;
  name: string;
  type: MetafieldType;
  description: string;
}

export const GST_NAMESPACES = {
  customer: 'gst',
  product: 'tax',
  invoice: 'invoice',
  orderGst: 'gst',
  creditNote: 'credit_note',
  settings: 'settings',
} as const;

export const GST_METAFIELD_DEFINITIONS: readonly MetafieldDefinitionSpec[] = [
  // ---- Customer GST profile (namespace: gst) ----
  {
    ownerType: 'CUSTOMER',
    namespace: 'gst',
    key: 'gstin',
    name: 'GSTIN',
    type: 'single_line_text_field',
    description: '15-character GSTIN',
  },
  {
    ownerType: 'CUSTOMER',
    namespace: 'gst',
    key: 'legal_name',
    name: 'Legal name',
    type: 'single_line_text_field',
    description: 'Registered legal name',
  },
  {
    ownerType: 'CUSTOMER',
    namespace: 'gst',
    key: 'trade_name',
    name: 'Trade name',
    type: 'single_line_text_field',
    description: 'Trade name (optional)',
  },
  {
    ownerType: 'CUSTOMER',
    namespace: 'gst',
    key: 'registered_address',
    name: 'Registered address',
    type: 'multi_line_text_field',
    description: 'Registered place of business',
  },
  {
    ownerType: 'CUSTOMER',
    namespace: 'gst',
    key: 'city',
    name: 'City',
    type: 'single_line_text_field',
    description: 'City',
  },
  {
    ownerType: 'CUSTOMER',
    namespace: 'gst',
    key: 'state',
    name: 'State',
    type: 'single_line_text_field',
    description: 'State name',
  },
  {
    ownerType: 'CUSTOMER',
    namespace: 'gst',
    key: 'state_code',
    name: 'State code',
    type: 'single_line_text_field',
    description: '2-digit GST state code',
  },
  {
    ownerType: 'CUSTOMER',
    namespace: 'gst',
    key: 'pincode',
    name: 'Pincode',
    type: 'single_line_text_field',
    description: 'PIN code',
  },
  {
    ownerType: 'CUSTOMER',
    namespace: 'gst',
    key: 'verification_status',
    name: 'Verification status',
    type: 'single_line_text_field',
    description: 'ACTIVE | INACTIVE | CANCELLED | NOT_FOUND',
  },
  {
    ownerType: 'CUSTOMER',
    namespace: 'gst',
    key: 'verified_at',
    name: 'Verified at',
    type: 'date_time',
    description: 'Timestamp of last successful verification',
  },

  // ---- Product tax metadata (namespace: tax) ----
  {
    ownerType: 'PRODUCT',
    namespace: 'tax',
    key: 'hsn_code',
    name: 'HSN/SAC code',
    type: 'single_line_text_field',
    description: 'HSN or SAC code',
  },
  {
    ownerType: 'PRODUCT',
    namespace: 'tax',
    key: 'gst_rate',
    name: 'GST rate (%)',
    type: 'number_decimal',
    description: 'GST rate percentage, e.g. 18',
  },

  // ---- Order invoice metadata (namespace: invoice) ----
  {
    ownerType: 'ORDER',
    namespace: 'invoice',
    key: 'number',
    name: 'Invoice number',
    type: 'single_line_text_field',
    description: 'e.g. INV/2026-27/000001 (presence = invoice exists)',
  },
  {
    ownerType: 'ORDER',
    namespace: 'invoice',
    key: 'date',
    name: 'Invoice date',
    type: 'date_time',
    description: 'Invoice issue date',
  },
  {
    ownerType: 'ORDER',
    namespace: 'invoice',
    key: 'url',
    name: 'Invoice URL',
    type: 'url',
    description: 'Shopify Files URL of the invoice PDF',
  },
  {
    ownerType: 'ORDER',
    namespace: 'invoice',
    key: 'status',
    name: 'Invoice status',
    type: 'single_line_text_field',
    description: 'pending | issued | emailed | failed',
  },

  // ---- Order GST snapshot (namespace: gst) ----
  {
    ownerType: 'ORDER',
    namespace: 'gst',
    key: 'snapshot',
    name: 'GST snapshot',
    type: 'json',
    description: 'Immutable buyer/seller/line GST snapshot at issue time',
  },

  // ---- Order credit note reference (namespace: credit_note) ----
  {
    ownerType: 'ORDER',
    namespace: 'credit_note',
    key: 'reference',
    name: 'Credit note reference',
    type: 'json',
    description: 'Credit note number(s) + PDF link(s)',
  },
];
