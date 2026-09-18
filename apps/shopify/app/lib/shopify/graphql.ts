/**
 * Thin helper over the Shopify Admin GraphQL client returned by
 * `authenticate.admin(request)` / `authenticate.webhook(request)`.
 */
export type AdminGraphql = (
  query: string,
  options?: { variables?: Record<string, unknown> },
) => Promise<Response>;

export async function gql<T>(
  admin: AdminGraphql,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await admin(query, variables ? { variables } : undefined);
  const body = (await res.json()) as { data?: T; errors?: unknown };
  if (!body.data) {
    throw new Error(`GraphQL error: ${JSON.stringify(body.errors ?? 'no data')}`);
  }
  return body.data;
}
