# CLAUDE.md

Guidance for working in the current Sombre repository. Treat implementation as distinct from runtime verification: inspect the code and migrations before making architecture claims.

## 1. Project purpose

Sombre is a fragrance ecommerce storefront with a Supabase-backed catalog, a browser-local guest cart, Stripe Checkout, webhook-created orders, inventory and refund handling, an authenticated admin fulfilment area, and optional transactional email.

The implemented purchase path is:

`storefront -> local cart -> server-validated checkout -> Stripe Checkout -> signed webhook -> Supabase order and stock processing -> verified receipt`

Production commerce still depends on correct service configuration, applied migrations, verified legal/business content, and end-to-end runtime testing.

## 2. Technology stack

- Next.js 16 App Router, React 19, TypeScript 5
- Tailwind CSS 4
- Supabase Postgres, Supabase Auth, `@supabase/supabase-js`, and `@supabase/ssr`
- Stripe Checkout and signed Stripe webhooks
- Resend transactional email
- Upstash Redis rate limiting with an in-memory fallback

## 3. Repository structure

- `src/app/` — storefront, cart, checkout outcomes, public policy pages, admin routes, and API routes.
- `src/app/api/checkout/session/route.ts` — validates guest checkout and creates Stripe Checkout Sessions.
- `src/app/api/stripe/webhook/route.ts` — verifies and processes payment and refund events.
- `src/components/` and `src/hooks/` — UI and client behavior.
- `src/lib/storefront/` — Supabase catalog queries and formatting.
- `src/lib/cart/` and `src/lib/checkout/` — local cart, totals, shipping, payloads, and verified receipts.
- `src/lib/supabase/` — anonymous browser/server clients, cookie-aware admin Auth, and the server-only service-role client.
- `src/lib/admin/` — protected order reads and fulfilment rules.
- `src/lib/email/` — Resend configuration, templates, delivery claims, and status tracking.
- `src/lib/rate-limit.ts` — shared Upstash limiter and bounded in-memory fallback.
- `middleware.ts` — refreshes Supabase Auth cookies for `/admin`.
- `supabase/migrations/` — append-only database history, RLS, atomic stock/refund RPCs, webhook failure tracking, email claims, and fulfilment rules.
- `supabase/manual/` — deliberate catalog maintenance SQL; not part of the automatic migration sequence.
- `public/images/products/` — local product and campaign assets.

## 4. Storefront and cart

The App Router storefront reads the public Supabase catalog and renders the home, shop, product, cart, checkout, informational, and policy routes. The homepage hero art-directs separate mobile and desktop crops with `getImageProps` and a native `<picture>`. Global error, checkout error, loading, not-found, and other outcome pages use the Sombre design.

The guest cart and per-checkout reconciliation snapshots live in browser `localStorage`; there is no server-side cart. A confirmed receipt reconciles only the items submitted for that Stripe session, preserving later cart edits.

`/brands` remains a public placeholder. `/login` is also a public placeholder and is unrelated to the implemented `/admin/login` flow.

## 5. Checkout and pricing

`POST /api/checkout/session` accepts anonymous guest checkout. It validates body size, product IDs/slugs, quantities, customer fields, email, and Hong Kong delivery details. It then reloads the referenced products through the server-side anonymous Supabase client and rejects missing, inactive, changed, or insufficient-stock items.

Product prices, supported shipping country, the flat HK$50 shipping fee, stock validation, subtotal, and final total are server-controlled. Browser values are never the charging authority. The route rebuilds Stripe line items from database products, verifies the submitted subtotal against the server subtotal, constructs trusted success/cancel URLs from `SITE_URL`, and creates the Stripe Checkout Session. It does not create an order.

Checkout Session creation is limited to ten attempts per IP per minute through the shared rate-limiter abstraction.

## 6. Stripe webhook

`POST /api/stripe/webhook` runs on the Node.js runtime and verifies the raw request with `STRIPE_WEBHOOK_SECRET` before doing any work. It handles:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `refund.created`
- `refund.updated`
- `refund.failed`

Confirmed payment events load every Stripe line-item page, create or resume a pending order, persist historical order-item snapshots, and invoke the atomic stock RPC. Checkout Session creation itself never writes an order.

Preserve webhook idempotency. Current protections include unique Stripe session/payment references, order-item upserts keyed by Stripe line-item ID, the stock RPC's one-time guard, current-state refund retrieval, guarded state transitions, a stable Stripe refund idempotency key, and database-backed webhook failure recording/resolution. Permanent failures are recorded for review and acknowledged; retryable failures return an error so Stripe can redeliver.

## 7. Stock and refunds

`confirm_paid_order_and_reduce_stock` locks the order and affected products, checks authoritative quantities, and reduces stock exactly once in one transaction. If a paid order loses the stock race, the RPC records `refund_pending`; the webhook creates or recovers a full Stripe refund. A no-payment-required oversell becomes `unfulfillable` without a refund.

A succeeded full refund uses `restore_order_stock_after_refund`, which updates the refund state and restores previously reduced stock atomically and exactly once. Pending, failed, canceled, and action-required refunds do not restore inventory.

Partial refunds intentionally do not restore the full order's stock or mark the order fully refunded. They are recorded as permanent webhook failures for manual inventory and fulfilment review. Any unresolved refund failure blocks fulfilment in the database RPC until an operator resolves it.

## 8. Supabase and security

There are four Supabase trust levels:

- `client.ts` — browser anonymous client for RLS-controlled public access.
- `server.ts` — plain server-side anonymous client for public catalog reads and checkout validation.
- `admin-auth.ts` — cookie-aware `@supabase/ssr` client for Supabase Auth sessions.
- `service-role.ts` — server-only client that bypasses RLS; it throws if used in a browser.

The service-role client is used by trusted server paths for Stripe webhook order, item, stock, refund, and failure processing; verified checkout receipt reads; protected admin order reads; fulfilment reads and RPC calls; and email order/item reads plus email claim/status RPCs. Never narrow its description to only webhook and receipt code, and never expose it to client modules.

RLS permits anonymous/authenticated reads of public catalog data, limited to active products and their images. Profiles, orders, order items, webhook failures, and email delivery data have direct anonymous/authenticated access revoked and remain trusted-server data.

`middleware.ts` matches `/admin/:path*` and refreshes Supabase Auth cookies. Authorization is enforced separately at the admin pages/layout, Server Actions, admin data layer, and database RPC layer.

`next.config.ts` applies these headers to every route:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

Content Security Policy and Strict Transport Security are not currently configured.

## 9. Admin and fulfilment

The real admin area is implemented under `/admin`. `/admin/login` uses Supabase Auth password sign-in and permits only the account matching the server-only `ADMIN_EMAIL`; a missing value fails closed.

Protection is intentionally layered:

- middleware refreshes the `/admin` Supabase session;
- dashboard layouts and pages require the approved admin;
- Server Actions re-check the session;
- `src/lib/admin/` re-checks before service-role reads or writes;
- `set_order_fulfilment` locks the row and enforces database eligibility.

The admin lists orders, shows line items and private delivery details, and updates `unfulfilled`, `processing`, `shipped`, and `delivered` states. Shipping requires courier and tracking details. Only paid, confirmed, refund-free orders without unresolved refund review can move through fulfilment. Admin fulfilment controls do not edit payment, refund, total, customer, or stock fields.

## 10. Email

Email code is implemented but sends real messages only when Resend is configured with both `RESEND_API_KEY` and `EMAIL_FROM`. Confirmed orders can send a customer confirmation and an optional seller notification; refund-pending, refunded, and refund-failed orders can send customer updates.

Database email claims and stable Resend idempotency keys prevent concurrent or replayed webhooks from intentionally sending the same order/email kind twice. Delivery state is stored in Supabase. Email is a follow-on effect: configuration or provider failure must not reverse payment, alter stock, fail an otherwise processed webhook, or trigger payment reprocessing.

## 11. Rate limiting

`src/lib/rate-limit.ts` uses a shared fixed-window Upstash limiter when all three Upstash variables are set. It stores an HMAC of the namespaced client key rather than the raw IP. Missing or partial configuration, a timeout, an unusable response, or a shared-store error falls back to the bounded in-memory limiter for that request.

The in-memory map is capped at 10,000 keys and is suitable for local/single-instance behavior, but it is not shared between instances. Production multi-instance enforcement requires complete Upstash configuration and runtime verification.

## 12. Receipt verification and privacy

The checkout success URL is not proof of payment. `loadVerifiedCheckoutReceipt` validates the Session ID shape, retrieves the Stripe Session, loads the order with the service-role client, and cross-checks payment-intent ID, currency, subtotal, shipping, and total. Line items are returned only for confirmed payment and a confirmed order.

The public receipt behaves like a bearer link and minimizes exposure:

- customer email is masked;
- phone and full shipping address are not rendered;
- invalid or unverified sessions receive no customer or order data;
- pending states poll at most eight times with exponential backoff from 3 seconds, capped at 30 seconds.

## 13. Environment variables

Use the names in `.env.example`; never document or commit real values.

Browser and server:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Server only:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SITE_URL`
- `ADMIN_EMAIL`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `SELLER_NOTIFICATION_EMAIL`
- `EMAIL_REPLY_TO`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RATE_LIMIT_HASH_SECRET`

Never add a `NEXT_PUBLIC_` prefix to service-role, Stripe, admin, Resend, seller/reply-to, Upstash, or hash-secret variables.

## 14. Development commands

```bash
npm install
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

There is no separate typecheck script or configured automated test suite. For local Stripe webhook testing, run Stripe test mode and forward events separately:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use the listener's endpoint secret only in local server configuration and restart after environment changes.

## 15. Current known limitations

- Legal business details, support contacts, policy dates, delivery commitments, and return terms are placeholder content. Replace them with verified business information before accepting real payments.
- `/login` and `/brands` are public placeholders; the real authenticated operator flow is `/admin/login`.
- Email remains disabled until valid Resend sender configuration is present.
- Checkout currently supports Hong Kong only, uses a flat HK$50 shipping fee, and does not configure Stripe automatic tax.
- Admin authorization is intentionally limited to one configured Supabase Auth email.
- Stripe payment, delayed-payment, refund, email, and multi-instance Upstash paths are implemented but still require runtime verification in the intended environment. Do not claim they were tested merely because code or migrations exist.
- Full-refund stock restoration is automatic; partial refunds require manual review.

## 16. Rules for modifying the repository

1. Inspect existing code before editing.
2. Make the smallest focused change.
3. Do not change payment, stock, refund, admin, database, email, or customer-data behavior unless the task explicitly requires it.
4. Preserve server-controlled pricing, shipping, stock validation, and totals.
5. Preserve webhook idempotency.
6. Preserve atomic stock-reduction and full-refund restoration RPC behavior.
7. Never expose service-role keys, Stripe secrets, Resend keys, Upstash tokens, or hash secrets to client code.
8. Do not edit migrations that may already have been applied. Create a new migration for database changes.
9. Do not run `npm audit fix --force`.
10. Do not commit or push unless explicitly requested.
11. Preserve unrelated working-tree changes.
12. Do not stage, modify, rename, or delete `public/images/products/maison-margiela/model-5.png`.
