-- Add a small first batch of Maison Margiela Replica perfume products.
-- This script is additive: it does not delete or reset existing catalog data.
-- Product image rows are intentionally omitted until matching image files exist.
-- Prices and stock quantities are realistic placeholders; review before launch.

begin;

do $$
begin
  if not exists (
    select 1
    from public.categories
    where slug = 'perfume'
  ) then
    raise exception 'Required category "perfume" does not exist. Apply the catalog schema/seed before running this script.';
  end if;
end $$;

insert into public.brands (
  name,
  slug,
  description
)
values (
  'Maison Margiela',
  'maison-margiela',
  'Maison Margiela perfumes selected for the Sombre edit.'
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  updated_at = timezone('utc', now());

with brand as (
  select id
  from public.brands
  where slug = 'maison-margiela'
),
category as (
  select id
  from public.categories
  where slug = 'perfume'
)
insert into public.products (
  brand_id,
  category_id,
  name,
  slug,
  description,
  short_description,
  size_label,
  price,
  stock_quantity,
  is_featured,
  is_active
)
select
  brand.id,
  category.id,
  product_data.name,
  product_data.slug,
  product_data.description,
  product_data.short_description,
  product_data.size_label,
  product_data.price,
  product_data.stock_quantity,
  product_data.is_featured,
  true
from (
  values
    (
      'Replica Lazy Sunday Morning',
      'maison-margiela-replica-lazy-sunday-morning',
      'A clean, soft perfume with an easy fresh-linen character and quiet musk finish.',
      'Clean musk and soft linen.',
      '100 mL',
      165.00::numeric,
      5,
      false
    ),
    (
      'Replica By the Fireplace',
      'maison-margiela-replica-by-the-fireplace',
      'A warm perfume with smoky woods, soft sweetness, and a polished evening feel.',
      'Warm woods and smoky sweetness.',
      '100 mL',
      165.00::numeric,
      5,
      false
    ),
    (
      'Replica Jazz Club',
      'maison-margiela-replica-jazz-club',
      'A smooth perfume with warm spice, polished woods, and a low-lit atmosphere.',
      'Spiced warmth and polished woods.',
      '100 mL',
      165.00::numeric,
      5,
      false
    ),
    (
      'Replica Beach Walk',
      'maison-margiela-replica-beach-walk',
      'A bright perfume with a sun-warmed, softly floral profile and relaxed finish.',
      'Sunlit florals and warm skin.',
      '100 mL',
      165.00::numeric,
      5,
      false
    ),
    (
      'Replica Sailing Day',
      'maison-margiela-replica-sailing-day',
      'A fresh perfume with crisp aquatic notes, mineral clarity, and a clean drydown.',
      'Fresh aquatic and mineral notes.',
      '100 mL',
      165.00::numeric,
      5,
      false
    )
) as product_data(
  name,
  slug,
  description,
  short_description,
  size_label,
  price,
  stock_quantity,
  is_featured
)
cross join brand
cross join category
on conflict (slug) do nothing;

commit;

-- Future image paths can follow this pattern once real matching image files exist:
-- /images/products/maison-margiela/replica-lazy-sunday-morning-01.jpg
-- /images/products/maison-margiela/replica-by-the-fireplace-01.jpg
-- /images/products/maison-margiela/replica-jazz-club-01.jpg
-- /images/products/maison-margiela/replica-beach-walk-01.jpg
-- /images/products/maison-margiela/replica-sailing-day-01.jpg

-- Optional verification query after running:
-- select
--   products.name,
--   products.slug,
--   products.price,
--   products.stock_quantity,
--   brands.name as brand,
--   categories.name as category
-- from public.products
-- join public.brands on brands.id = products.brand_id
-- join public.categories on categories.id = products.category_id
-- where brands.slug = 'maison-margiela'
-- order by products.name;
