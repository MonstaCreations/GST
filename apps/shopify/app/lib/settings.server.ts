/**
 * Seller GST settings — stored in app-installation metafields (namespace "settings").
 * App-owned data (no definition needed). Business data stays Shopify-native; nothing
 * here goes into Prisma.
 */
import { gql, type AdminGraphql } from './shopify/graphql';

export interface SellerSettings {
  sellerLegalName: string;
  sellerGstin: string;
  sellerState: string;
  sellerStateCode: string;
  sellerAddress: string;
  sellerPincode: string;
  logoUrl: string;
  invoicePrefix: string;
  financialYear: string;
  nextInvoiceSeq: number;
  gstProvider: string;
  taxConfig: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  bankBranch: string;
}

type MetaType = 'single_line_text_field' | 'multi_line_text_field' | 'number_integer' | 'json';

interface FieldSpec {
  key: string;
  field: keyof SellerSettings;
  type: MetaType;
}

const FIELDS: FieldSpec[] = [
  { key: 'seller_legal_name', field: 'sellerLegalName', type: 'single_line_text_field' },
  { key: 'seller_gstin', field: 'sellerGstin', type: 'single_line_text_field' },
  { key: 'seller_state', field: 'sellerState', type: 'single_line_text_field' },
  { key: 'seller_state_code', field: 'sellerStateCode', type: 'single_line_text_field' },
  { key: 'seller_address', field: 'sellerAddress', type: 'multi_line_text_field' },
  { key: 'seller_pincode', field: 'sellerPincode', type: 'single_line_text_field' },
  { key: 'logo_url', field: 'logoUrl', type: 'single_line_text_field' },
  { key: 'invoice_prefix', field: 'invoicePrefix', type: 'single_line_text_field' },
  { key: 'financial_year', field: 'financialYear', type: 'single_line_text_field' },
  { key: 'next_invoice_seq', field: 'nextInvoiceSeq', type: 'number_integer' },
  { key: 'gst_provider', field: 'gstProvider', type: 'single_line_text_field' },
  { key: 'tax_config', field: 'taxConfig', type: 'json' },
  { key: 'bank_name', field: 'bankName', type: 'single_line_text_field' },
  { key: 'bank_account', field: 'bankAccount', type: 'single_line_text_field' },
  { key: 'bank_ifsc', field: 'bankIfsc', type: 'single_line_text_field' },
  { key: 'bank_branch', field: 'bankBranch', type: 'single_line_text_field' },
];

export const DEFAULT_SETTINGS: SellerSettings = {
  sellerLegalName: '',
  sellerGstin: '',
  sellerState: '',
  sellerStateCode: '',
  sellerAddress: '',
  sellerPincode: '',
  logoUrl: '',
  invoicePrefix: 'INV',
  financialYear: '',
  nextInvoiceSeq: 1,
  gstProvider: 'mock',
  taxConfig: '{}',
  bankName: '',
  bankAccount: '',
  bankIfsc: '',
  bankBranch: '',
};

const READ_QUERY = `#graphql
  query ReadGstSettings {
    currentAppInstallation {
      id
      metafields(first: 25, namespace: "settings") {
        edges { node { key value } }
      }
    }
  }
`;

const WRITE_MUTATION = `#graphql
  mutation SetGstSettings($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors { field message }
    }
  }
`;

interface ReadResult {
  currentAppInstallation: {
    id: string;
    metafields: { edges: { node: { key: string; value: string } }[] };
  };
}

export async function readSettings(admin: AdminGraphql): Promise<SellerSettings> {
  const data = await gql<ReadResult>(admin, READ_QUERY);
  const values = new Map(
    data.currentAppInstallation.metafields.edges.map((e) => [e.node.key, e.node.value]),
  );
  const out: SellerSettings = { ...DEFAULT_SETTINGS };
  for (const spec of FIELDS) {
    const raw = values.get(spec.key);
    if (raw === undefined) continue;
    if (spec.field === 'nextInvoiceSeq') {
      const n = Number.parseInt(raw, 10);
      out.nextInvoiceSeq = Number.isFinite(n) ? n : DEFAULT_SETTINGS.nextInvoiceSeq;
    } else {
      out[spec.field] = raw as never;
    }
  }
  return out;
}

async function appInstallationId(admin: AdminGraphql): Promise<string> {
  const data = await gql<{ currentAppInstallation: { id: string } }>(
    admin,
    `#graphql
      query AppInstallationId { currentAppInstallation { id } }
    `,
  );
  return data.currentAppInstallation.id;
}

/** Write the provided settings fields (partial). Idempotent. */
export async function writeSettings(
  admin: AdminGraphql,
  patch: Partial<SellerSettings>,
): Promise<{ ok: boolean; errors: string[] }> {
  const ownerId = await appInstallationId(admin);
  const metafields = FIELDS.filter((s) => patch[s.field] !== undefined).map((s) => ({
    ownerId,
    namespace: 'settings',
    key: s.key,
    type: s.type,
    value: String(patch[s.field]),
  }));
  if (metafields.length === 0) return { ok: true, errors: [] };

  const data = await gql<{ metafieldsSet: { userErrors: { message: string }[] } }>(
    admin,
    WRITE_MUTATION,
    { metafields },
  );
  const errors = data.metafieldsSet.userErrors.map((e) => e.message);
  return { ok: errors.length === 0, errors };
}
