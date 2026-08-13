/**
 * Header the adapter sends when calling the Tom API's internal routes.
 * The value must match `INTERNAL_API_TOKEN` from TOM_SECRETS; the API
 * verifies it before serving `/og`, `/checkout`, and `/portal`.
 */
export const INTERNAL_TOKEN_HEADER = "x-internal-token";
