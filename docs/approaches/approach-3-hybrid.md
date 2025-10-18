# Approach 3: Hybrid Static-Dynamic Configuration

## Overview
This hybrid approach combines static configuration files for base product templates with a D1 database for dynamic instances or customizations. Static files define reusable product archetypes, while the database stores specific product offerings that can be modified at runtime. This provides the best of both worlds: version-controlled templates and dynamic product management.

## Implementation Steps
1. Define base product templates in static TypeScript/JSON files (similar to Approach 1).
2. Use D1 database to store product instances, referencing templates and allowing overrides.
3. At startup or on-demand, merge template data with database overrides to create full product configs.
4. Sync merged products to Polar using the SDK.
5. The checkout component queries the database for active products, merges with templates, and proceeds with Polar checkout.

## Pros
- Flexibility: Templates provide consistency, database allows customization.
- Version control for templates, dynamic updates for instances.
- Easier to manage complex product hierarchies.
- Balances performance (static templates) with dynamism (database overrides).

## Cons
- More complex than pure static or database approaches.
- Requires careful merging logic to avoid conflicts.
- Still needs synchronization with Polar.

## Code Example
```typescript
// src/products/templates.ts
export const productTemplates = {
  basic: {
    name: "Basic Plan",
    recurringInterval: "month" as const,
    prices: [{ amountType: "fixed", priceAmount: 1000, priceCurrency: "usd" }],
  },
  premium: {
    name: "Premium Plan",
    recurringInterval: "year" as const,
    prices: [{ amountType: "fixed", priceAmount: 10000, priceCurrency: "usd" }],
  },
};

// Database schema for instances
export const productInstancesTable = sqliteTable("product_instances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  templateKey: text("template_key").notNull(), // e.g., "basic"
  name: text("name"), // Override
  priceOverride: text("price_override"), // JSON override
  active: integer("active", { mode: "boolean" }).default(true),
  polarProductId: text("polar_product_id"),
});

// Merging function
function mergeProduct(template: any, instance: any) {
  return {
    ...template,
    ...instance,
    prices: instance.priceOverride ? JSON.parse(instance.priceOverride) : template.prices,
  };
}

// API to get merged products
export async function GET() {
  const instances = await db.select().from(productInstancesTable).where({ active: true });
  const mergedProducts = instances.map(inst => mergeProduct(productTemplates[inst.templateKey], inst));
  return new Response(JSON.stringify(mergedProducts));
}

// Sync to Polar (similar to Approach 2)
async function syncToPolar() {
  const merged = await getMergedProducts();
  for (const product of merged) {
    if (!product.polarProductId) {
      const polarProduct = await polar.products.create({
        ...product,
        organizationId: process.env.POLAR_ORGANIZATION_ID!,
      });
      // Update DB with polarProductId
    }
  }
}

// Checkout component (similar to previous, using merged products)
```

This approach allows defining templates once and creating multiple instances with variations stored in the database.
