import { Schema } from "effect";

/**
 * Boundary contracts for the Polar API (2026-04) endpoints this app calls.
 * Each schema models the fields this app consumes; Struct strips the
 * remaining Polar fields. Field names follow the Polar docs, not local
 * conventions.
 *
 * @see https://polar.sh/docs/api-reference/2026-04/checkouts/create-checkout-session
 * @see https://polar.sh/docs/api-reference/2026-04/customer-sessions/create-customer-session
 * @see https://polar.sh/docs/api-reference/2026-04/products/list-products
 * @see https://polar.sh/docs/api-reference/2026-04/customers/create-customer
 */

/** POST /v1/checkouts/ → 201 Checkout. This app consumes `url`. */
const PolarCheckoutSchema = Schema.Struct({
  url: Schema.String.pipe(
    Schema.annotate({ description: "URL where the customer can access the checkout session." }),
  ),
});

export const polarCheckoutSchema = PolarCheckoutSchema;

export type PolarCheckout = Schema.Schema.Type<typeof PolarCheckoutSchema>;

/** POST /v1/customer-sessions/ → 201 CustomerSession. This app consumes `customer_portal_url`. */
const PolarCustomerSessionSchema = Schema.Struct({
  customer_portal_url: Schema.String.pipe(
    Schema.annotate({ description: "Customer portal URL for the created session." }),
  ),
});

export const polarCustomerSessionSchema = PolarCustomerSessionSchema;

export type PolarCustomerSession = Schema.Schema.Type<typeof PolarCustomerSessionSchema>;

/** Media file attached to a product. This app consumes `public_url`. */
const PolarProductMediaSchema = Schema.Struct({
  id: Schema.String,
  public_url: Schema.String,
});

/** Price entry on a product. This app passes prices through unread. */
const PolarProductPriceSchema = Schema.Struct({
  price_amount: Schema.Number,
  price_currency: Schema.String,
});

/** GET /v1/products/ → 200 ListResource[Product]. */
const PolarProductSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  medias: Schema.Array(PolarProductMediaSchema),
  prices: Schema.Array(PolarProductPriceSchema),
});

export const polarProductSchema = PolarProductSchema;

export type PolarProduct = Schema.Schema.Type<typeof PolarProductSchema>;

const PolarProductsResponseSchema = Schema.Struct({
  items: Schema.Array(PolarProductSchema),
});

export const polarProductsResponseSchema = PolarProductsResponseSchema;

export type PolarProductsResponse = Schema.Schema.Type<typeof PolarProductsResponseSchema>;

/** POST /v1/customers/ → 201 Customer. This app consumes `id`. */
const PolarCustomerSchema = Schema.Struct({
  id: Schema.String,
});

export const polarCustomerSchema = PolarCustomerSchema;

export type PolarCustomer = Schema.Schema.Type<typeof PolarCustomerSchema>;

const PolarCustomersResponseSchema = Schema.Struct({
  items: Schema.Array(PolarCustomerSchema),
});

export const polarCustomersResponseSchema = PolarCustomersResponseSchema;

export type PolarCustomersResponse = Schema.Schema.Type<typeof PolarCustomersResponseSchema>;
