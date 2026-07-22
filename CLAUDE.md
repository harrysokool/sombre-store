# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Sombre is a curated fragrance ecommerce MVP: Next.js App Router + React 19 + TypeScript, Tailwind CSS 4, Supabase/PostgreSQL, Stripe Checkout. The current real catalog is Maison Margiela Replica perfume products, with images stored locally under `public/images/products/<brand>/`.

The tested purchase path is: `cart -> checkout -> Stripe Checkout -> Stripe webhook -> Supabase orders/order_items -> success page`.

`project_note.md` is the original, much larger product blueprint (customer auth, admin CRUD, product variants, Cloudinary media, multi-role authorization). The current codebase is a deliberately narrower MVP subset of that blueprint — no auth, no admin backend, no variants, no Cloudinary yet. Treat `project_note.md` as aspirational direction, not current state.

`README.md` and `PROJECT_STATUS_SUMMARY.md` describe stock validation, oversell handling, and RLS as open risks — check `supabase/migrations/` and recent git history before trusting that framing, since these have since been implemented (atomic stock control, paid-oversell refund recovery, RLS) and the docs can lag behind actual state.

## Commands

Standard scripts are in `package.json`. Two things it won't tell you: typecheck is `npx tsc --noEmit` (there is no typecheck script), and there is no test suite or test framework configured.

Local Stripe webhook testing requires the Stripe CLI in a second terminal, forwarding to the webhook route, with the printed webhook secret copied into `STRIPE_WEBHOOK_SECRET` in `.env.local` (dev server restart required after env changes):

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Required env vars are listed in `.env.example`. Convention: browser-exposed vars are prefixed `NEXT_PUBLIC_`; everything else is server-only and must never be sent to the client.

## Architecture

### Three Supabase clients, three trust levels

- `src/lib/supabase/client.ts` — browser anon client.
- `src/lib/supabase/server.ts` — server-side anon client for public reads (e.g. product catalog lookups during checkout). Explicitly a placeholder with no cookie/session handling — there is no `@supabase/ssr` dependency and no `middleware.ts` in this repo yet.
- `src/lib/supabase/service-role.ts` — server-only client that bypasses RLS. Throws if imported into browser code. Used exclusively by the Stripe webhook and the checkout-success receipt lookup for trusted order writes/reads. Never expose this key or client to frontend code.

### Cart is client-only; server never trusts it

The cart lives in `localStorage` (`src/lib/cart/cart.ts`) — pure client state, no server persistence. At checkout, `src/app/api/checkout/session/route.ts` re-fetches product price/stock/active-status from Supabase, rebuilds the subtotal server-side, and rejects the request if it doesn't match the client-submitted subtotal (tolerance `0.01`) or if stock is insufficient. Never trust product price, name, or stock from a client payload — always recompute from `products` in Supabase.

### Orders are created by the webhook, not by checkout session creation

`src/app/api/checkout/session/route.ts` only creates the Stripe Checkout Session and redirects — it does not write to `orders`. Order/`order_items` rows are created in `src/app/api/stripe/webhook/route.ts` on `checkout.session.completed` (and `checkout.session.async_payment_succeeded`). This avoids persisting orders for abandoned/incomplete checkouts.

Key correctness patterns in the webhook worth preserving when touching this code:
- Idempotency: existing order lookup by `stripe_session_id`, order_items upsert keyed on `(order_id, stripe_line_item_id)` with `ignoreDuplicates`, and Stripe refund creation uses a stable `idempotencyKey` — all defend against Stripe's at-least-once webhook delivery and concurrent retries.
- Stock is only decremented via the `confirm_paid_order_and_reduce_stock` Postgres RPC (atomic, see `supabase/migrations/20260717000000_add_atomic_stock_control.sql`), not via a separate read-then-write from application code.
- Oversell recovery: if stock ran out between session creation and payment confirmation, the order is marked and refunded automatically (`handlePaidOversellRefund`) rather than silently fulfilled or left inconsistent.
- Refund state transitions are guarded against out-of-order webhook delivery (e.g. `.neq("order_status", "refunded")` before applying an update) — Stripe does not guarantee event ordering.

### Checkout success verification doesn't trust the redirect

`src/lib/checkout/receipt.ts` (`loadVerifiedCheckoutReceipt`) does not treat arrival at `/checkout/success?session_id=...` as proof of payment. It re-fetches the Stripe session server-side, loads the persisted Supabase order by `stripe_session_id`, and cross-checks payment intent ID, currency, and amounts (subtotal/shipping/total) between Stripe and Supabase before returning order data to the page. Only orders with a confirmed payment status and `order_status === "confirmed"` get their line items returned.

### Repo conventions and gotchas

- Page files own data loading; components own rendering.
- `admin`, `login`, and `brands` are unbuilt placeholders (`PagePlaceholder`), not working pages.
- `supabase/migrations/` is append-only. Always confirm what is actually applied with `npx supabase migration list` rather than assuming the local directory matches the remote database.
- `supabase/manual/` holds one-off additive SQL for the Maison Margiela catalog.
- `supabase/seed.sql` is legacy sample data — review before running it against a fresh database.
