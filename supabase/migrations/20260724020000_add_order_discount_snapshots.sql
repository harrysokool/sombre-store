-- Expand the private order snapshots for future coupon-aware writers while
-- remaining compatible with the current webhook, which omits these fields.

alter table if exists public.orders
  add column if not exists coupon_code text,
  add column if not exists original_subtotal numeric(12, 2),
  add column if not exists discount_total numeric(12, 2) not null default 0;

-- Historical orders had no discounts. Their stored subtotal is therefore the
-- truthful original subtotal, and their discount is zero.
update public.orders
set
  coupon_code = null,
  original_subtotal = subtotal,
  discount_total = 0
where original_subtotal is null;

alter table if exists public.orders
  add constraint orders_original_subtotal_nonnegative_check
    check (original_subtotal is null or original_subtotal >= 0),
  add constraint orders_discount_total_nonnegative_check
    check (discount_total >= 0),
  add constraint orders_discount_total_reconciles_subtotal_check
    check (
      original_subtotal is null
      or original_subtotal - discount_total = subtotal
    ),
  add constraint orders_coupon_discount_consistency_check
    check (
      (coupon_code is null and discount_total = 0)
      or (coupon_code is not null and discount_total > 0)
    );

alter table if exists public.order_items
  add column if not exists original_unit_price numeric(12, 2),
  add column if not exists discount_percent numeric(5, 2) not null default 0;

-- Historical items were charged at full price, so the existing unit price is
-- their truthful original price and their configured percentage is zero.
update public.order_items
set
  original_unit_price = unit_price,
  discount_percent = 0
where original_unit_price is null;

alter table if exists public.order_items
  add column if not exists unit_discount_amount numeric(12, 2)
    generated always as (original_unit_price - unit_price) stored,
  add column if not exists original_line_total numeric(12, 2)
    generated always as (original_unit_price * quantity) stored,
  add column if not exists discount_amount numeric(12, 2)
    generated always as (
      (original_unit_price - unit_price) * quantity
    ) stored,
  add column if not exists discounted_line_total numeric(12, 2)
    generated always as (unit_price * quantity) stored;

alter table if exists public.order_items
  add constraint order_items_discount_percent_range_check
    check (discount_percent >= 0 and discount_percent <= 100),
  add constraint order_items_original_unit_price_not_below_charged_check
    check (
      original_unit_price is null
      or original_unit_price >= unit_price
    );
