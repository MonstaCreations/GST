import type { Iso8601 } from '@gst-engine/shared';

/** A registered address as returned/normalized from GST records. */
export interface Address {
  line: string;
  city: string;
  state: string;
  stateCode: string;
  pincode?: string;
}

/** Buyer GST details captured on an order (basis of the immutable snapshot). */
export interface BuyerGstDetails {
  gstin: string;
  legalName: string;
  tradeName?: string;
  address: Address;
  verificationStatus: 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'NOT_FOUND';
  verifiedAt?: Iso8601;
}

/** Seller GST registration (from app-installation settings). */
export interface SellerGstConfig {
  legalName: string;
  gstin: string;
  address: Address;
}
