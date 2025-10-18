# Approach 1: Static Configuration Files

## Overview
In this approach, product configurations are defined in static files (e.g., TypeScript or JSON files) within the codebase. These files are loaded at runtime or build time to dynamically create products in Polar's system.

## Implementation Steps
1. Create a `src/products/` directory to store product configurations.
2. Define products using TypeScript interfaces or JSON objects that match Polar's `ProductCreate` schema.
3. At application startup or when needed, use the Polar SDK to create products from these configs if they don't exist in Polar (e.g., check by name or external ID).
4. The generic checkout component reads these configs to populate available products.
5. For checkout, use Polar SDK's checkout links or embedded checkout with the product IDs.

## Pros
- Simple setup with no external database dependencies.
- Product definitions are version-controlled and part of the codebase.
- Fast loading since no network calls to a database.
- Easy to maintain and update with code changes.

## Cons
- Requires manual synchronization between code configs and Polar's products.
- Not suitable for dynamic product creation (e.g., user-generated products).
- Changes require code deployments.

## Code Example
```typescript
// src/products/index.ts
import type { ProductCreate } from "@polar-sh/sdk/models/components/productcreate.js";

export const products: ProductCreate[] = [
  {
    name: "Basic Plan",
    recurringInterval: "month",
    prices: [
      {
        amountType: "fixed",
        priceAmount: 1000, // $10.00
        priceCurrency: "usd",
      },
    ],
    organizationId: process.env.POLAR_ORGANIZATION_ID!,
  },
  {
    name: "Premium Plan",
    recurringInterval: "year",
    prices: [
      {
        amountType: "fixed",
        priceAmount: 10000, // $100.00
        priceCurrency: "usd",
      },
    ],
    organizationId: process.env.POLAR_ORGANIZATION_ID!,
  },
];

// In the checkout component (SolidJS)
import { createSignal, For } from "solid-js";
import { products } from "~/products";
import { Polar } from "@polar-sh/sdk";

export default function Checkout() {
  const [selectedProduct, setSelectedProduct] = createSignal<string | null>(null);
  const polar = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN!,
  });

  const handleCheckout = async (productId: string) => {
    // Assuming products are created and we have their IDs
    const checkoutLink = await polar.checkoutLinks.create({
      productId,
      // other options
    });
    window.location.href = checkoutLink.url;
  };

  return (
    <div>
      <h1>Select a Product</h1>
      <For each={products}>
        {(product) => (
          <div>
            <h2>{product.name}</h2>
            <button onClick={() => handleCheckout(product.id!)}>Buy Now</button>
          </div>
        )}
      </For>
    </div>
  );
}
```

Note: In practice, you'd need to ensure products are created in Polar first and store their IDs, or use Polar's API to fetch/create on the fly.
