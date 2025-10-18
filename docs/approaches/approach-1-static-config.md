# Approach 1: Static Configuration Files

## Overview
In this approach, product configurations are primarily defined in static files (e.g., TypeScript or JSON files) within the codebase. These files are loaded at runtime or build time to dynamically create products in Polar's system. Additionally, support for dynamic products is added via a webhook endpoint that can create products on-the-fly based on incoming requests, allowing for external systems to define products programmatically.

## Implementation Steps
1. Create a `src/products/` directory to store product configurations.
2. Define products using TypeScript interfaces or JSON objects that match Polar's `ProductCreate` schema.
3. At application startup or when needed, use the Polar SDK to create products from these configs if they don't exist in Polar (e.g., check by name or external ID).
4. Create a webhook API endpoint (e.g., `/api/webhook/products`) to accept dynamic product creation requests with fields like name, description, and price.
5. Upon receiving a webhook request, validate the data, create a product in Polar using the SDK, and store a reference locally (in memory or simple storage).
6. The generic checkout component reads both static configs and dynamic products to populate available products.
7. For checkout, use Polar SDK's checkout links with customer details collected from mandatory form fields (first name, last name, email, phone).
8. All products are one-off fixed price purchases (recurringInterval: null).

## Pros
- Simple setup with no external database dependencies.
- Product definitions are version-controlled and part of the codebase.
- Fast loading for static products; dynamic products add flexibility.
- Easy to maintain static products; webhook enables external integration.
- Supports mandatory customer form fields for all checkouts.

## Cons
- Requires manual synchronization for static products.
- Dynamic products stored in memory may not persist across restarts (consider adding simple persistence).
- Webhook security needs to be handled (e.g., authentication).
- One-off payments only; no subscription support.

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

// src/routes/api/webhook/products.ts (SolidStart API route)
import { json } from "solid-start/api";
import { Polar } from "@polar-sh/sdk";
import { dynamicProducts } from "~/products";

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
});

export async function POST({ request }: { request: Request }) {
  const body = await request.json();
  const { name, description, price, currency = "usd" } = body;

  if (!name || !price) {
    return json({ error: "Name and price required" }, { status: 400 });
  }

  // Create product in Polar
  const product = await polar.products.create({
    name,
    description,
    recurringInterval: null,
    prices: [{ amountType: "fixed", priceAmount: price, priceCurrency: currency }],
    organizationId: process.env.POLAR_ORGANIZATION_ID!,
  });

  // Store locally
  dynamicProducts.push({
    id: product.id,
    name,
    description,
    polarId: product.id,
  });

  return json({ success: true, productId: product.id });
}

// src/components/Checkout.tsx (SolidJS component)
import { createSignal, For, createResource } from "solid-js";
import { staticProducts, dynamicProducts } from "~/products";
import { Polar } from "@polar-sh/sdk";

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
});

interface CustomerForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export default function Checkout() {
  const [selectedProduct, setSelectedProduct] = createSignal<string | null>(null);
  const [customer, setCustomer] = createSignal<CustomerForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const allProducts = () => [...staticProducts, ...dynamicProducts];

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const prodId = selectedProduct();
    if (!prodId) return;

    const cust = customer();
    const checkout = await polar.checkoutLinks.create({
      productId: prodId,
      customerEmail: cust.email,
      customerName: `${cust.firstName} ${cust.lastName}`,
      // Note: Polar may not support phone directly; handle separately if needed
    });

    window.location.href = checkout.url;
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
            value={customer().firstName}
            onInput={(e) => setCustomer({ ...customer(), firstName: e.target.value })}
          />
        </div>
        <div>
          <label>Last Name:</label>
          <input
            type="text"
            required
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
                value={product.id}
                onChange={() => setSelectedProduct(product.id)}
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

Note: This example assumes products are pre-created in Polar. For static products, sync them on app start. Dynamic products are created via webhook. In production, add authentication to the webhook and persistence for dynamic products.
