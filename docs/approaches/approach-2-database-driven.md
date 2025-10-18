# Approach 2: Database-Driven with D1 and Alchemy IaC

## Overview
This approach uses Cloudflare's D1 database to store product configurations, managed via Alchemy IaC (Infrastructure as Code). Products are defined and managed in the database, allowing for dynamic updates without code changes. The checkout component queries the D1 database for available products and integrates with Polar's SDK for payment processing.

## Implementation Steps
1. Set up a D1 database using Wrangler (Cloudflare's CLI).
2. Use Alchemy IaC to define database schema and migrations for products table.
3. Create API routes or server functions in SolidStart to query products from D1.
4. On application load or periodically, sync products from D1 to Polar using the SDK (create if not exists).
5. The checkout component fetches products from the API/database and uses Polar SDK for checkout links or embedded checkout.

## Pros
- Fully dynamic: Products can be updated via database without redeploying code.
- Scalable and suitable for large numbers of products.
- Separation of concerns: Database manages product data, code handles presentation.
- Alchemy IaC ensures version-controlled infrastructure.

## Cons
- More complex setup with database and IaC tools.
- Requires network calls to database, potentially slower than static files.
- Need to handle synchronization between D1 and Polar to avoid duplicates.

## Code Example
```sql
-- migrations/001_create_products.sql (via Alchemy IaC)
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  recurring_interval TEXT,
  prices TEXT, -- JSON string
  polar_product_id TEXT, -- To store Polar's product ID after creation
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

```typescript
// src/lib/db.ts
import { drizzle } from "drizzle-orm/d1";
import { productsTable } from "./schema";

export const getDb = (d1: D1Database) => drizzle(d1, { schema: { products: productsTable } });

// src/lib/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const productsTable = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  recurringInterval: text("recurring_interval"),
  prices: text("prices"), // JSON
  polarProductId: text("polar_product_id"),
});

// API route: src/routes/api/products.ts
import { getDb } from "~/lib/db";
import type { APIEvent } from "solid-start/api";

export async function GET({ request }: APIEvent) {
  const db = getDb(request.d1); // Assuming D1 is bound
  const products = await db.select().from(productsTable);
  return new Response(JSON.stringify(products), { status: 200 });
}

// Sync script to create products in Polar
import { Polar } from "@polar-sh/sdk";
import { getDb } from "~/lib/db";

const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN! });

async function syncProducts() {
  const db = getDb(/* D1 instance */);
  const products = await db.select().from(productsTable).where(/* no polar id */);

  for (const product of products) {
    const polarProduct = await polar.products.create({
      name: product.name,
      recurringInterval: product.recurringInterval as any,
      prices: JSON.parse(product.prices),
      organizationId: process.env.POLAR_ORGANIZATION_ID!,
    });

    await db.update(productsTable)
      .set({ polarProductId: polarProduct.id })
      .where({ id: product.id });
  }
}

// Checkout component
import { createResource } from "solid-js";
import { Polar } from "@polar-sh/sdk";

export default function Checkout() {
  const [products] = createResource(() => fetch("/api/products").then(r => r.json()));

  const handleCheckout = async (polarProductId: string) => {
    const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN! });
    const checkout = await polar.checkoutLinks.create({
      productId: polarProductId,
    });
    window.location.href = checkout.url;
  };

  return (
    <div>
      <h1>Products</h1>
      <For each={products()}>
        {(product) => (
          <div>
            <h2>{product.name}</h2>
            <button onClick={() => handleCheckout(product.polarProductId)}>Buy</button>
          </div>
        )}
      </For>
    </div>
  );
}
```

Note: This assumes SolidStart API routes and Drizzle ORM for D1. Synchronization ensures products exist in Polar before checkout.
