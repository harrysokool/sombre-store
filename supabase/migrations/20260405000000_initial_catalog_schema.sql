-- MVP catalog schema for Sombre.
-- Scope is intentionally limited to profiles and product catalog data.

create extension if not exists pgcrypto;

-- Keeps updated_at in sync for tables that can be edited over time.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Mirrors authenticated users with app-specific profile fields.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.profiles is 'Application profile data for authenticated users.';

-- Product brand or house, e.g. Diptyque or Byredo.
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint brands_name_unique unique (name),
  constraint brands_slug_unique unique (slug)
);

comment on table public.brands is 'Brands that products belong to.';

-- Simple product grouping for navigation and filtering.
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint categories_name_unique unique (name),
  constraint categories_slug_unique unique (slug)
);

comment on table public.categories is 'Product categories used for storefront navigation.';

-- Core sellable catalog item.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete restrict,
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null,
  slug text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint products_slug_unique unique (slug)
);

comment on table public.products is 'Catalog products displayed on the storefront.';

-- Ordered gallery images for a product.
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  constraint product_images_product_id_sort_order_unique unique (product_id, sort_order)
);

comment on table public.product_images is 'Ordered image assets for each product.';

-- Useful lookup indexes for a storefront MVP.
create index if not exists idx_products_brand_id on public.products (brand_id);
create index if not exists idx_products_category_id on public.products (category_id);
create index if not exists idx_products_is_active_featured on public.products (is_active, is_featured);
create index if not exists idx_product_images_product_id on public.product_images (product_id);
create unique index if not exists idx_product_images_one_primary_per_product
  on public.product_images (product_id)
  where is_primary = true;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger set_brands_updated_at
before update on public.brands
for each row
execute function public.set_updated_at();

create trigger set_categories_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();

create trigger set_products_updated_at
before update on public.products
for each row
execute function public.set_updated_at();
