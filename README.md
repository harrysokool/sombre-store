# Sombre Store

Sombre is a curated fragrance ecommerce MVP built with Next.js, Supabase, Stripe, and local product images.

The current catalog includes Maison Margiela Replica perfume products. Sombre is positioned as a curated store that selects products from luxury and independent fragrance brands.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase
- PostgreSQL
- Stripe Checkout

Product images are stored locally in `public/images/products/` under brand folders.

Example:

`public/images/products/maison-margiela/replica-lazy-sunday-morning-01.jpg`

## Current Status

Working locally:

- storefront pages
- shop category and brand browsing
- product detail pages
- product detail gallery/info components
- localStorage cart
- checkout page
- Stripe Checkout redirect
- Stripe test payment
- Stripe webhook handling
- Supabase order persistence
- success page

The full local checkout path has been tested:

`cart -> checkout -> Stripe Checkout -> webhook -> Supabase orders/order_items -> success page`

## Important Project Structure

- `src/app/page.tsx`  
  Homepage using real Maison Margiela Replica products.

- `src/app/shop/page.tsx`  
  Shop page composition and Supabase product loading.

- `src/lib/storefront/shop.ts`  
  Shop view, category, brand, collection, copy, and filtering helpers.

- `src/lib/storefront/products.ts`  
  Shared product relation and image helper functions.

- `src/app/products/[slug]/page.tsx`  
  Product detail page data loading and layout.

- `src/components/product/product-gallery.tsx`  
  Product detail image gallery.

- `src/components/product/product-info.tsx`  
  Product detail information, price, description, and add-to-cart section.

- `src/lib/cart/cart.ts`  
  Browser cart storage and checkout snapshot helpers.

- `src/hooks/use-cart-items.ts`  
  Shared cart state hook for cart and checkout pages.

- `src/components/cart/cart-product-image.tsx`  
  Shared cart/checkout product image component.

- `src/components/cart/checkout-form-field.tsx`  
  Shared checkout form field component.

- `src/components/cart/order-summary.tsx`  
  Shared cart/checkout summary component.

- `src/app/api/checkout/session/route.ts`  
  Creates Stripe Checkout Sessions and validates prices using Supabase product data.

- `src/app/api/stripe/webhook/route.ts`  
  Verifies Stripe webhooks and creates orders/order items in Supabase.

- `src/lib/supabase/service-role.ts`  
  Server-only Supabase service role client for trusted backend writes.

## Required Environment Variables

Create `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SITE_URL=http://localhost:3000
```

Notes:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are used for public Supabase access.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be exposed to the frontend.
- `STRIPE_SECRET_KEY` is server-only and creates Stripe Checkout Sessions.
- `STRIPE_WEBHOOK_SECRET` verifies Stripe webhook requests.
- `SITE_URL` is the trusted application origin used for Stripe success and cancel redirects. Use the deployed HTTPS origin in production.
- A Stripe publishable key is not currently required because this app uses Stripe-hosted Checkout from a server-created session.

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Run checks:

```bash
npm run lint
npx tsc --noEmit
```

## Local Checkout Testing

1. Add all required env vars to `.env.local`.
2. Start the dev server:

   ```bash
   npm run dev
   ```

3. Start Stripe CLI webhook forwarding in another terminal:

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. Copy the webhook secret from Stripe CLI into `STRIPE_WEBHOOK_SECRET`.
5. Restart the dev server after changing `.env.local`.
6. Add a product to cart.
7. Go to checkout.
8. Complete Stripe Checkout with a Stripe test card.
9. Confirm:
   - Stripe CLI receives `checkout.session.completed`
   - the webhook returns `200`
   - Supabase creates an `orders` row
   - Supabase creates related `order_items` rows
   - the success page works

## Database Notes

Core migrations:

- `supabase/migrations/20260405000000_initial_catalog_schema.sql`
- `supabase/migrations/20260406000000_add_orders_schema.sql`

Manual Maison Margiela catalog inserts:

- `supabase/manual/insert_maison_margiela_replica_products.sql`
- `supabase/manual/insert_maison_margiela_replica_product_images.sql`

The older `supabase/seed.sql` file still contains sample data and should be reviewed before using it on a fresh database.

## Remaining MVP Risks

- Stock validation is not implemented yet.
- Inventory is not reduced after successful payment.
- Supabase RLS/order privacy should be reviewed before public deployment.
- Shipping and tax are not calculated; Stripe currently charges item subtotal only.
