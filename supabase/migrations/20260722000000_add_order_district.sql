-- Hong Kong addresses are identified by district rather than by a postal code.
-- Orders now record the district, and the postal code becomes optional.

alter table if exists public.orders
  add column if not exists district text;

comment on column public.orders.district is
  'Hong Kong district or region used for delivery. Null on orders placed before this column existed.';

-- Hong Kong has no postal code system, so a blank postal code is now valid.
-- Relaxing the constraint leaves every existing row untouched and still valid.
alter table if exists public.orders
  alter column postal_code drop not null;
