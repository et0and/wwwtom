import { Elysia } from "elysia";
import { Schema } from "effect";

/**
 * Simulated apps/api surface. The adapter's polar integration proxies
 * /checkout and /portal to the internal API via callApi; in simulator mode
 * that call is pointed at this server, so a single checkout counter keeps
 * the redirect URLs unique per e2e run.
 */
let checkoutCounter = 0;

const checkoutQuery = Schema.toStandardSchemaV1(
  Schema.Struct({
    products: Schema.String,
    customerId: Schema.optional(Schema.String),
    customerEmail: Schema.optional(Schema.String),
  }),
);

const portalQuery = Schema.toStandardSchemaV1(Schema.Struct({ customerId: Schema.String }));

const checkoutUrl = (
  products: string,
  checkoutId: string,
  query: { customerId?: string; customerEmail?: string },
) => {
  const parts = [
    `checkout=${checkoutId}`,
    `products=${encodeURIComponent(products)}`,
    ...(query.customerId ? [`customerId=${encodeURIComponent(query.customerId)}`] : []),
    ...(query.customerEmail ? [`customerEmail=${encodeURIComponent(query.customerEmail)}`] : []),
    "theme=light",
  ];
  return `https://checkout.simulator.dev/pay?${parts.join("&")}`;
};

export const apiSimulator = new Elysia({ name: "api-simulator" })
  .get(
    "/checkout",
    ({ query, set }) => {
      const products = query.products.split(",").filter(Boolean);
      if (products.length === 0) {
        set.status = 400;
        return { error: "Missing products parameter" };
      }
      checkoutCounter += 1;
      return Response.redirect(
        checkoutUrl(products.join(","), `sim_checkout_${checkoutCounter}`, {
          customerId: query.customerId,
          customerEmail: query.customerEmail,
        }),
        302,
      );
    },
    {
      query: checkoutQuery,
      detail: { description: "Simulated API create checkout redirect", tags: ["api"] },
    },
  )
  .get(
    "/portal",
    ({ query }) =>
      Response.redirect(
        `https://checkout.simulator.dev/portal?customerId=${encodeURIComponent(query.customerId)}`,
        302,
      ),
    {
      query: portalQuery,
      detail: { description: "Simulated API customer portal redirect", tags: ["api"] },
    },
  );
