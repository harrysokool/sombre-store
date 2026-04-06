-- MVP order schema for Sombre.
-- Scope is intentionally limited to persisted purchases from Stripe Checkout.

-- Top-level purchase record created from a completed Stripe Checkout Session.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null,
  stripe_payment_intent_id text,
  customer_email text not null,
  customer_name text not null,
  customer_phone text,
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  postal_code text not null,
  country text not null,
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  currency text not null default 'usd' check (char_length(currency) = 3),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'no_payment_required', 'failed', 'canceled')),
  created_at timestamptz not null default timezone('utc', now()),
  constraint orders_stripe_session_id_unique unique (stripe_session_id),
  constraint orders_stripe_payment_intent_id_unique unique (stripe_payment_intent_id)
);

comment on table public.orders is 'Persisted customer purchases created from Stripe Checkout.';

-- Snapshot of each purchased line item so later catalog changes do not affect history.
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  size_label text,
  image_url text,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.order_items is 'Historical line items for each order, including product snapshots.';

-- Useful lookup indexes for basic order operations.
create index if not exists idx_orders_created_at on public.orders (created_at desc);
create index if not exists idx_orders_customer_email on public.orders (customer_email);
create index if not exists idx_orders_payment_status on public.orders (payment_status);
create index if not exists idx_order_items_order_id on public.order_items (order_id);
create index if not exists idx_order_items_product_id on public.order_items (product_id);
