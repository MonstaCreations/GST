/**
 * Persists GST data captured on the storefront onto the order and the customer.
 *
 * Source of the buyer's input: the theme app extension writes cart attributes via
 * `/cart/update.js`, which Shopify surfaces on the order as `note_attributes`.
 *
 * ## Why this re-verifies
 *
 * Cart attributes are **client-writable** — any shopper can POST arbitrary values to
 * `/cart/update.js`, including a legal name and address that were never verified. So
 * nothing the buyer sends is trusted here: the GSTIN is re-validated and re-verified
 * server-side, and the snapshot's authoritative fields are filled from the *provider's*
 * response, never from the cart attributes. When verification does not yield
 * authoritative data, the buyer's values are preserved under `claimed` and the snapshot
 * is marked unverified, so downstream invoicing can never mistake a claim for a fact.
 *
 * ## Idempotency
 *
 * The order GST snapshot is immutable: if `gst.snapshot` already exists on the order,
 * this is a no-op. That is the durable guard; `claimWebhook` only collapses retries
 * within one instance.
 *
 * The customer GST profile is *not* immutable — it is the latest verified profile, and
 * is written only when verification returned authoritative taxpayer data.
 */
import {
  maskGstin,
  stateCodeFromGstin,
  type VerificationOutcome,
} from '@gst-engine/gst';
import type { Logger } from '@gst-engine/shared';
import { gql, type AdminGraphql } from '../shopify/graphql';
import { getVerificationService } from './provider.server';

/** Cart attribute names written by extensions/theme-gst-ui/assets/gst-invoice.js. */
export const GST_CART_ATTRIBUTES = {
  optIn: 'gst_invoice',
  gstin: 'gst_gstin',
  legalName: 'gst_legal_name',
  registeredAddress: 'gst_registered_address',
  city: 'gst_city',
  state: 'gst_state',
  stateCode: 'gst_state_code',
} as const;

/** Exactly what the buyer sent. Never authoritative. */
export interface GstClaim {
  gstin: string;
  legalName: string;
  registeredAddress: string;
  city: string;
  state: string;
  stateCode: string;
}

export type OrderGstVerificationStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'CANCELLED'
  | 'NOT_FOUND'
  | 'INVALID'
  | 'UNVERIFIED';

export interface OrderGstSnapshot {
  gstin: string;
  legalName: string;
  tradeName?: string;
  registeredAddress: string;
  city: string;
  state: string;
  stateCode: string;
  pincode?: string;
  verificationStatus: OrderGstVerificationStatus;
  /** ISO 8601, or null when this snapshot is not backed by a successful verification. */
  verifiedAt: string | null;
  provider: string | null;
  capturedAt: string;
  /** Buyer-supplied cart attributes, kept only when verification was not authoritative. */
  claimed?: GstClaim;
}

interface NoteAttribute {
  name?: unknown;
  value?: unknown;
}

interface OrderWebhookPayload {
  admin_graphql_api_id?: unknown;
  note_attributes?: unknown;
}

function attributeMap(payload: OrderWebhookPayload): Map<string, string> {
  const map = new Map<string, string>();
  const raw = payload.note_attributes;
  if (!Array.isArray(raw)) return map;
  for (const entry of raw as NoteAttribute[]) {
    if (typeof entry?.name === 'string' && typeof entry.value === 'string') {
      map.set(entry.name, entry.value);
    }
  }
  return map;
}

/** The order's GraphQL id, or null if the payload did not carry one. */
export function orderGidFromPayload(payload: OrderWebhookPayload): string | null {
  const id = payload.admin_graphql_api_id;
  return typeof id === 'string' && id !== '' ? id : null;
}

/**
 * Read the buyer's GST claim from an order payload, or null when the buyer did not
 * opt in / sent no GSTIN.
 */
export function readGstClaim(payload: OrderWebhookPayload): GstClaim | null {
  const attrs = attributeMap(payload);
  if ((attrs.get(GST_CART_ATTRIBUTES.optIn) ?? '').toLowerCase() !== 'true') return null;

  const gstin = (attrs.get(GST_CART_ATTRIBUTES.gstin) ?? '').trim();
  if (!gstin) return null;

  return {
    gstin,
    legalName: attrs.get(GST_CART_ATTRIBUTES.legalName) ?? '',
    registeredAddress: attrs.get(GST_CART_ATTRIBUTES.registeredAddress) ?? '',
    city: attrs.get(GST_CART_ATTRIBUTES.city) ?? '',
    state: attrs.get(GST_CART_ATTRIBUTES.state) ?? '',
    stateCode: attrs.get(GST_CART_ATTRIBUTES.stateCode) ?? '',
  };
}

function unverifiedSnapshot(
  gstin: string,
  status: OrderGstVerificationStatus,
  claim: GstClaim,
  capturedAt: string,
): OrderGstSnapshot {
  return {
    gstin,
    legalName: '',
    registeredAddress: '',
    city: '',
    state: '',
    stateCode: stateCodeFromGstin(gstin),
    verificationStatus: status,
    verifiedAt: null,
    provider: null,
    capturedAt,
    claimed: claim,
  };
}

/** Turn a verification outcome into the snapshot we store on the order. */
export function buildOrderGstSnapshot(
  outcome: VerificationOutcome,
  claim: GstClaim,
  capturedAt: string,
): OrderGstSnapshot {
  switch (outcome.kind) {
    case 'verified':
    case 'inactive': {
      const r = outcome.result;
      const snapshot: OrderGstSnapshot = {
        gstin: r.gstin,
        legalName: r.legalName,
        registeredAddress: r.registeredAddress,
        city: r.city,
        state: r.state,
        stateCode: r.stateCode,
        verificationStatus: r.status,
        verifiedAt: r.verifiedAt,
        provider: r.provider,
        capturedAt,
      };
      if (r.tradeName !== undefined) snapshot.tradeName = r.tradeName;
      if (r.pincode !== undefined) snapshot.pincode = r.pincode;
      return snapshot;
    }
    case 'not_found':
      return unverifiedSnapshot(outcome.gstin, 'NOT_FOUND', claim, capturedAt);
    case 'invalid':
      return unverifiedSnapshot(outcome.gstin, 'INVALID', claim, capturedAt);
    case 'unavailable':
      return unverifiedSnapshot(outcome.gstin, 'UNVERIFIED', claim, capturedAt);
  }
}

/** True when the provider returned real taxpayer data we can save as a profile. */
function isAuthoritative(snapshot: OrderGstSnapshot): boolean {
  return snapshot.provider !== null && snapshot.verifiedAt !== null;
}

const ORDER_STATE_QUERY = `#graphql
  query OrderGstState($id: ID!) {
    order(id: $id) {
      id
      customer { id }
      metafield(namespace: "gst", key: "snapshot") { id }
    }
  }
`;

const SET_MUTATION = `#graphql
  mutation SetOrderGstMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors { field message }
    }
  }
`;

interface OrderStateResult {
  order: {
    id: string;
    customer: { id: string } | null;
    metafield: { id: string } | null;
  } | null;
}

interface MetafieldInput {
  ownerId: string;
  namespace: string;
  key: string;
  type: string;
  value: string;
}

function customerProfileMetafields(ownerId: string, s: OrderGstSnapshot): MetafieldInput[] {
  const text = (key: string, value: string): MetafieldInput => ({
    ownerId,
    namespace: 'gst',
    key,
    type: 'single_line_text_field',
    value,
  });

  const fields: MetafieldInput[] = [
    text('gstin', s.gstin),
    text('legal_name', s.legalName),
    text('city', s.city),
    text('state', s.state),
    text('state_code', s.stateCode),
    text('verification_status', s.verificationStatus),
    {
      ownerId,
      namespace: 'gst',
      key: 'registered_address',
      type: 'multi_line_text_field',
      value: s.registeredAddress,
    },
  ];
  if (s.tradeName) fields.push(text('trade_name', s.tradeName));
  if (s.pincode) fields.push(text('pincode', s.pincode));
  if (s.verifiedAt) {
    fields.push({
      ownerId,
      namespace: 'gst',
      key: 'verified_at',
      type: 'date_time',
      value: s.verifiedAt,
    });
  }
  return fields;
}

export type PersistOrderGstResult =
  | { status: 'no_claim' }
  | { status: 'already_captured' }
  | { status: 'order_not_found' }
  | { status: 'written'; snapshot: OrderGstSnapshot; customerProfileWritten: boolean }
  | { status: 'failed'; errors: string[] };

/**
 * Capture the buyer's GST details onto the order (and, when verified, the customer).
 *
 * Never throws: a webhook must still return 2xx so Shopify does not retry forever on a
 * permanent failure. Failures are logged and reported in the result.
 */
export async function persistOrderGst(
  graphql: AdminGraphql,
  payload: OrderWebhookPayload,
  logger: Logger,
  now: () => Date = () => new Date(),
): Promise<PersistOrderGstResult> {
  const claim = readGstClaim(payload);
  if (!claim) return { status: 'no_claim' };

  const orderGid = orderGidFromPayload(payload);
  if (!orderGid) return { status: 'order_not_found' };

  try {
    const state = await gql<OrderStateResult>(graphql, ORDER_STATE_QUERY, { id: orderGid });
    if (!state.order) return { status: 'order_not_found' };

    // Durable idempotency: the order snapshot is immutable once written.
    if (state.order.metafield) {
      logger.info('gst.order.snapshot.skipped', { reason: 'already_captured', order: orderGid });
      return { status: 'already_captured' };
    }

    const outcome = await getVerificationService().verify(claim.gstin);
    const snapshot = buildOrderGstSnapshot(outcome, claim, now().toISOString());

    const metafields: MetafieldInput[] = [
      {
        ownerId: orderGid,
        namespace: 'gst',
        key: 'snapshot',
        type: 'json',
        value: JSON.stringify(snapshot),
      },
    ];

    const customerId = state.order.customer?.id;
    const writeProfile = Boolean(customerId) && isAuthoritative(snapshot);
    if (customerId && writeProfile) {
      metafields.push(...customerProfileMetafields(customerId, snapshot));
    }

    const result = await gql<{ metafieldsSet: { userErrors: { message: string }[] } }>(
      graphql,
      SET_MUTATION,
      { metafields },
    );
    const errors = result.metafieldsSet.userErrors.map((e) => e.message);
    if (errors.length > 0) {
      logger.error('gst.order.snapshot.failed', { order: orderGid, errors });
      return { status: 'failed', errors };
    }

    logger.info('gst.order.snapshot.written', {
      order: orderGid,
      gstin: maskGstin(snapshot.gstin),
      verificationStatus: snapshot.verificationStatus,
      customerProfileWritten: writeProfile,
    });
    return { status: 'written', snapshot, customerProfileWritten: writeProfile };
  } catch (error) {
    logger.error('gst.order.snapshot.error', {
      order: orderGid,
      errorName: error instanceof Error ? error.name : 'unknown',
    });
    return { status: 'failed', errors: ['gst snapshot persistence failed'] };
  }
}
