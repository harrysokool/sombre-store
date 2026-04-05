# Luxury Ecommerce Website Development Blueprint

## 1. Executive Summary

This project is a custom-coded luxury ecommerce storefront for premium beauty and lifestyle products such as perfume and body lotion. The business goal is to create a real, sellable brand foundation while also producing a portfolio-quality full stack project with strong design, clean architecture, and credible engineering decisions.

The technical direction should prioritize managed services for high-risk infrastructure concerns and custom code for the brand, storefront, admin UX, and product experience. That means: Next.js for the application shell and routing, Tailwind CSS for a disciplined design system, Supabase/PostgreSQL for the relational data model, Supabase Auth for authentication, Stripe Checkout for secure payments, Cloudinary for product media, and Vercel for deployment.

This stack fits because it keeps the codebase understandable for a serious solo builder using AI, avoids rebuilding solved infrastructure, and supports a premium frontend without forcing enterprise complexity. It is fast enough for iterative development but structured enough to stay maintainable.

## 2. Product Scope

### MVP Scope

- Brand-led homepage with luxury visual direction
- Product catalog with category and brand filtering
- Product detail pages with rich imagery and clear purchase CTA
- Cart with add/remove/update quantity
- Stripe Checkout for payment
- Customer auth with sign up, login, logout
- Customer account area with profile and order history
- Admin dashboard for products, inventory, images, and order viewing
- Basic inventory tracking
- Responsive UI for mobile and desktop
- Transactional states for checkout success/cancel
- Order creation through Stripe webhook, not client-side trust

### Post-MVP Scope

- Product search and smarter filtering
- Product variants such as size/volume
- Promotional collections and editorial landing pages
- Wishlist / saved items
- Customer addresses and profile editing improvements
- Basic discount code support through Stripe
- Reviews/testimonials if the business actually needs them
- Better order statuses and admin fulfillment workflow
- Analytics and conversion tracking

### Future Advanced Features

- Subscription / replenishment products
- Internationalization and multi-currency
- CMS-driven editorial content
- Email automation flows
- Loyalty / member perks
- Product bundles / gift sets
- AI-assisted product recommendations
- Staff roles beyond simple admin/customer
- Inventory audit logging and low-stock alerts

### Do Not Build Yet

- Custom payment flow
- Custom checkout UI replacing Stripe Checkout
- Marketplace / multi-vendor logic
- Full CMS before the storefront works
- Complex promotions engine
- Real-time chat support
- Overly generic plugin architecture
- Microservices
- Event bus / queue infrastructure unless a later need appears
- Complex ERP-style inventory tooling

## 3. Full Tech Stack Explanation

### Next.js

Use for the storefront app, routing, server rendering, server actions/route handlers, protected pages, and deployment-friendly full stack application structure.

Chosen because:

- Best fit for App Router-based ecommerce storefronts
- Supports server-rendered product pages for SEO and performance
- Integrates naturally with Vercel
- Lets you keep frontend and backend-adjacent logic in one codebase

Alternatives:

- Remix: strong, but smaller ecosystem and less common for AI-assisted examples
- React + Express: more moving pieces, more plumbing, weaker default architecture
- Nuxt: good, but outside your chosen React ecosystem

Why not chosen:

They either add more architectural overhead or reduce the amount of high-quality tooling/examples available for your exact stack.

### Tailwind CSS

Use for design system implementation, layout, spacing, typography utilities, and component styling.

Chosen because:

- Fast to iterate with AI and manually
- Encourages consistency if design tokens are defined early
- Excellent for premium minimal interfaces when used with discipline

Alternatives:

- CSS Modules
- Styled Components
- shadcn/ui plus Tailwind as a layer

Why not chosen:

CSS Modules alone slow UI iteration; CSS-in-JS adds runtime/styling complexity; shadcn can still be used selectively, but Tailwind remains the base styling approach.

### Supabase

Use for managed Postgres, auth, storage-adjacent integration patterns, row-level security, SQL migrations, and server/client SDKs.

Chosen because:

- Gives managed Postgres plus auth in one coherent system
- Excellent for solo builders
- Good fit for AI-assisted development due to clear SDK usage and SQL-first model

Alternatives:

- Neon + Clerk + Drizzle
- Firebase
- Self-hosted Postgres/Auth

Why not chosen:

Neon + Clerk is strong but adds more decisions and service boundaries; Firebase is weaker for relational ecommerce data; self-hosting adds ops burden you do not need.

### PostgreSQL

Use as the source of truth for products, orders, customers, categories, inventory, and admin data.

Chosen because:

- Ecommerce data is relational
- Supports constraints, joins, reporting, and integrity
- Better than document storage for order/item/product relationships

Alternatives:

- MongoDB
- MySQL

Why not chosen:

MongoDB creates unnecessary schema looseness for a business system; MySQL is viable but offers fewer advantages here than Postgres's ecosystem and Supabase integration.

### Supabase Auth

Use for registration, login, session management, and protected account/admin access.

Chosen because:

- Already integrated with Supabase user identity
- Good enough for email/password and future magic link/social expansion
- Keeps user identity and app profile linkage straightforward

Alternatives:

- Clerk
- Auth0
- NextAuth/Auth.js

Why not chosen:

Clerk/Auth0 add service sprawl and cost; Auth.js is flexible but needs more assembly and auth plumbing.

### Stripe Checkout

Use for checkout session creation, payment handling, and confirmation via webhooks.

Chosen because:

- Secure, proven, and fast to launch
- Avoids building your own payment UI and PCI-sensitive flow
- Excellent for MVP and realistic production

Alternatives:

- Stripe Payment Element
- Custom card form
- PayPal-first flow

Why not chosen:

Payment Element is more flexible but requires more implementation/detail; custom card flow is unnecessary risk; PayPal is not the right primary luxury-brand experience for this build.

### Cloudinary

Use for product image hosting, optimization, responsive transformations, and admin upload workflow.

Chosen because:

- Product imagery is core to conversion
- Strong CDN and transformation support
- Better asset workflow than dumping raw images into app storage

Alternatives:

- Supabase Storage
- Vercel Blob
- S3 + image pipeline

Why not chosen:

Supabase Storage is acceptable, but Cloudinary is better for a luxury media-heavy storefront; S3 pipelines add avoidable setup.

### Vercel

Use for deployment, preview environments, environment variable management, and operational simplicity.

Chosen because:

- Best fit for Next.js
- Strong preview deployment workflow
- Minimal deployment friction for solo development

Alternatives:

- Netlify
- Railway
- Self-hosted VPS

Why not chosen:

Netlify is less natural for this stack; Railway is stronger for backend-heavy custom infra; VPS hosting creates unnecessary ops work.

## 4. Architecture Plan

### Frontend Layer

- Next.js App Router handles routes, layouts, loading states, metadata, and page composition
- Server Components fetch public catalog data where possible
- Client Components handle interactive cart UI, filters, and small form interactions
- Tailwind implements a small, explicit design system using tokens for spacing, typography, colors, radius, and container widths

### Backend / Data Access Layer

- Use a clear `lib` + `server`/`services` structure instead of scattering SQL and SDK calls across pages
- Public catalog reads can be done through Supabase server-side clients with safe read policies
- Sensitive writes run only on the server through route handlers or server actions
- The browser never receives service-role credentials
- Stripe webhooks and admin mutations live in server-only code paths

### Auth Flow

- Supabase Auth manages identity
- On signup, create/update a `profiles` row tied to `auth.users.id`
- Public pages are accessible anonymously
- Customer account routes require authenticated sessions
- Admin routes require authenticated sessions plus `profiles.role = 'admin'`
- Middleware protects route groups and redirects unauthenticated access

### Payment Flow

- Cart exists on the client in MVP
- On checkout, client sends requested items to a server route
- Server re-fetches products/variants from Postgres, validates availability and current price, and builds Stripe Checkout line items
- Server creates Stripe Checkout session and redirects customer
- Stripe sends webhook on successful payment
- Webhook verifies signature, creates order and order_items, snapshots price/product data, updates inventory, and marks payment status
- Success page confirms completion using server-validated session/order lookup, not a client assumption

### Image / Media Flow

- Admin uploads original product images to Cloudinary
- Cloudinary stores source assets and serves transformed delivery URLs
- Database stores Cloudinary public IDs and metadata, not raw files
- Frontend uses optimized transformation URLs for grids, PDPs, thumbnails, and mobile formats
- Product image ordering is stored in the database, not inferred from filenames

### Deployment Flow

- Git-based deploys to Vercel
- Preview deploys for branch review
- Production deploy from protected main branch
- Supabase and Stripe stay as managed external services
- Webhook endpoint is hosted by Next.js on Vercel and registered in Stripe

### How Next.js and Supabase Should Work Together

- Next.js handles UI, routing, server-side orchestration, and privileged server code
- Supabase is the managed data/auth backend
- Public product data is fetched server-side for SEO and performance
- Auth session helpers bridge Supabase sessions into Next.js middleware/pages
- RLS protects user-scoped data and prevents accidental client overreach

### How Stripe Should Be Integrated Safely

- Use Stripe Checkout only
- Never trust client-submitted prices, names, totals, or stock
- Recalculate everything server-side from the database
- Use webhook signature verification
- Make order creation idempotent by keying on Stripe event/session/payment intent
- Keep Stripe secret key and webhook secret server-only

### How Cloudinary Should Fit

- Cloudinary is the media layer, not the system of record
- Product records in Postgres reference Cloudinary assets
- Admin can upload/select/reorder images through app UI
- Delivery transformations are environment-agnostic and cache-friendly

## 5. Folder Structure

Recommended App Router structure:

```txt
src/
  app/
    (store)/
      page.tsx
      products/
        page.tsx
        [slug]/page.tsx
      categories/
        [slug]/page.tsx
      brands/
        [slug]/page.tsx
      cart/page.tsx
      checkout/
        success/page.tsx
        cancel/page.tsx
    (auth)/
      login/page.tsx
      register/page.tsx
      forgot-password/page.tsx
    account/
      layout.tsx
      page.tsx
      orders/page.tsx
      orders/[orderNumber]/page.tsx
      profile/page.tsx
    admin/
      layout.tsx
      page.tsx
      products/
        page.tsx
        new/page.tsx
        [id]/page.tsx
      categories/page.tsx
      brands/page.tsx
      orders/
        page.tsx
        [id]/page.tsx
      inventory/page.tsx
      media/page.tsx
    api/
      checkout/session/route.ts
      stripe/webhook/route.ts
      cloudinary/signature/route.ts
  components/
    ui/
    layout/
    product/
    cart/
    forms/
    account/
    admin/
  lib/
    env.ts
    utils.ts
    constants.ts
    validations/
    db/
    supabase/
    stripe/
    cloudinary/
    auth/
  services/
    catalog/
    checkout/
    orders/
    admin/
    inventory/
  types/
  styles/
  middleware.ts
supabase/
  migrations/
  seed.sql
```

Rules:

- Keep UI components separate from domain/service logic
- Put provider SDK initialization in `lib`, not inside page files
- Put business workflows in `services`
- Keep admin pages isolated from storefront components where appropriate
- Prefer route groups to keep mental separation clean

## 6. Routing Plan

### Public Users

- `/` homepage
- `/products` catalog
- `/products/[slug]` product detail
- `/categories/[slug]`
- `/brands/[slug]`
- `/cart`
- `/login`
- `/register`
- `/checkout/success`
- `/checkout/cancel`
- Optional later: `/about`, `/journal`, `/contact`

### Authenticated Customers

- `/account`
- `/account/orders`
- `/account/orders/[orderNumber]`
- `/account/profile`

### Admin Users

- `/admin`
- `/admin/products`
- `/admin/products/new`
- `/admin/products/[id]`
- `/admin/categories`
- `/admin/brands`
- `/admin/orders`
- `/admin/orders/[id]`
- `/admin/inventory`
- `/admin/media`

## 7. Database Design

### Design Principles

- Use Postgres as the source of truth
- Store immutable order snapshots so product changes do not rewrite history
- Keep schema normalized but not academic
- Use explicit constraints for integrity
- Avoid premature address-book complexity in MVP

### `profiles`

Purpose: app-level profile tied to Supabase Auth user.  
Key columns: `id uuid pk references auth.users(id)`, `email`, `full_name`, `role`, `stripe_customer_id`, `created_at`.  
Relationships: one-to-many with `orders`.  
Constraints: `role` enum with `customer|admin`; `stripe_customer_id` unique nullable.

### `brands`

Purpose: luxury brand metadata.  
Key columns: `id`, `name`, `slug`, `description`, `is_active`.  
Relationships: one-to-many with `products`.  
Constraints: unique `slug`, unique `name`.

### `categories`

Purpose: catalog grouping.  
Key columns: `id`, `name`, `slug`, `description`, `parent_id nullable`, `is_active`.  
Relationships: self-referential optional hierarchy; one-to-many with `products`.  
Constraints: unique `slug`.

### `products`

Purpose: product-level catalog record.  
Key columns: `id`, `brand_id`, `category_id`, `name`, `slug`, `subtitle`, `description`, `status`, `base_price_cents`, `currency`, `sku_root`, `is_featured`, `seo_title`, `seo_description`, `created_at`.  
Relationships: belongs to brand/category; one-to-many with `product_variants`, `product_images`, `order_items`.  
Constraints: unique `slug`; status enum such as `draft|active|archived`; non-negative price.

### `product_variants`

Purpose: purchasable SKU rows for size/volume.  
Key columns: `id`, `product_id`, `name`, `sku`, `price_cents`, `compare_at_price_cents nullable`, `inventory_quantity`, `is_default`, `is_active`.  
Relationships: belongs to product; referenced by `order_items`.  
Constraints: unique `sku`; one default variant per product; non-negative inventory and price.

### `product_images`

Purpose: ordered product media.  
Key columns: `id`, `product_id`, `variant_id nullable`, `cloudinary_public_id`, `alt_text`, `sort_order`, `width`, `height`, `is_primary`.  
Relationships: belongs to product, optionally variant.  
Constraints: unique `(product_id, sort_order)`; one primary image rule enforced in app logic or partial index.

### `orders`

Purpose: commercial transaction header.  
Key columns: `id`, `order_number`, `profile_id nullable`, `email`, `status`, `payment_status`, `fulfillment_status`, `currency`, `subtotal_cents`, `shipping_cents`, `tax_cents`, `total_cents`, `stripe_checkout_session_id`, `stripe_payment_intent_id`, `shipping_address_json`, `billing_address_json`, `created_at`.  
Relationships: one-to-many with `order_items`; belongs optionally to profile.  
Constraints: unique `order_number`; unique nullable Stripe IDs; amounts non-negative.

### `order_items`

Purpose: immutable line-item snapshots.  
Key columns: `id`, `order_id`, `product_id`, `variant_id`, `product_name_snapshot`, `variant_name_snapshot`, `sku_snapshot`, `unit_price_cents`, `quantity`, `line_total_cents`, `primary_image_snapshot`.  
Relationships: belongs to order; references original product/variant for admin traceability.  
Constraints: quantity > 0; price snapshots non-negative.

### `inventory_transactions`

Purpose: audit inventory changes beyond simple quantity fields.  
Key columns: `id`, `variant_id`, `type`, `quantity_delta`, `reference_type`, `reference_id`, `note`, `created_at`.  
Relationships: belongs to variant.  
Constraints: enum type like `manual_adjustment|order_reserved|order_paid|restock`.

### `admin_audit_logs`

Purpose: lightweight admin traceability.  
Key columns: `id`, `actor_profile_id`, `action`, `entity_type`, `entity_id`, `metadata_json`, `created_at`.  
Relationships: belongs to actor profile.  
Constraints: none beyond basic integrity.

### Cart Decision for Schema

Do not create persistent `carts` / `cart_items` tables in MVP.  
Reason:

- Guest checkout is the default path
- A local cart is enough for MVP
- Database carts add merge/sync complexity early
- Orders, not carts, are the critical business record

Later, if needed, add `saved_carts` or wishlist tables.

## 8. Authentication and Authorization Plan

- Use Supabase email/password auth for MVP
- On signup: create auth user, then ensure `profiles` row exists through trigger or post-signup server logic
- On login: Supabase session is established and read in Next.js
- On logout: clear Supabase session and redirect to public route
- Protect `/account/*` via middleware plus server-side checks
- Protect `/admin/*` via middleware plus server-side role verification
- Do not rely on client-side role checks alone
- Store role in `profiles.role`
- Use RLS so customers can only read their own profile/orders
- Admin operations should go through server-only code paths using elevated credentials where needed
- Keep service-role usage narrowly scoped to admin/server workflows only

Recommended authorization model:

- Anonymous: public catalog only
- Customer: own profile, own orders
- Admin: product/category/brand/media/order/inventory management

## 9. Cart and Checkout Plan

### Cart

Recommended MVP decision: local cart in browser storage.  
Reason:

- Simplest guest checkout path
- No cart sync complexity
- Faster to build and easier to reason about

Cart item shape:

- `productId`
- `variantId`
- `name snapshot`
- `price display snapshot`
- `image`
- `quantity`

Important rule:  
Local cart data is for UI convenience only. Server revalidates everything before checkout.

### Core Cart Actions

- Add to cart: if same variant exists, increment quantity
- Remove from cart: delete item
- Update quantity: clamp between 1 and available soft limit
- Empty cart: optional helper after success

### Checkout Session Creation

- Client submits cart payload to `/api/checkout/session`
- Server loads variants/products from database
- Validate product status, active flag, price, and stock
- Create Stripe customer if signed in and missing `stripe_customer_id`
- Build Stripe Checkout session using server-side line items
- Include metadata for `profile_id`, order source, and normalized cart references
- Return Checkout session URL for redirect

### Stripe Redirect

- Use Stripe-hosted Checkout page
- No card collection in your app
- Success URL and cancel URL point back to Next.js routes

### Success and Cancel Flow

- `/checkout/cancel`: preserve cart and explain nothing was charged
- `/checkout/success`: do not assume payment from query params alone; load order/session server-side and confirm status

### Safe Order Creation Flow

Recommended choice: create final orders in the Stripe webhook, not before redirect.  
Reason:

- Source of truth is payment confirmation
- Avoids abandoned "orders" that were never paid
- Cleaner order lifecycle

Webhook steps:

1. Verify Stripe signature
2. Handle `checkout.session.completed`
3. Idempotency check using Stripe event/session ID
4. Fetch line items or use stored references
5. Insert order row
6. Insert order_items snapshot rows
7. Decrement inventory
8. Record inventory transaction
9. Mark order/payment status
10. Optionally clear customer-side cart UX on next session

### Inventory Updates

- Reduce inventory only after successful payment event
- If stock gets tight, validate again at checkout session creation
- In later phases, consider short reservation windows only if oversell becomes a real issue

## 10. Admin Dashboard Plan

### MVP Admin

- Admin login protection
- Product CRUD
- Brand/category CRUD
- Variant and inventory editing
- Product image upload/select/reorder
- Order list and order detail view
- Basic status updates for fulfillment

### Later Admin Features

- Bulk inventory updates
- Rich merchandising controls
- Featured collections
- Sales/reporting dashboard
- Discount/content management
- Audit log viewer
- Staff role granularity

### Access Protection

- `/admin/*` requires authenticated admin role
- Every admin mutation must be server-side authorized
- Never trust hidden UI alone
- Log meaningful admin mutations in audit logs

## 11. UI and Design System Plan

### Luxury Visual Direction

- Minimal, intentional, and editorial
- Large whitespace, restrained copy, and strong product photography
- Trust through clarity, not clutter

### Layout Principles

- Wide but controlled content containers
- Strong visual rhythm using generous vertical spacing
- Avoid crowded cards and dense UI
- Use consistent section templates for hero, featured collection, product grid, and editorial blocks

### Spacing

- Define spacing scale once and use it everywhere
- Bias toward slightly larger spacing than default SaaS UIs
- Mobile should still feel airy, not cramped

### Typography

- Choose one refined serif or high-character display face for headings and one clean sans-serif for body/interface text
- Limit the number of font families
- Use typography hierarchy deliberately; luxury design fails when everything is the same size/weight

### Color Direction

- Neutral palette first: warm white, charcoal, stone, muted olive/taupe, subtle metallic accent if needed
- Avoid loud gradients and generic "startup" colors
- Use color sparingly; let imagery and whitespace do the work

### Image Usage

- Large, high-quality editorial product photography
- Multiple PDP images including texture, packaging, detail, and scale
- Consistent aspect ratios in grids
- Strong alt text for accessibility and SEO

### Product Card Design

- Quiet and minimal
- Product image dominant
- Brand + product name + key variant/size + price
- Subtle hover states, never noisy interactions
- Avoid badges everywhere; use merchandising selectively

### Homepage Direction

- Strong hero with visual atmosphere
- Featured collection block
- Category/ritual sections
- Brand story or ingredient story
- Social proof only if elegant and credible
- Footer with minimal but trustworthy information

### UX Principles for Luxury Ecommerce

- Fast load, simple navigation, low-friction purchase path
- Fewer choices per screen, better curation
- Product pages should answer trust questions quickly
- Checkout path must feel calm and straightforward

## 12. Development Phases

### Phase 1: Foundation

Objective: create project skeleton and infrastructure.  
Deliverables: Next.js app, Tailwind setup, environment management, Supabase project, baseline schema, auth wiring plan, lint/format/test setup, design tokens.  
Dependencies: none.  
Exit criteria: app boots cleanly, database connected, conventions defined.

### Phase 2: Catalog Backend

Objective: model and seed commerce data.  
Deliverables: migrations for brands/categories/products/variants/images, seed data, typed queries, sample admin-safe data access.  
Dependencies: Phase 1.  
Exit criteria: catalog can be queried reliably.

### Phase 3: Storefront UI

Objective: build public-facing shopping experience.  
Deliverables: homepage, product listing, product detail, filtering, responsive shells, reusable product components.  
Dependencies: catalog backend.  
Exit criteria: anonymous users can browse a polished catalog.

### Phase 4: Cart + Auth

Objective: support customer identity and shopping state.  
Deliverables: local cart, login/register/logout, protected account area, profile row creation, order-history placeholders.  
Dependencies: storefront + auth setup.  
Exit criteria: customer auth works and cart UX is stable.

### Phase 5: Checkout + Orders

Objective: complete the revenue path.  
Deliverables: checkout session API, Stripe Checkout integration, success/cancel pages, webhook handler, order creation, inventory decrement.  
Dependencies: cart, products, auth optional but supported.  
Exit criteria: test payment completes and creates correct order data.

### Phase 6: Admin MVP

Objective: enable business operations.  
Deliverables: admin auth guard, product CRUD, image handling, inventory editing, order viewing.  
Dependencies: catalog and auth.  
Exit criteria: you can manage core store data without touching SQL manually.

### Phase 7: Hardening

Objective: prepare for deployment confidence.  
Deliverables: RLS validation, error handling, empty/loading states, SEO metadata, test coverage for critical flows, performance pass.  
Dependencies: all critical features built.  
Exit criteria: system is stable enough for production deployment.

## 13. Milestones

- Project foundation complete
- Database schema and seed data complete
- Storefront MVP complete
- Auth complete
- Checkout complete
- Order pipeline complete
- Admin MVP complete
- Deployment-ready
- Launch-ready

## 14. Build Order

1. Define product/brand/category model and naming conventions.
2. Initialize Next.js App Router project structure and Tailwind design tokens.
3. Create Supabase project and write first SQL migrations.
4. Implement catalog schema and seed data.
5. Build reusable layout shell, typography, spacing, and button/input/card primitives.
6. Build homepage and catalog routes.
7. Build product detail pages.
8. Implement local cart state and cart page.
9. Implement Supabase Auth and account routes.
10. Build checkout session creation endpoint.
11. Integrate Stripe Checkout redirect.
12. Build Stripe webhook and safe order creation.
13. Add order history pages.
14. Build admin auth guard and dashboard shell.
15. Build admin product/category/brand/image/inventory management.
16. Add order management screens.
17. Run hardening pass on auth, authorization, checkout, and empty/error states.
18. Configure production environments and deploy previews.
19. Run full test checklist before production.

## 15. Risks and Common Mistakes

- Letting AI scatter business logic across page files
- Creating schema too loosely and regretting it once orders exist
- Trusting client-side prices or totals in checkout
- Protecting admin pages in the UI but not on the server
- Building persistent cart complexity too early
- Skipping order snapshot fields and losing historical accuracy
- Mixing Cloudinary media logic directly into presentational components
- Overbuilding the admin panel before storefront conversion flow works
- Using too many one-off Tailwind styles without design tokens
- Failing to define file/folder boundaries early
- Treating Stripe success redirects as payment confirmation instead of using webhooks
- Letting AI invent auth/authorization rules without manual review

## 16. Rules for AI-Assisted Development

- Use AI for scaffolding, repetitive CRUD, component drafts, SQL boilerplate, and test draft generation.
- Review manually before merging any auth, payment, webhook, RLS, or inventory code.
- Require AI-generated code to fit existing folder conventions before accepting it.
- Do not accept code you cannot explain.
- Prefer smaller prompts targeted at one layer at a time.
- Ask AI to modify existing patterns instead of inventing new abstractions.
- Reject abstractions that are not clearly paying for themselves.
- Manually review every migration and schema change.
- Manually trace every critical user flow after AI changes it.
- Keep a short architecture note in the repo so AI outputs stay aligned.

## 17. Environment / Config Planning

Likely environment variables and config areas:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` if needed for limited client usage
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `ADMIN_EMAIL_ALLOWLIST` optional bootstrap safeguard
- `VERCEL_ENV`
- `NEXT_PUBLIC_APP_ENV`
- Supabase redirect URLs
- Stripe success/cancel/webhook endpoint config
- Cloudinary upload preset or signed-upload configuration

## 18. Testing and Validation Strategy

Before launch, validate:

- signup, login, logout, and session persistence
- protected account pages
- admin-only route protection and server-side enforcement
- add/remove/update cart actions
- checkout session creation with valid and invalid cart data
- Stripe test checkout end-to-end
- webhook idempotency and duplicate event handling
- order creation correctness
- inventory decrement correctness
- order history visibility by the right user only
- image upload, display, ordering, and responsive delivery
- empty states, loading states, and error states
- mobile and desktop layout quality
- SEO basics: metadata, product page titles, alt text, canonical behavior if needed

Recommended test mix:

- Manual end-to-end testing for checkout and admin flows
- Integration tests for checkout/order services
- Basic component tests only for important UI logic
- SQL policy tests or at minimum manual RLS verification

## 19. Deployment Plan

- Deploy app on Vercel
- Use separate Supabase project for production
- Use Stripe test mode until launch checklist is complete
- Register production webhook endpoint in Stripe
- Configure Cloudinary production account/folder structure
- Use preview deployments for feature validation
- Protect production environment variables tightly
- Keep main branch deployment-controlled

Pre-production checks:

- environment variables complete
- database migrations applied cleanly
- RLS rules verified
- Stripe webhook verified in test mode
- success/cancel URLs correct
- admin role assigned correctly
- product images optimized and loading fast
- no placeholder copy/assets in critical pages
- responsive QA complete
- core Lighthouse/performance pass reasonable for storefront pages

## 20. Recommended Immediate Next Steps

1. Replace the current `PROJECT_PLAN.md` with this blueprint as the single source of truth.
2. Create a one-page architecture note containing your non-negotiable rules: local cart for MVP, Stripe Checkout only, orders created by webhook, `profiles.role` for admin, Cloudinary for product media.
3. Initialize the Next.js project and commit only the base structure and tooling conventions.
4. Create the initial Supabase schema for `profiles`, `brands`, `categories`, `products`, `product_variants`, `product_images`, `orders`, and `order_items`.
5. Prepare a small set of realistic seed products so the storefront can be built against real-looking data instead of placeholders.
6. Define the design tokens early: fonts, spacing scale, colors, radius, container widths, and image ratios.
7. Build in this order next: catalog data model, storefront shell, product pages, cart, auth, checkout, webhook orders, admin.

## Assumptions and Defaults

- This plan is for a single-brand ecommerce store, not a marketplace.
- MVP uses one primary currency and one primary shipping region.
- Tax/shipping complexity stays simple in MVP and is handled primarily through Stripe configuration plus order snapshots.
- Guest checkout is allowed.
- Cart remains local-only in MVP.
- `profiles.role` is sufficient for authorization until staff complexity becomes real.
- Product variants are required because premium beauty products often differ by size or volume.
