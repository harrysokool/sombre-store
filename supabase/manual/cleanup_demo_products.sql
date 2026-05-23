-- Remove old demo/sample products from the active catalog before soft launch.
--
-- This script intentionally deletes only known demo products by BOTH:
--   1. product slug
--   2. demo brand slug
--
-- It does not delete brands, categories, orders, or order_items.
-- If historical order_items reference one of these products, the existing
-- foreign key on order_items.product_id may set that product_id to null when
-- the product is deleted; the order_items rows themselves are preserved.

begin;

create temp table cleanup_demo_product_targets (
  brand_slug text not null,
  product_slug text not null,
  primary key (brand_slug, product_slug)
) on commit drop;

insert into cleanup_demo_product_targets (brand_slug, product_slug)
values
  ('noct-atelier', 'velvet-ember'),
  ('noct-atelier', 'dusk-veil'),
  ('vale-and-hearth', 'silken-resin-body-lotion'),
  ('vale-and-hearth', 'stone-moss-hand-wash'),
  ('lune-forme', 'quiet-flame-candle'),
  ('lune-forme', 'pale-marble-body-cleanser');

-- Review the exact product rows that will be removed.
with demo_products as (
  select
    products.id,
    products.name,
    products.slug,
    brands.name as brand_name,
    brands.slug as brand_slug,
    categories.name as category_name,
    categories.slug as category_slug,
    count(product_images.id) as image_count
  from public.products
  join public.brands
    on brands.id = products.brand_id
  join public.categories
    on categories.id = products.category_id
  left join public.product_images
    on product_images.product_id = products.id
  join cleanup_demo_product_targets as targets
    on targets.brand_slug = brands.slug
    and targets.product_slug = products.slug
  group by
    products.id,
    products.name,
    products.slug,
    brands.name,
    brands.slug,
    categories.name,
    categories.slug
)
select *
from demo_products
order by brand_name, name;

-- Remove image rows for the targeted demo products first.
with demo_products as (
  select products.id
  from public.products
  join public.brands
    on brands.id = products.brand_id
  join cleanup_demo_product_targets as targets
    on targets.brand_slug = brands.slug
    and targets.product_slug = products.slug
),
deleted_product_images as (
  delete from public.product_images
  using demo_products
  where product_images.product_id = demo_products.id
  returning product_images.id, product_images.product_id, product_images.image_url
)
select *
from deleted_product_images
order by image_url;

-- Remove only the targeted demo product rows.
with deleted_products as (
  delete from public.products
  using public.brands, cleanup_demo_product_targets as targets
  where brands.id = products.brand_id
  and targets.brand_slug = brands.slug
  and targets.product_slug = products.slug
  returning
    products.id,
    products.name,
    products.slug,
    brands.name as brand_name,
    brands.slug as brand_slug
)
select *
from deleted_products
order by brand_name, name;

-- Verification: active storefront products should now be Maison Margiela only.
select
  products.name,
  products.slug,
  brands.name as brand_name,
  brands.slug as brand_slug,
  categories.name as category_name,
  products.is_active
from public.products
join public.brands
  on brands.id = products.brand_id
join public.categories
  on categories.id = products.category_id
where products.is_active = true
order by brands.name, products.name;

-- Verification: this should return zero rows after cleanup.
select
  products.name,
  products.slug,
  brands.name as brand_name,
  brands.slug as brand_slug,
  products.is_active
from public.products
join public.brands
  on brands.id = products.brand_id
where products.is_active = true
and brands.slug <> 'maison-margiela'
order by brands.name, products.name;

commit;
