-- Separate financial refunds from sellable inventory.
--
-- The earlier restore_order_stock_after_refund function returned every item to
-- stock when a full refund succeeded. A refund does not prove that perfume,
-- skincare, body care, or beauty goods are unopened and safe to sell again.
-- This migration keeps refund state automatic but makes every new stock
-- restoration an explicit, per-order-item administrator decision.

create table if not exists public.order_item_stock_restorations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  order_id uuid not null
    references public.orders (id) on delete restrict,
  order_item_id uuid not null
    references public.order_items (id) on delete restrict,
  -- Kept as an immutable snapshot rather than a foreign key so the audit trail
  -- still identifies the product if the catalog row is retired later.
  product_id uuid not null,
  quantity_restored integer not null,
  reason text not null,
  administrator_user_id uuid,
  administrator_email text,
  source text not null default 'administrator',
  restored_at timestamptz not null default timezone('utc', now()),
  constraint order_item_stock_restorations_request_id_unique
    unique (request_id),
  constraint order_item_stock_restorations_quantity_positive
    check (quantity_restored > 0),
  constraint order_item_stock_restorations_reason_required
    check (
      reason = btrim(reason)
      and char_length(reason) between 1 and 1000
    ),
  constraint order_item_stock_restorations_admin_email_valid
    check (
      administrator_email is null
      or (
        administrator_email = lower(btrim(administrator_email))
        and char_length(administrator_email) between 3 and 320
      )
    ),
  constraint order_item_stock_restorations_source_valid
    check (source in ('administrator', 'legacy_automatic')),
  constraint order_item_stock_restorations_actor_present
    check (
      source = 'legacy_automatic'
      or administrator_user_id is not null
      or administrator_email is not null
    )
);

comment on table public.order_item_stock_restorations is
  'Append-only audit history for explicit decisions to return purchased units to sellable product stock.';
comment on column public.order_item_stock_restorations.request_id is
  'Caller-generated idempotency key. Replaying the same request never increments stock twice.';
comment on column public.order_item_stock_restorations.reason is
  'Required administrator note explaining why these units are safe to sell again.';

create index if not exists idx_stock_restorations_order_history
  on public.order_item_stock_restorations (order_id, restored_at desc);
create index if not exists idx_stock_restorations_item_history
  on public.order_item_stock_restorations (order_item_id, restored_at);
create index if not exists idx_stock_restorations_product_history
  on public.order_item_stock_restorations (product_id, restored_at desc);
create unique index if not exists idx_stock_restorations_one_legacy_per_item
  on public.order_item_stock_restorations (order_item_id)
  where source = 'legacy_automatic';

alter table public.order_item_stock_restorations enable row level security;
revoke all privileges on table public.order_item_stock_restorations
  from public, anon, authenticated, service_role;
grant select on table public.order_item_stock_restorations to service_role;

-- Preserve the history represented by the old whole-order marker. No stock is
-- changed here: those quantities were already added by the previous function.
insert into public.order_item_stock_restorations (
  request_id,
  order_id,
  order_item_id,
  product_id,
  quantity_restored,
  reason,
  administrator_user_id,
  administrator_email,
  source,
  restored_at
)
select
  gen_random_uuid(),
  orders.id,
  items.id,
  items.product_id,
  items.quantity,
  'Legacy automatic full-refund stock restoration before manual review controls.',
  null,
  null,
  'legacy_automatic',
  orders.stock_restored_at
from public.orders as orders
join public.order_items as items
  on items.order_id = orders.id
where orders.stock_restored_at is not null
and items.product_id is not null
and not exists (
  select 1
  from public.order_item_stock_restorations as existing
  where existing.order_item_id = items.id
  and existing.source = 'legacy_automatic'
);

comment on column public.orders.stock_restored_at is
  'Legacy whole-order marker set only by the retired automatic refund restoration. New manual restorations are tracked per item in order_item_stock_restorations.';

-- Rolling-deployment compatibility for an older application instance that
-- still calls this function. It now records only the financial refund state and
-- deliberately returns false because it never changes inventory.
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
begin
  if p_refund_status <> 'succeeded' then
    raise exception
      'A completed financial refund requires succeeded status, but got %.',
      p_refund_status;
  end if;

  perform 1
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order % does not exist.', p_order_id;
  end if;

  update public.orders
  set
    order_status = 'refunded',
    refund_id = p_refund_id,
    refund_status = 'succeeded',
    refunded_at = coalesce(refunded_at, timezone('utc', now()))
  where id = p_order_id;

  return false;
end;
$$;

revoke execute on function public.restore_order_stock_after_refund(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.restore_order_stock_after_refund(uuid, text, text)
  to service_role;

comment on function public.restore_order_stock_after_refund(uuid, text, text) is
  'Deprecated compatibility wrapper. Records a succeeded refund without changing inventory.';

-- Restore one inspected order-item quantity to sellable stock. PostgreSQL keeps
-- the audit insert and product increment in one transaction, so either both
-- commit or neither does.
create or replace function public.restore_order_item_sellable_stock(
  p_request_id uuid,
  p_order_id uuid,
  p_order_item_id uuid,
  p_quantity integer,
  p_reason text,
  p_administrator_user_id uuid default null,
  p_administrator_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_existing public.order_item_stock_restorations%rowtype;
  v_reason text;
  v_administrator_email text;
  v_already_restored integer;
  v_remaining integer;
  v_restoration_id uuid;
  v_restored_at timestamptz;
  v_new_stock integer;
begin
  v_reason := btrim(coalesce(p_reason, ''));
  v_administrator_email := nullif(lower(btrim(p_administrator_email)), '');

  if p_request_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_request_id');
  end if;

  if p_quantity is null or p_quantity <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_quantity');
  end if;

  if char_length(v_reason) < 1 or char_length(v_reason) > 1000 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_reason');
  end if;

  if p_administrator_user_id is null and v_administrator_email is null then
    return jsonb_build_object(
      'ok', false, 'reason', 'missing_administrator_identity'
    );
  end if;

  -- Fast idempotent replay path for an already committed request.
  select *
  into v_existing
  from public.order_item_stock_restorations
  where request_id = p_request_id;

  if found then
    if (
      v_existing.order_id = p_order_id
      and v_existing.order_item_id = p_order_item_id
      and v_existing.quantity_restored = p_quantity
      and v_existing.reason = v_reason
      and v_existing.administrator_user_id
        is not distinct from p_administrator_user_id
      and v_existing.administrator_email
        is not distinct from v_administrator_email
    ) then
      return jsonb_build_object(
        'ok', true,
        'already_applied', true,
        'restoration_id', v_existing.id,
        'quantity_restored', v_existing.quantity_restored
      );
    end if;

    return jsonb_build_object(
      'ok', false, 'reason', 'idempotency_conflict'
    );
  end if;

  -- All decisions for an order serialize here. A second concurrent request sees
  -- the first request's committed audit quantity before checking its allowance.
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'order_not_found');
  end if;

  -- Recheck after waiting for the order lock so simultaneous retries of one
  -- request become an idempotent no-op.
  select *
  into v_existing
  from public.order_item_stock_restorations
  where request_id = p_request_id;

  if found then
    if (
      v_existing.order_id = p_order_id
      and v_existing.order_item_id = p_order_item_id
      and v_existing.quantity_restored = p_quantity
      and v_existing.reason = v_reason
      and v_existing.administrator_user_id
        is not distinct from p_administrator_user_id
      and v_existing.administrator_email
        is not distinct from v_administrator_email
    ) then
      return jsonb_build_object(
        'ok', true,
        'already_applied', true,
        'restoration_id', v_existing.id,
        'quantity_restored', v_existing.quantity_restored
      );
    end if;

    return jsonb_build_object(
      'ok', false, 'reason', 'idempotency_conflict'
    );
  end if;

  if not (
    v_order.order_status = 'refunded'
    and v_order.refund_status = 'succeeded'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'order_not_refunded');
  end if;

  if v_order.stock_reduced_at is null then
    return jsonb_build_object('ok', false, 'reason', 'stock_not_reduced');
  end if;

  -- Any non-null value came from the retired whole-order restoration and means
  -- those units have already been added. The backfill above records the usual
  -- case, while this guard also protects malformed historical rows.
  if v_order.stock_restored_at is not null then
    return jsonb_build_object(
      'ok', false, 'reason', 'legacy_stock_already_restored'
    );
  end if;

  select *
  into v_item
  from public.order_items
  where id = p_order_item_id
  and order_id = p_order_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false, 'reason', 'order_item_not_found'
    );
  end if;

  if v_item.product_id is null then
    return jsonb_build_object(
      'ok', false, 'reason', 'product_not_available'
    );
  end if;

  select coalesce(sum(quantity_restored), 0)::integer
  into v_already_restored
  from public.order_item_stock_restorations
  where order_item_id = v_item.id;

  v_remaining := v_item.quantity - v_already_restored;

  if p_quantity > v_remaining then
    return jsonb_build_object(
      'ok', false,
      'reason', 'quantity_exceeds_purchased',
      'purchased_quantity', v_item.quantity,
      'already_restored', v_already_restored,
      'remaining_quantity', greatest(v_remaining, 0)
    );
  end if;

  perform 1
  from public.products
  where id = v_item.product_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false, 'reason', 'product_not_available'
    );
  end if;

  insert into public.order_item_stock_restorations (
    request_id,
    order_id,
    order_item_id,
    product_id,
    quantity_restored,
    reason,
    administrator_user_id,
    administrator_email,
    source
  )
  values (
    p_request_id,
    p_order_id,
    p_order_item_id,
    v_item.product_id,
    p_quantity,
    v_reason,
    p_administrator_user_id,
    v_administrator_email,
    'administrator'
  )
  on conflict (request_id) do nothing
  returning id, restored_at
  into v_restoration_id, v_restored_at;

  if v_restoration_id is null then
    select *
    into v_existing
    from public.order_item_stock_restorations
    where request_id = p_request_id;

    if (
      found
      and v_existing.order_id = p_order_id
      and v_existing.order_item_id = p_order_item_id
      and v_existing.quantity_restored = p_quantity
      and v_existing.reason = v_reason
      and v_existing.administrator_user_id
        is not distinct from p_administrator_user_id
      and v_existing.administrator_email
        is not distinct from v_administrator_email
    ) then
      return jsonb_build_object(
        'ok', true,
        'already_applied', true,
        'restoration_id', v_existing.id,
        'quantity_restored', v_existing.quantity_restored
      );
    end if;

    return jsonb_build_object(
      'ok', false, 'reason', 'idempotency_conflict'
    );
  end if;

  update public.products
  set stock_quantity = stock_quantity + p_quantity
  where id = v_item.product_id
  returning stock_quantity into v_new_stock;

  if not found then
    raise exception 'Product % disappeared during stock restoration.',
      v_item.product_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'already_applied', false,
    'restoration_id', v_restoration_id,
    'order_item_id', v_item.id,
    'product_id', v_item.product_id,
    'quantity_restored', p_quantity,
    'total_restored', v_already_restored + p_quantity,
    'remaining_quantity', v_remaining - p_quantity,
    'new_stock_quantity', v_new_stock,
    'restored_at', v_restored_at
  );
end;
$$;

revoke execute on function public.restore_order_item_sellable_stock(
  uuid, uuid, uuid, integer, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.restore_order_item_sellable_stock(
  uuid, uuid, uuid, integer, text, uuid, text
) to service_role;

comment on function public.restore_order_item_sellable_stock(
  uuid, uuid, uuid, integer, text, uuid, text
) is
  'Atomically records an explicit administrator decision and restores only that inspected quantity to sellable stock.';
