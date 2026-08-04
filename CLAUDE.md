# CLAUDE.md

Concise guidance for working in the Sombre repository. Inspect code and migrations before editing or making architecture claims — this file is a summary, not the source of truth.

## 1. Project overview

Sombre is a Hong Kong ecommerce store for high-end perfume, skincare, body care, and beauty products, at [sombrebeauty.com](https://sombrebeauty.com).

Stack:

- Next.js App Router (Next.js 16, React 19, TypeScript 5), deployed on Vercel
- Supabase (Postgres, Auth, RLS) for the catalog, orders, and admin data
- Stripe Checkout and signed webhooks for payment
- Resend for transactional email (sender domain verified)
- Cloudflare for DNS

## 2. Current business model

Not every product is physically held in stock. Some items may be purchased from suppliers only after a customer places an order, so fulfilment time can vary by product.

Refunds are full or none — there is no partial-refund feature in the customer-facing flow. The codebase still defends against a partial refund arriving from Stripe (e.g. issued manually in the Stripe Dashboard) by flagging the order for manual review rather than guessing at stock impact.

## 3. Implemented customer flow

1. Browse the catalog and add items to a browser-local (`localStorage`) cart.
2. Checkout Session creation (`src/app/api/checkout/session/route.ts`) revalidates cart, coupon, and shipping server-side and creates a Stripe Checkout Session — it does not create an order.
3. Customer pays through Stripe Checkout.
4. The signed webhook (`src/app/api/stripe/webhook/route.ts`) creates the order, reduces stock via `confirm_paid_order_and_reduce_stock`, and records the order snapshot.
5. Order confirmation and seller-notification emails are queued through `order_emails` and sent via Resend.
6. Admin reviews and processes the order (`/admin/orders/[id]`): enters courier and tracking number, marks the order **shipped** (triggers a shipping-confirmation email), then later marks it **delivered**.
7. A full refund is issued in Stripe (Dashboard or API); the `refund.created` / `refund.updated` / `refund.failed` webhook events update the order's payment and refund state.
8. Refunds never restore stock automatically. An admin manually restores sellable stock per item, after inspection, from the order page.

## 4. Important safety rules

- Stripe must stay in sandbox (test) mode during launch preparation. `src/lib/stripe/server.ts` enforces this: it throws if `STRIPE_SECRET_KEY` is missing, doesn't match `sk_test_...`, or is a live key — live keys and live webhook events are rejected outright.
- Webhook signatures are verified before processing; duplicate/replayed events are handled idempotently (unique Stripe references, guarded status transitions, RPC guards).
- Refunds never restore sellable stock automatically — only the audited, per-item `restore_order_item_sellable_stock` admin RPC can, and it requires a quantity and an inspection reason.
- Transactional emails go through the existing `order_emails` system (order confirmation, seller notification, shipping confirmation). Failed sends can be retried from Admin → Operations, gated by a database claim so a send can't double-fire.
- Applied Supabase migrations are immutable — add a new migration for every database change, and deploy it before the code that depends on it.

## 5. Main implemented features

- Storefront: catalog/product pages, cart, Stripe Checkout
- Discount codes: cart coupon input, server-side revalidation at checkout, order snapshot, admin coupon management
- Admin (`/admin`, Supabase Auth-gated to a single configured email): order list/detail, inventory viewing, fulfilment (courier, tracking, shipped/delivered), refund status visibility, manual stock restoration, and an Operations page for unresolved webhook failures and failed-email retries
- Shipping confirmation email, sent when an order is marked shipped
- Announcement banner: a dismissible top bar reading "Use code HAPPY2026 for up to 60% off selected products," linking to `/shop`. It is hidden on `/checkout` routes, and reappears after a reload or fresh visit since the dismissal is only in-memory component state (not persisted).
- Homepage currently features Maison Margiela campaign imagery (`public/images/products/maison-margiela/`).

## 6. Key external setup

- Cloudflare manages DNS for sombrebeauty.com.
- Vercel hosts the app.
- `www.sombrebeauty.com` redirects to `sombrebeauty.com` with a 308 redirect.
- Stripe refund webhooks must include `refund.created`, `refund.updated`, and `refund.failed` (all three are handled in `src/app/api/stripe/webhook/route.ts`).
- No secret values are recorded here — see `.env.example` for the required variable names.

## 7. Current launch status

**Completed**

- Coupon system, admin platform, order fulfilment (courier/tracking/shipped/delivered), refund webhook handling, manual stock restoration, admin Operations queue (webhook failures + email retry), shipping confirmation email, announcement banner
- Stripe sandbox-only enforcement in code
- Baseline security headers (`next.config.ts`); lint, type-check, tests, and production build all pass

**Still needed before real customers**

- Finish the launch product catalogue
- Confirm supplier availability and fulfilment process
- Prepare packaging
- Run final mobile and desktop customer journey tests
- Complete business registration and record keeping (`src/lib/legal/business-details.ts` still has bracketed placeholders)
- Confirm Supabase production Auth and backups
- Confirm Resend DNS and delivery
- Complete Stripe account verification
- CSP and HSTS are not yet configured (`next.config.ts`)
- Later: a reviewed move from Stripe sandbox to live mode
- Run one small real payment test after live activation

## 8. Verification

Last run 2026-08-04, from a clean working tree:

- `npm run lint` — passes, no errors
- `npx tsc --noEmit` — passes, no errors
- `npm test` — 1004 tests passed across 75 files (re-run to confirm before relying on this count; it will drift as tests are added)
- `SITE_URL=https://sombrebeauty.com npm run build` — succeeds
- `git diff --check` — clean

Re-run these before relying on their results, since the codebase changes over time.
