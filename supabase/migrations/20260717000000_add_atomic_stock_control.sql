-- Atomically confirm paid orders and reduce product stock exactly once.

alter table if exists public.orders
  add column if not exists stock_reduced_at timestamptz;

comment on column public.orders.stock_reduced_at is
  'Set when inventory has been reduced for this confirmed order.';

-- Older paid orders predate automatic inventory reduction. Mark them as already
-- processed so a later Stripe retry cannot unexpectedly reduce current stock.
update public.orders
set stock_reduced_at = created_at
where payment_status in ('paid', 'no_payment_required')
and stock_reduced_at is null;

create or replace function public.confirm_paid_order_and_reduce_stock(
  p_order_id uuid,
  p_payment_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stock_reduced_at timestamptz;
begin
  if p_payment_status not in ('paid', 'no_payment_required') then
    raise exception 'Order payment status % is not confirmed.', p_payment_status;
  end if;

  select stock_reduced_at
  into current_stock_reduced_at
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order % does not exist.', p_order_id;
  end if;

  if current_stock_reduced_at is not null then
    return false;
  end if;

  if not exists (
    select 1
    from public.order_items
    where order_id = p_order_id
  ) then
    raise exception 'Order % has no order items.', p_order_id;
  end if;

  if exists (
    select 1
    from public.order_items
    where order_id = p_order_id
    and product_id is null
  ) then
    raise exception 'Order % contains an item without a product.', p_order_id;
  end if;

  -- Lock every affected product in a stable order before checking quantities.
  perform products.id
  from public.products as products
  join (
    select product_id, sum(quantity)::integer as quantity
    from public.order_items
    where order_id = p_order_id
    group by product_id
  ) as purchased_items
    on purchased_items.product_id = products.id
  order by products.id
  for update of products;

  if exists (
    select 1
    from public.products as products
    join (
      select product_id, sum(quantity)::integer as quantity
      from public.order_items
      where order_id = p_order_id
      group by product_id
    ) as purchased_items
      on purchased_items.product_id = products.id
    where products.stock_quantity < purchased_items.quantity
  ) then
    raise exception 'Insufficient stock for order %.', p_order_id;
  end if;

  update public.products as products
  set stock_quantity = products.stock_quantity - purchased_items.quantity
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.order_items
    where order_id = p_order_id
    group by product_id
  ) as purchased_items
  where products.id = purchased_items.product_id;

  update public.orders
  set
    payment_status = p_payment_status,
    stock_reduced_at = timezone('utc', now())
  where id = p_order_id;

  return true;
end;
$$;

revoke execute on function public.confirm_paid_order_and_reduce_stock(uuid, text)
  from public, anon, authenticated;
grant execute on function public.confirm_paid_order_and_reduce_stock(uuid, text)
  to service_role;
