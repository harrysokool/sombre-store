-- Official retail price for a product: schema only.
--
-- `products.price` keeps its existing meaning: the normal Sombre selling price,
-- and the amount Stripe Checkout is charged from. This new column records the
-- separate official retail price of the same product, which the storefront can
-- later show struck through beside a lower figure.
--
-- This is phase 1 of that work. The column is added empty, no retail price is
-- populated or invented here, and no storefront component reads it yet, so
-- nothing a customer or an administrator can see changes when this migration is
-- applied. Retail prices are entered per product afterwards.

alter table if exists public.products
  add column if not exists retail_price numeric(10, 2);

-- Nullable, because not every product has a published retail price and none is
-- guessed for the ones that do not. The non-negative guard mirrors the existing
-- `price >= 0` check on this table, and skips null so an unset retail price
-- stays legal.
alter table if exists public.products
  add constraint products_retail_price_nonnegative_check
    check (retail_price is null or retail_price >= 0);

comment on column public.products.retail_price is
  'Official retail price of the product in HKD, or null when none is published. Distinct from price, which is the Sombre selling price charged at checkout.';
