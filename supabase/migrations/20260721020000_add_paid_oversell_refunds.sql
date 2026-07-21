-- Track fulfillment separately from Stripe payment state and make a paid
-- insufficient-stock result a committed outcome instead of a retrying error.

alter table if exists public.orders
  add column if not exists order_status text not null default 'pending',
  add column if not exists refund_id text,
  add column if not exists refund_status text,
  add column if not exists refund_requested_at timestamptz,
  add column if not exists refunded_at timestamptz;

update public.orders
set order_status = 'confirmed'
where payment_status in ('paid', 'no_payment_required')
and stock_reduced_at is not null;

alter table public.orders
  add constraint orders_order_status_check
    check (
      order_status in (
        'pending',
        'confirmed',
        'refund_pending',
        'refunded',
        'refund_failed',
        'unfulfillable'
      )
    ),
  add constraint orders_refund_status_check
    check (
      refund_status is null
      or refund_status in (
        'pending',
        'requires_action',
        'succeeded',
        'failed',
        'canceled',
        'not_required'
      )
    );

create unique index if not exists idx_orders_refund_id_unique
  on public.orders (refund_id)
  where refund_id is not null;

comment on column public.orders.order_status is
  'Fulfillment state kept separate from Stripe payment_status.';
comment on column public.orders.refund_id is
  'Stripe Refund ID for a paid order that could not be fulfilled.';
comment on column public.orders.refund_status is
  'Latest Stripe refund status, or not_required when no payment was collected.';

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
  current_order_status text;
begin
  if p_payment_status not in ('paid', 'no_payment_required') then
    raise exception 'Order payment status % is not confirmed.', p_payment_status;
  end if;

  select stock_reduced_at, order_status
  into current_stock_reduced_at, current_order_status
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order % does not exist.', p_order_id;
  end if;

  if current_stock_reduced_at is not null then
    return false;
  end if;

  if current_order_status in (
    'refund_pending',
    'refunded',
    'refund_failed',
    'unfulfillable'
  ) then
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
    update public.orders
    set
      payment_status = p_payment_status,
      order_status = 'refund_pending',
      refund_status = coalesce(refund_status, 'pending'),
      refund_requested_at = coalesce(
        refund_requested_at,
        timezone('utc', now())
      )
    where id = p_order_id;

    return false;
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
    order_status = 'confirmed',
    stock_reduced_at = timezone('utc', now())
  where id = p_order_id;

  return true;
end;
$$;

revoke execute on function public.confirm_paid_order_and_reduce_stock(uuid, text)
  from public, anon, authenticated;
grant execute on function public.confirm_paid_order_and_reduce_stock(uuid, text)
  to service_role;
