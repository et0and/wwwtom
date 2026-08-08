import { Elysia } from "elysia";
import { Schema } from "effect";
import polarProducts from "../fixtures/polar-products.json" with { type: "json" };

const pagination = {
  current_page: 1,
  next_page: null,
  prev_page: null,
  per_page: 10,
  total_pages: 1,
  total_count: polarProducts.length,
  has_more_pages: false,
};

type SimulatedCustomer = {
  id: string;
  email: string;
  name: string | null;
  external_id: string | null;
};

// Runtime-mutated store (customers are created via the API).
const customers: SimulatedCustomer[] = [];

export const polarSimulator = new Elysia({ name: "polar-simulator" })
  .get(
    "/v1/products",
    ({ query }) => {
      if (query.is_archived !== "false") {
        return { items: [] };
      }
      return { items: polarProducts };
    },
    {
      query: Schema.toStandardSchemaV1(
        Schema.Struct({ is_archived: Schema.optional(Schema.String) }),
      ),
      detail: { description: "Simulated Polar list products", tags: ["polar"] },
    },
  )
  .get(
    "/v1/products/:id",
    ({ params, set }) => {
      const product = polarProducts.find((p) => p.id === params.id);
      if (!product) {
        set.status = 404;
        return { detail: [{ loc: ["product"], msg: "Not found" }] };
      }
      return product;
    },
    {
      params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String })),
      detail: { description: "Simulated Polar get product", tags: ["polar"] },
    },
  )
  .post(
    "/v1/customers",
    ({ body, set }) => {
      const existing = customers.find((c) => c.email === body.email);
      if (existing) {
        set.status = 422;
        return { detail: "Customer with this email already exists" };
      }
      const customer: SimulatedCustomer = {
        id: `sim_customer_${customers.length + 1}`,
        email: body.email,
        name: body.name ?? null,
        external_id: body.external_id ?? null,
      };
      customers.push(customer);
      return customer;
    },
    {
      body: Schema.toStandardSchemaV1(
        Schema.Struct({
          email: Schema.String,
          name: Schema.optional(Schema.String),
          external_id: Schema.optional(Schema.String),
        }),
      ),
      detail: { description: "Simulated Polar create customer", tags: ["polar"] },
    },
  )
  .get(
    "/v1/customers",
    ({ query }) => {
      const email = query.email;
      const items = email ? customers.filter((c) => c.email === email) : customers;
      return { items, pagination };
    },
    {
      query: Schema.toStandardSchemaV1(Schema.Struct({ email: Schema.optional(Schema.String) })),
      detail: { description: "Simulated Polar list customers", tags: ["polar"] },
    },
  )
  .post(
    "/v1/checkouts",
    ({ body }) => ({
      id: "sim_checkout_1",
      url: `https://checkout.simulator.dev/pay?checkout=sim_checkout_1&products=${body.products.join(",")}`,
    }),
    {
      body: Schema.toStandardSchemaV1(
        Schema.Struct({
          products: Schema.Array(Schema.String),
          successUrl: Schema.optional(Schema.String),
          customerId: Schema.optional(Schema.String),
          customerEmail: Schema.optional(Schema.String),
        }),
      ),
      detail: { description: "Simulated Polar create checkout", tags: ["polar"] },
    },
  )
  .post(
    "/v1/customer-sessions",
    ({ body }) => ({
      customer_portal_url: `https://portal.simulator.dev/customers/${body.customerId}`,
    }),
    {
      body: Schema.toStandardSchemaV1(
        Schema.Struct({
          customerId: Schema.String,
          returnUrl: Schema.optional(Schema.String),
        }),
      ),
      detail: { description: "Simulated Polar create customer session", tags: ["polar"] },
    },
  );
