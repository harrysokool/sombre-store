-- Give inventory back exactly once when a full refund succeeds.
--
-- Stock is reduced by confirm_paid_order_and_reduce_stock and guarded by
-- orders.stock_reduced_at. This adds the mirrored guard for the return trip, so
-- a replayed or concurrent Stripe refund event cannot inflate stock.

alter table if exists public.orders
  add column if not exists stock_restored_at timestamptz;

comment on column public.orders.stock_restored_at is
  'Set when inventory has been returned for this refunded order. Null means stock was never given back, either because the order was never reduced or because no full refund has succeeded.';

-- Restores the stock a confirmed order consumed, then records the refund as
-- complete. Returns true only when stock actually moved.
--
-- Lock order matches confirm_paid_order_and_reduce_stock exactly: the order row
-- first, then the affected product rows ascending by id. Taking the same locks
-- in the same sequence is what stops a concurrent reduction and restoration from
-- deadlocking against each other.
create or replace function public.restore_order_stock_after_refund(
  p_order_id uuid,
  p_refund_id text,
  p_refund_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stock_reduced_at timestamptz;
  current_stock_restored_at timestamptz;
begin
  -- Inventory only moves for money that actually went back to the customer.
  if p_refund_status <> 'succeeded' then
    raise exception
      'Stock is only restored for a succeeded refund, but got %.',
      p_refund_status;
  end if;

  select stock_reduced_at, stock_restored_at
  into current_stock_reduced_at, current_stock_restored_at
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order % does not exist.', p_order_id;
  end if;

  -- Already restored. A redelivered or concurrent refund event lands here and
  -- must change nothing.
  if current_stock_restored_at is not null then
    return false;
  end if;

  -- A paid oversell never reduced stock, so there is nothing to give back.
  -- The refund is still recorded, but stock_restored_at stays null because no
  -- inventory moved.
  if current_stock_reduced_at is null then
    update public.orders
    set
      order_status = 'refunded',
      refund_id = coalesce(p_refund_id, refund_id),
      refund_status = 'succeeded',
      refunded_at = coalesce(refunded_at, timezone('utc', now()))
    where id = p_order_id;

    return false;
  end if;

  -- Lock every affected product in a stable order before mutating quantities.
  perform products.id
  from public.products as products
  join (
    select product_id, sum(quantity)::integer as quantity
    from public.order_items
    where order_id = p_order_id
    and product_id is not null
    group by product_id
  ) as refunded_items
    on refunded_items.product_id = products.id
  order by products.id
  for update of products;

  update public.products as products
  set stock_quantity = products.stock_quantity + refunded_items.quantity
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.order_items
    where order_id = p_order_id
    and product_id is not null
    group by product_id
  ) as refunded_items
  where products.id = refunded_items.product_id;

  update public.orders
  set
    order_status = 'refunded',
    refund_id = coalesce(p_refund_id, refund_id),
    refund_status = 'succeeded',
    refunded_at = coalesce(refunded_at, timezone('utc', now())),
    stock_restored_at = timezone('utc', now())
  where id = p_order_id;

  return true;
end;
$$;

revoke execute on function public.restore_order_stock_after_refund(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.restore_order_stock_after_refund(uuid, text, text)
  to service_role;
