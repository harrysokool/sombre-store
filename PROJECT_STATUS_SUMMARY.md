# Sombre Project Status Summary

## Current State

Sombre has moved beyond a storefront prototype and is now a real early-stage ecommerce system.

The project currently includes:

- a shared app shell and routed storefront structure
- an editorial luxury homepage direction
- a live `/shop` page backed by Supabase product data
- a live `/products/[slug]` page with real product details and imagery
- a localStorage-based cart with:
  - add to cart
  - quantity updates
  - remove item
  - navbar cart indicator
- a real `/checkout` page with customer information fields
- a server-side Stripe Checkout Session handoff
- server-side price authority for checkout
- a Stripe webhook route with signature verification
- persisted `orders` and `order_items` records created from `checkout.session.completed`

This means the project already has the core shape of a real ecommerce MVP:

browse -> product -> cart -> checkout -> Stripe -> confirmed webhook -> persisted order

---

## What Is Going On Technically

### Catalog and Storefront

Products, brands, categories, and product images are stored in Supabase/Postgres.

The storefront is already connected to real backend data.

- `/shop` fetches live product data from Supabase
- `/products/[slug]` fetches one product plus related brand, category, and ordered product images
- product images are now rendered from local project image paths

### Cart

The cart is intentionally MVP-simple and browser-based.

It uses localStorage and supports:

- adding a product from the product page
- incrementing quantity
- decrementing quantity
- removing an item
- calculating subtotal and item count
- showing live cart count in the navbar

### Checkout

The checkout page reads the local cart on the client and collects a lightweight customer information structure:

- full name
- email
- phone
- address line 1
- address line 2
- city
- postal code
- country

### Stripe Session Creation

The checkout handoff is already server-backed.

The `/api/checkout/session` route:

- accepts cart + customer payload from `/checkout`
- validates the payload at MVP level
- fetches the real product data from Supabase
- rebuilds checkout pricing on the server
- recalculates subtotal on the server
- creates a hosted Stripe Checkout Session

This is important because the server, not the browser, now decides the actual prices used for payment.

### Webhook and Order Persistence

The Stripe webhook route now:

- verifies Stripe signature using the raw request body
- handles `checkout.session.completed`
- checks whether an order already exists for the session
- fetches Stripe line items
- creates an `orders` row
- creates related `order_items` rows
- avoids duplicate order creation using `stripe_session_id`

This is the point where the project becomes a real server-tracked commerce system.

---

## What Is Good Right Now

### 1. The architecture is still simple

The project is not overengineered.

You have managed to keep:

- simple data flow
- understandable page structure
- isolated client components where needed
- server-only Stripe/Supabase logic where needed

That is a major strength.

### 2. Price authority is on the server

This was the most important payment-safety fix before going further.

The checkout route no longer trusts local cart price values.

### 3. Orders are now persisted from Stripe-confirmed events

This means you now have a reliable backend record of completed purchases.

### 4. The schema is practical for MVP

The project already has a good catalog schema and a lean order schema.

The order system stores snapshots so later product changes do not corrupt historical purchase records.

### 5. The product is already testable as a real flow

You can now test:

shop -> product -> cart -> checkout -> Stripe -> webhook -> persisted order

That is a serious milestone.

---

## What Still Needs Work

These are the important next gaps, in priority order.

### 1. Real success-page state

The biggest remaining UX/business gap is the post-payment user experience.

Right now, the project can persist confirmed orders, but the frontend success flow still needs to catch up.

The `/checkout/success` page should stop being just a return page and start reading real order/session state.

It should be able to distinguish between:

- confirmed order found
- payment/confirmation still processing
- invalid or missing session

### 2. Clear the local cart only after confirmed success

The cart should not be cleared just because the user lands on the success URL.

It should be cleared only after the app can confidently tie that session to a real persisted order.

### 3. End-to-end webhook testing

The webhook logic is implemented, but the most valuable immediate next step is testing the whole path fully.

That means confirming:

- Stripe sends the event correctly
- the webhook route receives it
- the order is persisted once
- order items are persisted correctly
- retries do not create duplicates

### 4. Slightly stronger duplicate/race handling later

The current combination of:

- application-level existing-order check
- database unique constraint on `stripe_session_id`

is good for MVP.

Later, race conditions and retry handling may need tightening, but this is not the next immediate problem.

---

## What Does **Not** Need To Be Done Next

These are not the best next moves right now:

- authentication first
- admin dashboard first
- order history UI first
- more homepage redesign work
- complex shipping/tax/coupon systems
- more Stripe event types immediately

Those can all come later.

The project already has enough surface area. The next step should close the confirmation loop, not widen the system.

---

## Recommended Next Step

### Build a real `/checkout/success` flow that reads confirmed order/session state

This is the highest-value next feature.

It should:

- read the `session_id` from the success URL
- check whether a real persisted order exists for that Stripe session
- show a real confirmation state when found
- show a processing state when webhook confirmation has not landed yet
- avoid claiming final confirmation too early

After that, the cart can be cleared only when confirmation is real.

---

## Recommended Sequence From Here

1. Test the webhook flow end-to-end
2. Update `/checkout/success` to reflect real order/session state
3. Clear local cart only after confirmed success
4. Then consider:
   - minimal order confirmation details
   - customer order lookup/history
   - admin order visibility
   - email/fulfillment logic

---

## Biggest Risks Right Now

The project is in a good state, but these are the current risk areas:

### 1. Frontend trust gap after payment

The backend can now confirm orders, but the user-facing confirmation experience is not yet fully aligned with that reality.

### 2. Sensitive payment code is now involved

Future AI-generated changes in the Stripe/order area should be kept small and reviewed carefully.

### 3. The project is becoming real enough that consistency matters more

From here on, maintainability and correctness matter more than adding lots of new features quickly.

---

## Overall Verdict

Sombre has crossed the line from portfolio-style storefront into real ecommerce MVP territory.

The project now has:

- real catalog data
- real cart flow
- real checkout handoff
- real Stripe payment path
- real webhook verification
- real persisted orders

That is a strong position.

The next goal is not to add lots of new systems.

The next goal is to make the post-payment experience feel as trustworthy and complete as the backend now is.

---

## One-Sentence Recommendation

Finish the post-payment confirmation flow before adding broader product features.
