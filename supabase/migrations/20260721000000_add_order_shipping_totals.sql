-- Add the fixed shipping charge and final charged total to persisted orders.

alter table if exists public.orders
  add column if not exists shipping_fee numeric(10, 2) not null default 0
    check (shipping_fee >= 0),
  add column if not exists total numeric(10, 2);

-- Existing orders predate shipping support, so their historical total is their
-- product subtotal plus the existing default shipping fee of zero.
update public.orders
set total = subtotal + shipping_fee
where total is null;

alter table if exists public.orders
  alter column total set default 0,
  alter column total set not null;

alter table if exists public.orders
  add constraint orders_total_nonnegative check (total >= 0);

comment on column public.orders.shipping_fee is
  'Shipping amount charged by Stripe for the order.';
comment on column public.orders.total is
  'Final order amount charged by Stripe, including shipping.';
