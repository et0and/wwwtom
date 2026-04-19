---
status: complete
phase: 6
updated: 2026-04-17
---

# Lucy Implementation Plan

## Goal

Turn `apps/lucy` into a New Zealand-only Payload storefront that manages products in the CMS and launches Stripe Checkout Sessions with site-selected quantity, NZ-only shipping, and GST-inclusive NZD pricing.

## Context & Decisions

| Decision                                                                      | Rationale                                                                                                                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Use Stripe Checkout Sessions, not Payment Links                               | Product pages need a quantity selector whose chosen value must carry into checkout; Payment Links do not support URL-based quantity handoff |
| Keep merchandising content in Payload; Stripe owns only identifiers           | Payload owns editable catalog content and layout; Stripe owns hosted checkout and sellable identifiers                                      |
| Payload is canonical source for price; auto-create new Stripe Price on change | Stripe Price amounts are immutable after creation; price edits require creating a new Price                                                 |
| NZD only, stored as integer minor units (cents)                               | Store is NZ-only; Stripe expects minor units; NZD uses standard 2-decimal minor units                                                       |
| Prices displayed GST-inclusive on storefront                                  | Confirmed by store owner                                                                                                                    |
| One flat NZ-wide Stripe shipping rate for v1                                  | Physical goods, NZ-only shipping; per-product rates deferred                                                                                |
| Publish hard-blocked unless Stripe sync succeeds                              | Prevents half-synced products reaching checkout                                                                                             |
| Use `stripe` package with `Stripe.createFetchHttpClient()` in Workers         | Stripe's recommended Worker SDK setup                                                                                                       |
| Checkout in a Lucy Next.js route handler                                      | Checkout Sessions must be server-created; Lucy owns product data                                                                            |
| `stripePriceId` is the only runtime checkout identifier                       | Simpler and sufficient for v1; no lookup keys                                                                                               |

## Purchasable State Rule

A product is purchasable only when ALL of the following are true:

- `_status === "published"`
- `isAvailable === true`
- `stripeSyncStatus === "synced"`
- `stripePriceId` is present and non-empty

The checkout route must re-validate this server-side on every request.

## Stripe Sync Rules

- Payload is the editable source of truth for all product/price fields
- On product save, sync the Stripe Product (name, description, images)
- Only create a new Stripe Price when `unitAmountNZD` actually changes
- Use Stripe idempotency keys for all create calls
- Only write `stripePriceId` back to Payload after Stripe confirms success
- Only deactivate the old Price after the new one is stored successfully
- Sync failure must block publish (not draft saves)
- Sync state is surfaced in the admin via `stripeSyncStatus`

## Product Schema (v1)

| Field              | Type                    | Notes                                     |
| ------------------ | ----------------------- | ----------------------------------------- |
| `name`             | text                    | required, used as admin title             |
| `slug`             | text                    | unique, auto-generated from name          |
| `shortDescription` | text                    | shown on listing page                     |
| `content`          | blocks                  | full product description                  |
| `featuredImage`    | upload → media          | required for publish                      |
| `gallery`          | array of upload → media | optional extra images                     |
| `unitAmountNZD`    | number                  | integer cents, GST-inclusive, required    |
| `isAvailable`      | checkbox                | default false                             |
| `maxQuantity`      | number                  | integer ≥ 1, default 10                   |
| `stripeProductId`  | text                    | read-only in admin, written by sync       |
| `stripePriceId`    | text                    | read-only in admin, written by sync       |
| `stripeSyncStatus` | select                  | `pending` / `synced` / `error`, read-only |
| SEO/meta group     | group                   | seoPlugin pattern                         |

## Checkout Session Shape

```ts
stripe.checkout.sessions.create({
  mode: "payment",
  line_items: [{ price: product.stripePriceId, quantity }],
  shipping_address_collection: { allowed_countries: ["NZ"] },
  shipping_options: [{ shipping_rate: env.STRIPE_NZ_SHIPPING_RATE_ID }],
  metadata: { productId: product.id, productSlug: product.slug },
  client_reference_id: product.id,
  success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/products/${product.slug}`,
})
```

## Runtime Bindings Required

| Name                         | Purpose                                          |
| ---------------------------- | ------------------------------------------------ |
| `D1`                         | Payload D1 SQLite database                       |
| `R2`                         | Payload media storage                            |
| `PAYLOAD_SECRET`             | Payload secret key                               |
| `STRIPE_SECRET_KEY`          | Stripe secret key (lazy-init, production secret) |
| `STRIPE_NZ_SHIPPING_RATE_ID` | Pre-created flat NZ shipping rate ID             |

## File Map (Sophie → Lucy refactor)

| From                                       | To                                            |
| ------------------------------------------ | --------------------------------------------- |
| `src/collections/Posts.ts`                 | `src/collections/Products.ts`                 |
| `src/access/posts.ts`                      | `src/access/products.ts`                      |
| `src/app/(frontend)/posts/page.tsx`        | `src/app/(frontend)/products/page.tsx`        |
| `src/app/(frontend)/posts/[slug]/page.tsx` | `src/app/(frontend)/products/[slug]/page.tsx` |
| `src/app/(frontend)/posts/post-data.ts`    | `src/app/(frontend)/products/product-data.ts` |
| `src/plugins/index.ts`                     | update SEO URL from `/posts/` to `/products/` |
| `src/app/(frontend)/site-config.ts`        | update nav links and site metadata            |
| _(new)_                                    | `src/lib/stripe.ts`                           |
| _(new)_                                    | `src/app/(frontend)/api/checkout/route.ts`    |
| _(new)_                                    | `src/app/(frontend)/success/page.tsx`         |
| _(new)_                                    | `src/components/QuantityForm.tsx`             |

---

## Phase 1: Establish Lucy Baseline [COMPLETE]

- [x] 1.1 Confirm `apps/lucy/src` is fully restored
- [x] 1.2 Fix R2 binding name in `wrangler.jsonc` (`lucy-media` → `R2`)
- [x] 1.3 Add `STRIPE_SECRET_KEY` and `STRIPE_NZ_SHIPPING_RATE_ID` to `.dev.vars` and `wrangler.jsonc`
- [x] 1.4 Add `stripe` to `package.json` and install
- [x] 1.5 Verify Lucy boots cleanly (`bun run dev` from `apps/lucy`)

## Phase 2: Refactor Payload Schema [COMPLETE]

- [x] 2.1 Create `src/collections/Products.ts`
- [x] 2.2 Create `src/access/products.ts`
- [x] 2.3 Remove Posts/Tags/Categories from `payload.config.ts`; register Products
- [x] 2.4 Add beforeChange hook blocking publish when not synced
- [x] 2.5 Update `src/plugins/index.ts` SEO URL to `/products/`
- [x] 2.6 Run `generate:types` and `generate:importmap`

## Phase 3: Add Stripe Sync [COMPLETE]

- [x] 3.1 Create `src/lib/stripe.ts` — lazy-init Stripe client with `createFetchHttpClient()`
- [x] 3.2 Add `afterChange` hook syncing Stripe Product on save
- [x] 3.3 Create new NZD Stripe Price when `unitAmountNZD` changes; deactivate old
- [x] 3.4 Surface sync errors in admin via `stripeSyncStatus`
- [x] 3.5 Write Stripe IDs back using `context.skipHooks` to prevent loops

## Phase 4: Refactor Frontend [COMPLETE]

- [x] 4.1 Create `src/app/(frontend)/products/product-data.ts`
- [x] 4.2 Create `src/app/(frontend)/products/page.tsx` — product listing
- [x] 4.3 Create `src/app/(frontend)/products/[slug]/page.tsx` — product detail
- [x] 4.4 Format prices with `Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" })`
- [x] 4.5 Create `src/components/QuantityForm.tsx` — client quantity form
- [x] 4.6 Disable buy button when not purchasable
- [x] 4.7 Update `src/app/(frontend)/site-config.ts`
- [x] 4.8 Delete `/posts` routes

## Phase 5: Add Checkout Session Route [COMPLETE]

- [x] 5.1 Create `src/app/(frontend)/api/checkout/route.ts`
- [x] 5.2 Validate request body; reject bad input
- [x] 5.3 Load product; enforce purchasable state server-side
- [x] 5.4 Clamp quantity to `1..product.maxQuantity`
- [x] 5.5 Create Stripe Checkout Session with NZ-only shipping and metadata
- [x] 5.6 Return `{ url: session.url }` or 303 redirect
- [x] 5.7 Create `src/app/(frontend)/success/page.tsx`

## Phase 6: Verification [COMPLETE]

- [x] 6.1 Run `generate:types` and `generate:importmap`
- [x] 6.2 Run `tsc --noEmit` in `apps/lucy`
- [x] 6.3 Run `bun run lint` in `apps/lucy`
- [x] 6.4 Smoke test: product publish blocked on sync error
- [x] 6.5 Smoke test: listing and detail pages render with NZD price
- [x] 6.6 Smoke test: quantity form → checkout → NZ-only shipping
- [x] 6.7 Verify in Cloudflare-compatible preview
- [x] 6.8 Confirm old `/posts` routes removed

## Notes

- NZD-only; no currency field in schema; storefront displays GST-inclusive prices
- Flat NZ shipping rate in v1 via `STRIPE_NZ_SHIPPING_RATE_ID` env binding
- Publish hard-blocked on sync failure; draft saves are not blocked
- Webhooks and local order records deferred to a future phase; `client_reference_id` added now for later reconciliation
