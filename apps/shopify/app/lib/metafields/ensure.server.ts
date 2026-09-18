/**
 * Creates the GST metafield definitions in Shopify (idempotent).
 * Called from afterAuth. Definitions that already exist are skipped silently.
 */
import { GST_METAFIELD_DEFINITIONS } from './definitions';

// Minimal shape of the Admin GraphQL client provided by the Shopify app package.
type AdminGraphql = (
  query: string,
  options?: { variables?: Record<string, unknown> },
) => Promise<Response>;

const CREATE_MUTATION = `#graphql
  mutation CreateGstMetafieldDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id }
      userErrors { field message code }
    }
  }
`;

/** "already exists" style errors we treat as success. */
const IGNORABLE_CODES = new Set(['TAKEN', 'PRESENT']);

export async function ensureMetafieldDefinitions(graphql: AdminGraphql): Promise<void> {
  for (const def of GST_METAFIELD_DEFINITIONS) {
    const response = await graphql(CREATE_MUTATION, {
      variables: {
        definition: {
          name: def.name,
          namespace: def.namespace,
          key: def.key,
          description: def.description,
          type: def.type,
          ownerType: def.ownerType,
        },
      },
    });
    const body = (await response.json()) as {
      data?: {
        metafieldDefinitionCreate?: {
          userErrors?: { code?: string | null; message: string }[];
        };
      };
    };
    const errors = body.data?.metafieldDefinitionCreate?.userErrors ?? [];
    const blocking = errors.filter((e) => !IGNORABLE_CODES.has(e.code ?? ''));
    if (blocking.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        `metafield definition ${def.ownerType} ${def.namespace}.${def.key} errors:`,
        blocking,
      );
    }
  }
}
