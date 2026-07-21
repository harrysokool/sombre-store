-- Public catalog reads remain available while customer and order data is
-- restricted to trusted server code using the service role.

alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Remove direct access to private customer and purchase data. No RLS policies
-- are created for these tables, so only roles that bypass RLS can access them.
revoke all privileges on table public.profiles from anon, authenticated;
revoke all privileges on table public.orders from anon, authenticated;
revoke all privileges on table public.order_items from anon, authenticated;

-- Catalog users may read, but never mutate, storefront data directly.
revoke insert, update, delete, truncate, references, trigger
  on table public.brands, public.categories, public.products, public.product_images
  from anon, authenticated;

grant select
  on table public.brands, public.categories, public.products, public.product_images
  to anon, authenticated;

create policy "Public can read brands"
  on public.brands
  for select
  to anon, authenticated
  using (true);

create policy "Public can read categories"
  on public.categories
  for select
  to anon, authenticated
  using (true);

create policy "Public can read active products"
  on public.products
  for select
  to anon, authenticated
  using (is_active = true);

create policy "Public can read images for active products"
  on public.product_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products
      where products.id = product_images.product_id
      and products.is_active = true
    )
  );
