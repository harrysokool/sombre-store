-- Add primary product image rows for Maison Margiela Replica products.
-- Run this only after the matching image files exist in:
-- public/images/products/maison-margiela/
--
-- This script is additive and only touches image rows for the five Maison
-- Margiela Replica products listed below.

begin;

insert into public.product_images (
  product_id,
  image_url,
  alt_text,
  sort_order,
  is_primary
)
select
  products.id,
  image_data.image_url,
  image_data.alt_text,
  0,
  true
from (
  values
    (
      'maison-margiela-replica-lazy-sunday-morning',
      '/images/products/maison-margiela/replica-lazy-sunday-morning-01.jpg',
      'Maison Margiela Replica Lazy Sunday Morning perfume bottle'
    ),
    (
      'maison-margiela-replica-by-the-fireplace',
      '/images/products/maison-margiela/replica-by-the-fireplace-01.jpg',
      'Maison Margiela Replica By the Fireplace perfume bottle'
    ),
    (
      'maison-margiela-replica-jazz-club',
      '/images/products/maison-margiela/replica-jazz-club-01.jpg',
      'Maison Margiela Replica Jazz Club perfume bottle'
    ),
    (
      'maison-margiela-replica-beach-walk',
      '/images/products/maison-margiela/replica-beach-walk-01.jpg',
      'Maison Margiela Replica Beach Walk perfume bottle'
    ),
    (
      'maison-margiela-replica-sailing-day',
      '/images/products/maison-margiela/replica-sailing-day-01.jpg',
      'Maison Margiela Replica Sailing Day perfume bottle'
    )
) as image_data(
  product_slug,
  image_url,
  alt_text
)
join public.products
  on products.slug = image_data.product_slug
join public.brands
  on brands.id = products.brand_id
where brands.slug = 'maison-margiela'
on conflict (product_id, sort_order) do update
set
  image_url = excluded.image_url,
  alt_text = excluded.alt_text,
  is_primary = excluded.is_primary;

commit;

-- Optional verification query after running:
-- select
--   products.name,
--   product_images.image_url,
--   product_images.alt_text,
--   product_images.sort_order,
--   product_images.is_primary
-- from public.product_images
-- join public.products on products.id = product_images.product_id
-- join public.brands on brands.id = products.brand_id
-- where brands.slug = 'maison-margiela'
-- order by products.name, product_images.sort_order;
