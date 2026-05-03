# Sombre Project Status Summary

## Current State

Sombre is a working early-stage ecommerce MVP for a curated fragrance store.

The core local purchase flow has been tested and is working:

`product -> cart -> checkout -> Stripe Checkout -> Stripe webhook -> Supabase order -> success page`

Confirmed working locally:

- users can add products to the cart
- users can open checkout
- users can complete a Stripe test payment
- Stripe CLI receives `checkout.session.completed`
- the webhook returns `200`
- the webhook creates an `orders` row in Supabase
- the webhook creates related `order_items` rows in Supabase
- the success page works after payment

## Current Catalog

The active real catalog now includes Maison Margiela Replica perfume products.

Maison Margiela product images are stored locally under:

`public/images/products/maison-margiela/`

The homepage now uses real Maison Margiela Replica products and image paths instead of the older placeholder products.

## What Is Built

### Storefront

- Shared app shell with navbar and footer
- Homepage focused on real Maison Margiela Replica products
- `/shop` page backed by Supabase product data
- `/shop` supports all products, category views, brand browsing, and simple collection views
- `/products/[slug]` page backed by Supabase product details
- Product images render from local project image paths

### Shop Flow

The shop page supports:

- `/shop` for all products
- `/shop?category=perfume` for a category landing page with brand choices
- `/shop?category=perfume&view=all` for all products in that category
- `/shop?category=perfume&brand=maison-margiela` for brand-filtered category products
- `/shop?collection=new-arrivals` for newest products first
- `/shop?collection=best-sellers` as a simple MVP collection view

Important shop logic lives in:

- `src/app/shop/page.tsx` for page composition and data loading
- `src/lib/storefront/shop.ts` for shop view, query param, copy, and filtering helpers
- `src/lib/storefront/products.ts` for shared product relation and image helpers
- `src/components/shop/category-brand-selection.tsx` for the category brand selection UI

### Cart

The cart is browser-based and stored in `localStorage`.

It supports:

- add to cart
- quantity increase
- quantity decrease
- remove item
- subtotal calculation
- navbar cart count
- checkout cart snapshot for post-payment cart reconciliation

Cart and checkout now share reusable code:

- `src/hooks/use-cart-items.ts`
- `src/components/cart/cart-product-image.tsx`
- `src/components/cart/order-summary.tsx`
- `src/lib/cart/math.ts`

### Checkout

The `/checkout` page collects customer and shipping details, then sends the cart to:

`/api/checkout/session`

The checkout page explains that payment is completed securely through Stripe.

### Stripe Checkout

Stripe Checkout is implemented and tested locally.

The `/api/checkout/session` route:

- validates the checkout payload
- fetches current product data from Supabase
- rebuilds prices on the server
- compares the server subtotal against the client subtotal
- creates a Stripe Checkout Session
- redirects the customer to Stripe-hosted checkout

Product prices are not trusted from the browser.

### Stripe Webhook and Orders

The `/api/stripe/webhook` route is implemented and tested locally.

It:

- verifies the Stripe webhook signature
- handles `checkout.session.completed`
- checks if the Stripe session was already persisted
- fetches Stripe line items
- creates an `orders` row
- creates related `order_items` rows
- avoids duplicate order creation through `stripe_session_id`

Order writes now use the Supabase service role client:

`src/lib/supabase/service-role.ts`

This is safer because webhook order inserts use a trusted server-only key instead of the public anon key.

## Supabase Usage

Supabase is used for:

- brands
- categories
- products
- product images
- orders
- order items

Client paths:

- `src/lib/supabase/client.ts` creates the browser anon client
- `src/lib/supabase/server.ts` creates the server anon client for public reads
- `src/lib/supabase/service-role.ts` creates the server-only service role client for trusted backend writes

The service role key must never be exposed to frontend code and must not use a `NEXT_PUBLIC_` prefix.

## Important Files

- `src/app/page.tsx`  
  Homepage using real Maison Margiela Replica products.

- `src/app/shop/page.tsx`  
  Loads active products from Supabase and composes the shop page.

- `src/lib/storefront/shop.ts`  
  Shop view, filtering, category, brand, collection, and page copy helpers.

- `src/lib/storefront/products.ts`  
  Shared product relation and product image helper functions.

- `src/app/products/[slug]/page.tsx`  
  Loads one product, its brand, category, and images from Supabase.

- `src/lib/cart/cart.ts`  
  Browser cart helpers and checkout cart snapshot logic.

- `src/components/cart/cart-page-content.tsx`  
  Cart page UI.

- `src/components/cart/checkout-page-content.tsx`  
  Checkout form and Stripe redirect trigger.

- `src/app/api/checkout/session/route.ts`  
  Creates Stripe Checkout Sessions and validates prices on the server.

- `src/app/api/stripe/webhook/route.ts`  
  Verifies Stripe webhooks and persists orders/order items.

- `src/lib/supabase/service-role.ts`  
  Server-only Supabase service role client for trusted backend writes.

- `supabase/migrations/20260405000000_initial_catalog_schema.sql`  
  Catalog schema.

- `supabase/migrations/20260406000000_add_orders_schema.sql`  
  Order and order item schema.

- `supabase/manual/insert_maison_margiela_replica_products.sql`  
  Manual additive SQL for Maison Margiela Replica products.

- `supabase/manual/insert_maison_margiela_replica_product_images.sql`  
  Manual additive SQL for Maison Margiela Replica product image paths.

## Required Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`  
  Supabase project URL. Used by frontend and backend Supabase clients.

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
  Supabase anon key. Used for public catalog reads.

- `SUPABASE_SERVICE_ROLE_KEY`  
  Supabase service role key. Server-only. Used by the Stripe webhook for trusted order writes.

- `STRIPE_SECRET_KEY`  
  Stripe secret key. Server-only. Used to create Checkout Sessions and read Stripe line items.

- `STRIPE_WEBHOOK_SECRET`  
  Stripe webhook signing secret. Server-only. Used to verify webhook events.

No Stripe publishable key is currently required because the app redirects to a server-created Stripe Checkout Session.

## Local Checkout Testing

1. Add the required values to `.env.local`.
2. Start the Next.js dev server:

   ```bash
   npm run dev
   ```

3. In another terminal, start Stripe CLI webhook forwarding:

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. Copy the webhook signing secret from Stripe CLI into `STRIPE_WEBHOOK_SECRET`.
5. Restart the dev server after changing env vars.
6. Open the site locally.
7. Add a product to cart.
8. Go to checkout.
9. Complete Stripe Checkout with a Stripe test card.
10. Confirm:
    - Stripe CLI receives `checkout.session.completed`
    - the webhook returns `200`
    - Supabase receives one `orders` row
    - Supabase receives related `order_items` rows
    - the success page confirms the order

## Remaining Risks and Gaps

### Stock validation is not implemented

Products have `stock_quantity`, but checkout does not currently check whether enough stock is available.

### Inventory is not updated after payment

Paid orders do not currently reduce product stock.

### Order privacy and RLS need review before public launch

Webhook writes use the service role client, which is good.

Before public deployment, Supabase Row Level Security should still be reviewed so public users cannot read or write private order data directly.

### Success page can be improved later

The success page works, but it does not yet show purchased line items.

### Legacy seed data needs review

The current real Maison Margiela product data is in manual SQL files.

`supabase/seed.sql` still contains older sample catalog data and should be reviewed before using it to reset or seed a fresh database.

### Shipping and tax are not calculated

The current Stripe Checkout Session charges item subtotal only.

## Recommended Next Steps

1. Review Supabase RLS and order privacy before public deployment.
2. Add stock validation to checkout.
3. Add inventory update after successful payment.
4. Review or replace the older `supabase/seed.sql` sample data.
5. Keep future cleanup small and focused.

## Overall Verdict

Sombre is usable as a local ecommerce MVP.

The main purchase flow works, the current catalog is real enough for continued frontend and MVP work, and the codebase is still simple enough to build on safely.
