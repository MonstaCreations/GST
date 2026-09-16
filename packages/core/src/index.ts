/**
 * @gst-engine/core — shared domain primitives and contracts.
 * Phase 0: types + interfaces + stubs only. No business logic (see milestones).
 */
import type { Iso8601 } from '@gst-engine/shared';

export * from '@gst-engine/shared';

// ---------------------------------------------------------------------------
// Money — decimal-safe. All monetary amounts are integer **paise** to avoid
// floating-point drift (see DECISIONS.md / tax engine).
// ---------------------------------------------------------------------------

/** A monetary amount in integer paise (100 paise = ₹1). */
export type Paise = number & { readonly __brand: 'Paise' };

/** TODO(M5): implement decimal-safe constructors/arithmetic + rounding. */
export declare function rupeesToPaise(rupees: number | string): Paise;
export declare function paiseToRupees(paise: Paise): string;

// ---------------------------------------------------------------------------
// GST reference data
// ---------------------------------------------------------------------------

/**
 * GST state code → state name.
 * TODO(M2): populate the full GST state-code table (01–38, 97, 99).
 * Seeded with the seller's state for now.
 */
export const GST_STATE_CODES: Readonly<Record<string, string>> = {
  '27': 'Maharashtra',
};

// ---------------------------------------------------------------------------
// Shared domain models
// ---------------------------------------------------------------------------

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
