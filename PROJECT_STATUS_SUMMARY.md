# Sombre Project Status Summary

## Current State

Sombre is now a working early-stage ecommerce MVP.

The core purchase flow has been tested locally and is working:

`product -> cart -> checkout -> Stripe Checkout -> Stripe webhook -> Supabase order -> success page`

Confirmed working locally:

- users can add products to the cart
- users can open the checkout page
- users can complete a Stripe test payment
- Stripe CLI receives `checkout.session.completed`
- the webhook returns `200`
- the webhook creates an `orders` row in Supabase
- the webhook creates related `order_items` rows in Supabase
- the checkout success page works after payment

The project is no longer just a storefront prototype. It has a real working checkout and order persistence path.

---

## What Is Built

### Storefront

- Shared app shell with navbar and footer
- Homepage redesigned to feel more like a fragrance ecommerce site
- `/shop` page backed by Supabase product data
- `/products/[slug]` page backed by Supabase product details
- Product images rendered from local project image paths

### Cart

The cart is browser-based and stored in `localStorage`.

It supports:

- add to cart
- quantity increase
- quantity decrease
- remove item
- subtotal calculation
- navbar cart count
- checkout cart snapshot for post-payment reconciliation

### Checkout

The `/checkout` page collects:

- full name
- email
- phone
- address line 1
- address line 2
- city
- postal code
- country

The checkout page sends the cart and customer details to `/api/checkout/session`.

### Stripe Checkout

Stripe Checkout is implemented and tested locally.

The `/api/checkout/session` route:

- validates the checkout payload
- fetches current product data from Supabase
- rebuilds pricing on the server
- compares server subtotal against the client subtotal
- creates a Stripe Checkout Session
- redirects the customer to Stripe-hosted checkout

This means product prices are not trusted from the browser.

### Stripe Webhook and Orders

The Stripe webhook route is implemented and tested locally.

The `/api/stripe/webhook` route:

- verifies the Stripe signature using the raw request body
- handles `checkout.session.completed`
- checks whether the Stripe session was already persisted
- fetches Stripe line items
- creates an `orders` row
- creates related `order_items` rows
- avoids duplicate order creation through `stripe_session_id`

Order persistence now uses a Supabase service role client for trusted backend writes.

This is safer than using the public anon key for webhook order inserts.

---

## Supabase Usage

The project currently uses Supabase for:

- products
- brands
- categories
- product images
- orders
- order items

There are two Supabase client paths:

- the existing anon client for public catalog reads
- the service role client for trusted backend order persistence in the Stripe webhook

The service role key is server-only and should never be exposed as a `NEXT_PUBLIC_` environment variable.

---

## Important Files

- `src/app/page.tsx`  
  Homepage.

- `src/app/shop/page.tsx`  
  Loads active products from Supabase.

- `src/app/products/[slug]/page.tsx`  
  Loads one product, its brand, category, and images from Supabase.

- `src/lib/cart/cart.ts`  
  Browser cart helpers and checkout cart snapshot logic.

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

---

## What Is Good Right Now

### 1. The checkout flow works

The full local payment path has been tested successfully with Stripe test mode and Stripe CLI.

### 2. Server-side price authority is in place

The checkout route reloads products from Supabase and recalculates the subtotal before creating the Stripe session.

### 3. Orders are created from Stripe-confirmed events

Orders are not created just because the customer clicks checkout.

They are created only after Stripe sends `checkout.session.completed`.

### 4. Webhook writes now use the service role client

The webhook no longer depends on the public anon key for order persistence.

This is the right direction for production security.

### 5. The app is still simple

The codebase is still understandable and not overengineered.

---

## Remaining Risks and Gaps

### 1. Stock validation is not implemented

Products have `stock_quantity`, but checkout does not currently check whether enough stock is available.

### 2. Inventory is not updated after payment

Paid orders do not currently reduce product stock.

### 3. Success page needs polish

The success page works, but the customer-facing copy and order details should be improved.

It should eventually show clearer confirmation details and purchased items.

### 4. Product image mismatch exists in seed data

`supabase/seed.sql` references `*-02.jpg` product images, but the local `public/images/products` folder currently appears to contain only `*-01.jpg` product images.

This can cause broken secondary product images if the seed data is used as-is.

### 5. RLS and order privacy should still be checked

The webhook now uses the service role client, which is good.

Before public deployment, Supabase Row Level Security should still be reviewed so public users cannot read or write private order data directly.

### 6. Shipping and tax are not actually calculated yet

The current Stripe Checkout Session charges item subtotal only.

Any copy that says shipping or tax is calculated at checkout should be reviewed.

---

## What Does Not Need To Be Done Next

These are not urgent right now:

- full admin dashboard
- customer accounts
- order history UI
- complex discount system
- custom checkout UI
- advanced fulfillment workflow

Those can come later.

The next work should keep tightening the existing MVP path.

---

## Recommended Next Steps

1. Add stock validation to checkout.
2. Add inventory update after successful payment.
3. Polish `/checkout/success` copy and show clearer order confirmation details.
4. Fix the seed image mismatch.
5. Review Supabase RLS policies for order privacy before public deployment.

---

## Overall Verdict

Sombre is usable as a local ecommerce MVP.

The most important flow now works:

`browse -> cart -> checkout -> Stripe payment -> webhook -> persisted order -> success page`

The next phase should focus on reliability and production readiness, not adding large new systems.

