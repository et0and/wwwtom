import { Schema } from "effect";

/**
 * Boundary contracts for the Polar API (2026-04) endpoints this app calls.
 * Each schema models the fields this app consumes; Struct strips the
 * remaining Polar fields. Field names follow the Polar docs, not local
 * conventions.
 *
 * @see https://polar.sh/docs/api-reference/2026-04/checkouts/create-checkout-session
 * @see https://polar.sh/docs/api-reference/2026-04/customer-sessions/create-customer-session
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
