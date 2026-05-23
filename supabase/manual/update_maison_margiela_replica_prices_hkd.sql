-- Update Maison Margiela Replica 100 mL storefront prices for HKD.
--
-- Scope:
--   - Updates only public.products.price.
--   - Matches only brand slug 'maison-margiela'.
--   - Matches only the current Replica 100 mL product slugs below.
--   - Does not change size_label, images, descriptions, stock, orders, or order_items.

begin;

create temporary table maison_margiela_replica_price_targets (
  product_slug text primary key
) on commit drop;

insert into maison_margiela_replica_price_targets (product_slug)
values
  ('maison-margiela-replica-lazy-sunday-morning'),
  ('maison-margiela-replica-by-the-fireplace'),
  ('maison-margiela-replica-jazz-club'),
  ('maison-margiela-replica-beach-walk'),
  ('maison-margiela-replica-sailing-day')
on conflict (product_slug) do nothing;

-- Preview the exact rows this script is allowed to update.
select
  products.name,
  products.slug,
  brands.slug as brand_slug,
  products.size_label,
  products.price as current_price,
  1320.00::numeric(10, 2) as new_price
from public.products
join public.brands
  on brands.id = products.brand_id
join maison_margiela_replica_price_targets as targets
  on targets.product_slug = products.slug
where brands.slug = 'maison-margiela'
and products.name like 'Replica %'
and products.size_label = '100 mL'
order by products.name;

-- Guard against accidental partial or broad updates.
do $$
declare
  matching_product_count integer;
begin
  select count(*)
  into matching_product_count
  from public.products
  join public.brands
    on brands.id = products.brand_id
  join maison_margiela_replica_price_targets as targets
    on targets.product_slug = products.slug
  where brands.slug = 'maison-margiela'
  and products.name like 'Replica %'
  and products.size_label = '100 mL';

  if matching_product_count <> 5 then
    raise exception
      'Expected 5 Maison Margiela Replica 100 mL products, found %. No prices updated.',
      matching_product_count;
  end if;
end $$;

update public.products
set price = 1320.00
from public.brands,
  maison_margiela_replica_price_targets as targets
where brands.id = products.brand_id
and targets.product_slug = products.slug
and brands.slug = 'maison-margiela'
and products.name like 'Replica %'
and products.size_label = '100 mL'
and products.price is distinct from 1320.00;

-- Verify the final Maison Margiela Replica prices after the update.
select
  products.name,
  products.slug,
  brands.slug as brand_slug,
  products.size_label,
  products.price,
  products.stock_quantity,
  products.is_active
from public.products
join public.brands
  on brands.id = products.brand_id
join maison_margiela_replica_price_targets as targets
  on targets.product_slug = products.slug
where brands.slug = 'maison-margiela'
and products.name like 'Replica %'
and products.size_label = '100 mL'
order by products.name;

commit;
