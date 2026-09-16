/**
 * Money — decimal-safe. All monetary amounts are integer **paise** (100 = ₹1) to
 * avoid floating-point drift (see DECISIONS.md / tax engine).
 */

/** A monetary amount in integer paise (100 paise = ₹1). */
export type Paise = number & { readonly __brand: 'Paise' };

/** TODO(M5): implement decimal-safe constructors/arithmetic + rounding. */
export declare function rupeesToPaise(rupees: number | string): Paise;
export declare function paiseToRupees(paise: Paise): string;
