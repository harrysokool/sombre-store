-- Phase 1 of admin fulfilment: track how an order is being shipped, separately
-- from payment (payment_status), inventory (order_status), and refunds.
--
-- Nothing here touches money or stock. The RPC below writes only the six
-- fulfilment columns and refuses to run on an order that is not paid, not
-- confirmed, or has any refund recorded against it.

alter table if exists public.orders
  add column if not exists fulfilment_status text not null default 'unfulfilled',
  add column if not exists courier text,
  add column if not exists tracking_number text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists fulfilment_updated_at timestamptz;

-- The NOT NULL default backfills every existing order to 'unfulfilled'.
alter table public.orders
  add constraint orders_fulfilment_status_check
    check (
      fulfilment_status in ('unfulfilled', 'processing', 'shipped', 'delivered')
    );

comment on column public.orders.fulfilment_status is
  'Shipping progress for a paid, confirmed order. Independent of payment_status and order_status.';
comment on column public.orders.courier is
  'Carrier handling this specific parcel. Required before an order can be marked shipped.';
comment on column public.orders.tracking_number is
  'Carrier tracking reference. Required before an order can be marked shipped.';
comment on column public.orders.shipped_at is
  'Set when the order first reached shipped. Cleared if it is moved back to processing or unfulfilled.';
comment on column public.orders.delivered_at is
  'Set when the order first reached delivered. Cleared if it is moved back below delivered.';

-- Supports the future "what still needs shipping" queue.
create index if not exists idx_orders_fulfilment_status
  on public.orders (fulfilment_status)
  where fulfilment_status <> 'delivered';

-- Atomically set an order's fulfilment state.
--
-- Locks the order, checks eligibility, validates the transition, then writes
-- only fulfilment columns. Expected refusals come back as {ok:false, reason},
-- so the caller can show a message; genuinely invalid input raises.
create or replace function public.set_order_fulfilment(
  p_order_id uuid,
  p_fulfilment_status text,
  p_courier text default null,
  p_tracking_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_failure record;
  v_current_rank integer;
  v_target_rank integer;
  v_courier text;
  v_tracking text;
  v_shipped_at timestamptz;
  v_delivered_at timestamptz;
  v_updated_at timestamptz;
begin
  v_target_rank := case p_fulfilment_status
    when 'unfulfilled' then 0
    when 'processing' then 1
    when 'shipped' then 2
    when 'delivered' then 3
    else null
  end;

  if v_target_rank is null then
    raise exception 'Unknown fulfilment status %.', p_fulfilment_status;
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- Only a paid, confirmed order with no refund recorded against it may move.
  if not (
    v_order.payment_status in ('paid', 'no_payment_required')
    and v_order.order_status = 'confirmed'
    and v_order.refund_id is null
    and v_order.refund_status is null
  ) then
    return jsonb_build_object(
      'ok', false,
      'reason', 'not_eligible',
      'payment_status', v_order.payment_status,
      'order_status', v_order.order_status,
      'refund_status', v_order.refund_status
    );
  end if;

  -- A partial refund deliberately leaves the order row untouched, so the checks
  -- above cannot see it: refund_id and refund_status both stay null. It is
  -- recorded instead as an unresolved webhook failure against this order.
  --
  -- Any unresolved refund-event failure linked to this order means money for
  -- the order is in an unsettled state, so fulfilment is held until a human
  -- clears it by setting webhook_failures.is_resolved = true.
  select
    failures.id,
    failures.stripe_event_id,
    failures.stripe_event_type,
    failures.error_message
  into v_failure
  from public.webhook_failures as failures
  where failures.order_id = p_order_id
  and failures.is_resolved = false
  and failures.stripe_event_type like 'refund.%'
  order by failures.last_failed_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', false,
      'reason', 'partial_refund_review_required',
      'webhook_failure_id', v_failure.id,
      'stripe_event_id', v_failure.stripe_event_id,
      'stripe_event_type', v_failure.stripe_event_type,
      'detail', left(v_failure.error_message, 300)
    );
  end if;

  v_current_rank := case v_order.fulfilment_status
    when 'unfulfilled' then 0
    when 'processing' then 1
    when 'shipped' then 2
    when 'delivered' then 3
  end;

  -- Forward moves advance one step at a time. Repeating the current status and
  -- moving backward to correct a mistake are both allowed.
  if v_target_rank > v_current_rank + 1 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'invalid_transition',
      'from', v_order.fulfilment_status,
      'to', p_fulfilment_status
    );
  end if;

  -- A blank string is treated as "not supplied", so it cannot erase a value.
  v_courier := coalesce(nullif(btrim(p_courier), ''), v_order.courier);
  v_tracking := coalesce(
    nullif(btrim(p_tracking_number), ''),
    v_order.tracking_number
  );

  if v_target_rank >= 2 and (v_courier is null or v_tracking is null) then
    return jsonb_build_object(
      'ok', false,
      'reason', 'missing_tracking',
      'to', p_fulfilment_status
    );
  end if;

  -- Timestamps are only ever stamped once per state, so repeating a status
  -- never rewrites history. Moving back clears what no longer happened.
  if p_fulfilment_status in ('unfulfilled', 'processing') then
    v_shipped_at := null;
    v_delivered_at := null;
  elsif p_fulfilment_status = 'shipped' then
    v_shipped_at := coalesce(v_order.shipped_at, timezone('utc', now()));
    v_delivered_at := null;
  else
    v_shipped_at := coalesce(v_order.shipped_at, timezone('utc', now()));
    v_delivered_at := coalesce(v_order.delivered_at, timezone('utc', now()));
  end if;

  v_updated_at := timezone('utc', now());

  update public.orders
  set
    fulfilment_status = p_fulfilment_status,
    courier = v_courier,
    tracking_number = v_tracking,
    shipped_at = v_shipped_at,
    delivered_at = v_delivered_at,
    fulfilment_updated_at = v_updated_at
  where id = p_order_id;

  return jsonb_build_object(
    'ok', true,
    'fulfilment', jsonb_build_object(
      'fulfilment_status', p_fulfilment_status,
      'courier', v_courier,
      'tracking_number', v_tracking,
      'shipped_at', v_shipped_at,
      'delivered_at', v_delivered_at,
      'fulfilment_updated_at', v_updated_at
    )
  );
end;
$$;

revoke execute on function public.set_order_fulfilment(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.set_order_fulfilment(uuid, text, text, text)
  to service_role;
