# Sombre

Sombre is a production-oriented ecommerce storefront for selling fragrance products. It provides a customer-facing catalog and checkout flow, Stripe-hosted payments, Supabase-backed inventory and order records, an authenticated order-fulfilment area, and optional transactional email delivery.

The repository contains the application and database changes needed to operate the store, but production use still depends on verified business information, production service configuration, applied database migrations, and end-to-end test-mode validation.

## Technology

- Next.js App Router and React
- TypeScript
- Tailwind CSS
- Supabase Postgres and Supabase Auth
- Stripe Checkout and signed Stripe webhooks
- Resend transactional email support

## Main systems

### Storefront and catalog

The storefront reads active brands, categories, products, stock quantities, and product images from Supabase. Customer routes include the homepage, shop views, product pages, cart, checkout, checkout outcomes, informational pages, and store policies.

### Cart and checkout

The guest cart is stored in browser `localStorage`. Before redirecting to Stripe Checkout, the server:

- validates the checkout payload and customer fields;
- reloads products from Supabase;
- rejects inactive, missing, mismatched, or insufficient-stock products;
- calculates prices and totals from server-side product data; and
- adds the configured Hong Kong shipping fee.

Browser-supplied product prices are not used as the authority for Stripe charges.

### Stripe webhooks, orders, and stock

`POST /api/stripe/webhook` verifies the Stripe signature before processing an event. Confirmed Checkout Sessions are persisted as `orders` and historical `order_items`. Database functions perform stock confirmation and reduction atomically and guard repeated webhook delivery from reducing the same stock twice.

The webhook handles:

- `checkout.session.completed`;
- `checkout.session.async_payment_succeeded`;
- `checkout.session.async_payment_failed`;
- `refund.created`;
- `refund.updated`; and
- `refund.failed`.

Paid orders that cannot be fulfilled because stock is no longer available enter the refund flow. A succeeded full refund restores previously reduced stock once. Partial refunds and unresolved refund events require operational review.

### Admin fulfilment

The `/admin` area uses Supabase Auth password sign-in and permits only the account matching the server-side `ADMIN_EMAIL` setting. It provides order and line-item inspection plus guarded fulfilment transitions through unfulfilled, processing, shipped, and delivered states. Payment, refund, totals, customer data, and stock are not edited by the fulfilment controls.

### Transactional email

When Resend is configured, confirmed orders can send a customer confirmation and an optional seller notification. Refund-pending, refunded, and refund-failed orders can send customer status messages. Email claims and provider idempotency keys prevent repeated webhook delivery from intentionally sending the same message twice.

Email delivery is a follow-on operation: an email-provider failure does not reverse a payment, change stock, or fail an otherwise processed webhook.

### Legal and support configuration

Public policy content reads business information from `src/lib/legal/business-details.ts`. Those values are currently explicit placeholders and must be replaced with verified legal, address, support, return, delivery, and policy information before production commerce is enabled.

The Contact page also records that no verified public support channel is currently configured. A monitored support and privacy contact must be established before launch, particularly for order and refund escalation.

## Local development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Run lint:

```bash
npm run lint
```

Run TypeScript without emitting files:

```bash
npx tsc --noEmit
```

Create a production build:

```bash
npm run build
```

There is no separate `typecheck` npm script; type checking uses the installed TypeScript compiler directly.

## Environment variables

Use `.env.local` for local development. Do not put real credentials in `.env.example`, documentation, commits, logs, or client-side code.

### Supabase

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Supabase project URL used by storefront and authenticated server clients. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser and server | Supabase anonymous key. Access remains subject to database privileges and RLS policies. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Trusted order, stock, refund, email, and admin data operations. This key bypasses RLS. |

### Stripe

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Server only | Creates and retrieves Stripe objects. Use a test-mode key for local development. |
| `STRIPE_WEBHOOK_SECRET` | Server only | Verifies signatures for `POST /api/stripe/webhook`. |

Stripe-hosted Checkout is created on the server, so the application does not currently use a Stripe publishable key.

### Site configuration

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `SITE_URL` | Server only | Trusted origin used to construct Stripe success and cancel URLs. Production requires an HTTPS origin without a path, query, fragment, or embedded credentials. |

Local development falls back to `http://localhost:3000` when `SITE_URL` is not set. Production does not use that fallback.

### Admin authentication

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `ADMIN_EMAIL` | Server only | Email address of the single Supabase Auth account permitted to access `/admin`. If unset, admin access fails closed. |

The corresponding user and password are managed through Supabase Auth; no admin password belongs in application environment files.

### Resend and email

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | Server only | Enables Resend delivery. |
| `EMAIL_FROM` | Server only | Verified sender used for transactional messages. |
| `SELLER_NOTIFICATION_EMAIL` | Server only, optional | Receives new-order notifications when configured. |
| `EMAIL_REPLY_TO` | Server only, optional | Reply-to address for transactional messages. |

Both `RESEND_API_KEY` and `EMAIL_FROM` are required to enable email delivery. Checkout continues without email when either is absent.

Only variables intentionally named with `NEXT_PUBLIC_` are exposed to browser bundles. Service-role, Stripe, admin, Resend, sender, recipient, and signing-secret values must remain server-only and must never be renamed with a `NEXT_PUBLIC_` prefix.

## Supabase database workflow

Versioned database changes are stored in `supabase/migrations/`. Files in `supabase/manual/` are deliberate catalog maintenance scripts and are not part of the automatic migration sequence. `supabase/seed.sql` contains local placeholder catalog data and must not be applied to production as part of a migration push.

Authenticate the Supabase CLI, then link the working copy to the intended project:

```bash
npx supabase link --project-ref <project-ref>
```

Confirm the linked target before continuing. Inspect local and remote migration history:

```bash
npx supabase migration list --linked
```

Preview pending changes without applying them:

```bash
npx supabase db push --linked --dry-run
```

Before applying a production migration:

1. confirm the linked project and environment;
2. review every pending SQL file in order;
3. assess locking, backfill, data, and rollback implications;
4. take any required backup or recovery step; and
5. schedule an appropriate deployment window.

Apply reviewed migrations deliberately:

```bash
npx supabase db push --linked
```

Do not automatically push production migrations as an unreviewed deployment side effect. Verify migration history again after the push.

## Stripe development workflow

Use Stripe test mode for local checkout, webhook, refund, and replay testing.

1. Configure a test-mode `STRIPE_SECRET_KEY`.
2. Start the application with `npm run dev`.
3. In a separate terminal, forward Stripe test events:

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. Set `STRIPE_WEBHOOK_SECRET` to the signing secret printed by that local listener.
5. Restart the application after changing environment variables.
6. Complete checkout with Stripe test payment details.
7. Create and observe a full test refund before considering live mode.
8. Replay relevant test events and confirm order, inventory, refund, and email idempotency.

The local Stripe CLI signing secret and a deployed webhook endpoint's signing secret are different. Each environment must use the secret belonging to the endpoint delivering its events.

Before live mode, configure the deployed webhook URL as:

```text
https://<trusted-host>/api/stripe/webhook
```

Subscribe it only to the event types the application handles, and complete the full checkout and refund workflow in test mode first.

## Deployment notes

A deployment is not ready for commerce until maintainers have:

- configured all production Supabase, Stripe, site, and admin variables;
- set `SITE_URL` to the exact trusted HTTPS origin;
- linked and verified the intended Supabase production project;
- reviewed and applied all pending migrations;
- configured the deployed Stripe webhook and its matching signing secret;
- configured and verified the Resend sender, reply-to address, and seller recipient as needed;
- replaced legal and support placeholders with approved business information;
- completed an end-to-end test-mode purchase;
- verified webhook-driven order creation and stock reduction; and
- completed a full test-mode refund and stock-restoration check.

Do not infer deployment status from the presence of configuration files or application code.

## Operational checks

Run these checks in an isolated test environment before release and after relevant payment, inventory, migration, or email changes:

- [ ] A valid cart creates a Stripe Checkout Session with database prices, correct quantities, and the configured shipping fee.
- [ ] A successful test payment creates one order and the complete set of order items.
- [ ] Confirmed payment reduces each product's stock by the purchased quantity.
- [ ] Replaying the same checkout event creates no duplicate order items and does not reduce stock again.
- [ ] The order appears in the authenticated admin area with correct customer, amount, payment, order, and fulfilment state.
- [ ] Eligible fulfilment transitions work, and ineligible or refunded orders remain locked.
- [ ] A succeeded full refund updates the order and restores previously reduced stock.
- [ ] Replaying refund events does not restore stock more than once.
- [ ] The customer receives the appropriate confirmation or refund email when email is enabled.
- [ ] The configured seller receives one new-order notification when seller notifications are enabled.

## Current limitations

- Legal business details, support contacts, policy dates, delivery commitments, and return terms are placeholders pending verified business decisions.
- No public customer-service email or working contact form is currently published.
- Transactional email is disabled when `RESEND_API_KEY` or `EMAIL_FROM` is not configured; seller notifications additionally require `SELLER_NOTIFICATION_EMAIL`.
- Checkout currently supports delivery to Hong Kong only and applies a flat HK$50 shipping fee.
- Stripe Checkout creation does not configure a separate automatic tax calculation.
- Admin access is intentionally limited to one configured Supabase Auth email.
- Automatic inventory restoration applies to succeeded full refunds. Partial refunds require manual operational review.
- The `best-sellers` shop view has no sales-ranking source and currently displays the full edit.

## Security rules

- Never commit `.env`, `.env.local`, or other files containing credentials.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser, logs, or untrusted clients.
- Never expose `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET`.
- Never bypass Stripe webhook signature verification, including during testing.
- Never trust prices, totals, discounts, product status, or stock supplied by the browser; revalidate authoritative values on the server.
- Keep Supabase RLS and database privileges enabled and reviewed for customer and order data.
- Review every migration and its target environment before applying it.
- Use test-mode credentials and test data for development and operational verification.
