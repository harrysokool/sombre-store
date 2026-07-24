# CLAUDE.md

Concise guidance for working in the current Sombre repository. Inspect code and migrations before editing or making architecture claims.

## 1. Project overview

Sombre is a fragrance ecommerce storefront with a Supabase catalog, browser-local guest cart, Stripe Checkout, webhook-created orders, stock and refund handling, authenticated admin fulfilment, and optional transactional email.

The frontend uses the Next.js App Router with server-rendered catalog pages, a `localStorage` cart, a responsive hero built with `getImageProps` and `<picture>`, admin routes, and branded error/not-found pages.

`/admin` is a real protected area using Supabase Auth. `/admin/login` is its authentication flow. The public `/login` route is a separate placeholder, and `/brands` is also a public placeholder.

Implemented code is not proof of production readiness or runtime verification.

## 2. Technology stack

- Next.js 16 App Router, React 19, and TypeScript 5
- Tailwind CSS 4
- Supabase Postgres, Auth, `@supabase/supabase-js`, and `@supabase/ssr`
- Stripe Checkout and signed webhooks
- Resend transactional email
- Upstash Redis rate limiting with an in-memory fallback

## 3. Important repository locations

- `src/app/` — storefront, checkout, public pages, admin routes, and API routes
- `src/app/api/checkout/session/route.ts` — server validation and Stripe Checkout creation
- `src/app/api/stripe/webhook/route.ts` — payment, order, stock, refund, and failure processing
- `src/components/` and `src/hooks/` — UI and client behavior
- `src/lib/cart/` and `src/lib/checkout/` — local cart, shipping/totals, and verified receipts
- `src/lib/storefront/` — public Supabase catalog reads
- `src/lib/supabase/` — anonymous, Auth, and server-only service-role clients
- `src/lib/admin/` and `src/lib/email/` — protected fulfilment and transactional email
- `src/lib/rate-limit.ts` — Upstash limiter and bounded fallback
- `middleware.ts` — refreshes Supabase Auth sessions for `/admin`
- `next.config.ts` — global baseline security headers
- `supabase/migrations/` — append-only database history and trusted RPCs
- `supabase/manual/` — deliberate catalog SQL outside automatic migrations
- `public/images/products/` — local product and campaign assets

## 4. Critical system invariants

1. Product prices, supported shipping, stock validation, subtotal, and total are controlled and recalculated by the server. Never trust browser cart values as the charging authority.
2. Checkout Session creation validates the guest payload and creates Stripe Checkout only; it does not create an order.
3. Signature-verified Stripe webhooks create or resume orders after confirmed payment, including delayed-payment completion.
4. Webhook processing must remain idempotent across repeated and concurrent delivery. Preserve unique Stripe references, item upserts, guarded transitions, RPC guards, and stable provider idempotency keys.
5. Stock reduction uses `confirm_paid_order_and_reduce_stock`; succeeded full-refund restoration uses `restore_order_stock_after_refund`. Both are atomic Supabase RPC paths and must remain exactly-once.
6. Paid oversells enter the refund path. Partial refunds do not automatically restore stock and require manual inventory and fulfilment review.
7. The Supabase service-role key and client must remain server-only. Trusted webhook, receipt, admin, fulfilment, and email code may use them; client code must not.
8. Public catalog reads use RLS-controlled anonymous access. Private order, customer, webhook-failure, and email data remain trusted-server data.
9. Admin authorization must fail closed. Middleware refreshes sessions, while pages/layouts, Server Actions, the admin data layer, and the database fulfilment RPC independently enforce eligibility. A missing or mismatched `ADMIN_EMAIL` grants no access.
10. Email is optional and requires Resend configuration. Email failure must never reverse payment, alter stock, fail an otherwise processed webhook, or cause payment reprocessing.
11. Production checkout rate limiting uses shared Upstash Redis when fully configured and falls back to a bounded per-instance in-memory limiter when unavailable.
12. The success URL is not proof of payment. Receipt data must be cross-checked against Stripe and Supabase, show only confirmed data, mask email, omit phone/full address, reveal no customer data for invalid sessions, and keep polling bounded.
13. Global baseline security headers are configured in `next.config.ts`; CSP and HSTS are not currently configured.
14. Applied migrations are immutable. Add a new migration for every database change.
15. Use `.env.example` as the environment-variable source of truth. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` may use the `NEXT_PUBLIC_` prefix; all credentials, service keys, tokens, and hash secrets remain server-only.

## 5. Current limitations

- Legal business details, support contacts, policy dates, delivery commitments, and return terms are placeholders and must be verified before real payments.
- Real email delivery is disabled until valid Resend sender configuration is provided.
- Production deployment and operational monitoring are not complete or verified.
- Stripe payment, delayed-payment, refund, email, and multi-instance Upstash paths still require runtime testing in the intended environment.
- Checkout currently supports Hong Kong only, uses a flat HK$50 shipping fee, and does not configure Stripe automatic tax.
- Admin access is intentionally limited to one configured Supabase Auth email.
- `/login` and `/brands` remain public placeholders; `/admin/login` is the real operator sign-in.
- There is no configured automated test suite.

## 6. Development and verification commands

```bash
npm install
npm run dev
npm run lint
npx tsc --noEmit
npm run build
git diff --check
git status --short
git diff -- CLAUDE.md
```

For local Stripe test webhooks, run `stripe listen --forward-to localhost:3000/api/stripe/webhook` separately and use that listener's endpoint secret only in local server configuration.

## 7. Rules for modifying the repository

1. Inspect existing code before editing and make the smallest focused change.
2. Do not change payment, stock, refund, admin, database, email, or customer-data behavior unless explicitly required.
3. Preserve server-controlled pricing/validation, webhook idempotency, layered admin authorization, receipt privacy, and atomic stock/refund RPC behavior.
4. Never expose Supabase service-role keys, Stripe secrets, Resend keys, Upstash tokens, or hash secrets to client code or logs.
5. Never edit a migration that may have been applied; create a new migration.
6. Use test credentials and verify runtime behavior before claiming a payment-related path works.
7. Do not run `npm audit fix --force`.
8. Do not commit, push, or stage files unless explicitly requested.
9. Preserve unrelated working-tree changes.
10. Do not stage, modify, rename, or delete `public/images/products/maison-margiela/model-5.png`.
