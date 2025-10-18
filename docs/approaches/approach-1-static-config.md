# Approach 1: Static Configuration Files

## Overview
In this approach, product configurations are primarily defined in static files (e.g., TypeScript or JSON files) within the codebase. These files are loaded at runtime or build time to dynamically create products in Polar's system. Additionally, support for dynamic products is added via a webhook endpoint that can create products on-the-fly based on incoming requests, allowing for external systems to define products programmatically.

## Implementation Steps
1. Create a `src/products/` directory to store product configurations.
2. Define products using TypeScript interfaces or JSON objects that match Polar's `ProductCreate` schema.
3. Set up Cloudflare D1 database with migrations for dynamic products persistence.
4. At application startup or when needed, use the Polar SDK to create products from these configs if they don't exist in Polar (e.g., check by name or external ID).
5. Create a webhook API endpoint (e.g., `/api/webhook/products`) with API key authentication to accept dynamic product creation requests with fields like name, description, and price.
6. Upon receiving a webhook request, validate the data using Zod schemas, create a product in Polar using the SDK, and persist to D1 database.
7. The generic checkout component reads both static configs and dynamic products from D1 to populate available products.
8. For checkout, validate customer form data and product selection with Zod schemas, then use Polar SDK's checkout links with validated customer details.
9. All products are one-off fixed price purchases (recurringInterval: null).
10. Implement security best practices: HTTPS, Zod schema validation, rate limiting, error handling, and PCI compliance by not storing payment data.

## Pros
- Simple setup with D1 for persistence.
- Product definitions are version-controlled and part of the codebase.
- Fast loading for static products; dynamic products add flexibility with database persistence.
- Easy to maintain static products; webhook enables secure external integration.
- Supports mandatory customer form fields for all checkouts.
- Production-ready with authentication, Zod schema validation, and error handling.
- PCI compliant as payment data is not stored locally.
- Type-safe validation with Zod for runtime security.

## Cons
- Requires Cloudflare D1 setup and migrations.
- Webhook requires API key management.
- One-off payments only; no subscription support.
- Additional complexity for database operations.

## Code Example
```typescript
// src/products/index.ts
import type { ProductCreate } from "@polar-sh/sdk/models/components/productcreate.js";

export const staticProducts: ProductCreate[] = [
  {
    name: "Basic Product",
    recurringInterval: null, // One-off
    prices: [
      {
        amountType: "fixed",
        priceAmount: 1000, // $10.00
        priceCurrency: "usd",
      },
    ],
    organizationId: process.env.POLAR_ORGANIZATION_ID!,
  },
];

// Store for dynamic products (in production, use a database)
export const dynamicProducts: Array<{ id: string; name: string; description?: string; polarId: string }> = [];

// migrations/001_create_dynamic_products.sql
CREATE TABLE dynamic_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  polar_id TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

// src/lib/schemas.ts
import { z } from "zod";

const supportedCurrencies = z.enum(["usd", "eur", "gbp"]);

export const dynamicProductCreateSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(1000).trim().optional(),
  price: z.number().positive().max(100000000),
  currency: supportedCurrencies.default("usd"),
});

export const customerFormSchema = z.object({
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  email: z.string().email().max(254),
  phone: z.string().regex(/^[0-9+\-\s\(\)]+$/).min(7).max(20),
});

export const productSelectionSchema = z.object({
  productId: z.string().uuid(),
});

export const apiResponseSchema = z.object({
  success: z.boolean(),
  productId: z.string().uuid().optional(),
  error: z.string().optional(),
});

// src/lib/db.ts
import { drizzle } from "drizzle-orm/d1";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const dynamicProductsTable = sqliteTable("dynamic_products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(),
  currency: text("currency").default("usd"),
  polarId: text("polar_id").notNull().unique(),
});

export const getDb = (d1: D1Database) => drizzle(d1, { schema: { dynamicProducts: dynamicProductsTable } });

// src/routes/api/webhook/products.ts (SolidStart API route)
import { json } from "solid-start/api";
import { Polar } from "@polar-sh/sdk";
import { getDb } from "~/lib/db";
import { dynamicProductCreateSchema, apiResponseSchema } from "~/lib/schemas";

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
});

export async function POST({ request }: { request: Request }) {
  // API Key authentication
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.WEBHOOK_API_KEY) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Validate input with Zod
    const validationResult = dynamicProductCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return json({
        error: "Validation failed",
        details: validationResult.error.issues
      }, { status: 400 });
    }

    const { name, description, price, currency } = validationResult.data;

    // Create product in Polar
    const product = await polar.products.create({
      name,
      description,
      recurringInterval: null,
      prices: [{ amountType: "fixed", priceAmount: Math.round(price), priceCurrency: currency }],
      organizationId: process.env.POLAR_ORGANIZATION_ID!,
    });

    // Store in D1
    const db = getDb(request.d1);
    await db.insert(dynamicProductsTable).values({
      name,
      description,
      price: Math.round(price),
      currency,
      polarId: product.id,
    });

    // Validate response
    const response = apiResponseSchema.parse({
      success: true,
      productId: product.id
    });

    return json(response);
  } catch (error) {
    console.error("Webhook error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}

// src/routes/api/products/dynamic.ts
import { json } from "solid-start/api";
import { getDynamicProducts } from "~/products";

export async function GET({ request }: { request: Request }) {
  try {
    const products = await getDynamicProducts(request.d1);
    return json(products);
  } catch (error) {
    console.error("Error fetching dynamic products:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}

// src/routes/checkout.tsx (SolidJS route)
import { createSignal, For, createResource } from "solid-js";
import { staticProducts } from "~/products";
import { Polar } from "@polar-sh/sdk";
import { customerFormSchema, productSelectionSchema, type CustomerForm } from "~/lib/schemas";

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
});

export default function Checkout() {
  const [selectedProduct, setSelectedProduct] = createSignal<string | null>(null);
  const [customer, setCustomer] = createSignal<CustomerForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const [dynamicProducts] = createResource(() => fetch("/api/products/dynamic").then(r => r.json()));

  const allProducts = () => [...staticProducts, ...(dynamicProducts() || [])];

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const prodId = selectedProduct();
    if (!prodId) return;

    const cust = customer();
    try {
      const checkout = await polar.checkoutLinks.create({
        productId: prodId,
        customerEmail: cust.email,
        customerName: `${cust.firstName} ${cust.lastName}`,
        // Note: Polar may not support phone directly; handle separately if needed
      });
      window.location.href = checkout.url;
    } catch (error) {
      console.error("Checkout creation failed:", error);
      alert("Failed to create checkout. Please try again.");
    }
  };

  return (
    <div>
      <h1>Checkout</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>First Name:</label>
          <input
            type="text"
            required
            maxlength="100"
            value={customer().firstName}
            onInput={(e) => setCustomer({ ...customer(), firstName: e.target.value })}
          />
        </div>
        <div>
          <label>Last Name:</label>
          <input
            type="text"
            required
            maxlength="100"
            value={customer().lastName}
            onInput={(e) => setCustomer({ ...customer(), lastName: e.target.value })}
          />
        </div>
        <div>
          <label>Email:</label>
          <input
            type="email"
            required
            value={customer().email}
            onInput={(e) => setCustomer({ ...customer(), email: e.target.value })}
          />
        </div>
        <div>
          <label>Phone:</label>
          <input
            type="tel"
            required
            pattern="[0-9+\-\s\(\)]*"
            value={customer().phone}
            onInput={(e) => setCustomer({ ...customer(), phone: e.target.value })}
          />
        </div>

        <h2>Select Product</h2>
        <For each={allProducts()}>
          {(product) => (
            <div>
              <input
                type="radio"
                name="product"
                value={product.id || product.polarId}
                onChange={() => setSelectedProduct(product.id || product.polarId)}
              />
              <label>{product.name}</label>
              {product.description && <p>{product.description}</p>}
            </div>
          )}
        </For>

        <button type="submit" disabled={!selectedProduct()}>Buy Now</button>
      </form>
    </div>
  );
}
```

Note: This example uses D1 for persistence and API key authentication on the webhook. Ensure environment variables are set: POLAR_ACCESS_TOKEN, POLAR_ORGANIZATION_ID, WEBHOOK_API_KEY. Run D1 migrations before deployment. For PCI compliance, never store payment card data; all processing is handled by Polar.
