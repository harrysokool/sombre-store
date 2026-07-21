-- Persist Stripe webhook processing failures so a paid order can never fail
-- silently. Stripe delivers at least once, so the same event ID can fail
-- repeatedly; one row per event ID is updated in place rather than appended.

create table if not exists public.webhook_failures (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null,
  stripe_event_type text not null,
  stripe_session_id text,
  order_id uuid references public.orders (id) on delete set null,
  error_message text not null,
  -- 'retryable' means the webhook answered Stripe with an error so the delivery
  -- is retried. 'permanent' means the failure cannot succeed on a retry, so it
  -- was recorded and acknowledged instead of retrying the same failure forever.
  failure_kind text not null default 'retryable'
    check (failure_kind in ('retryable', 'permanent')),
  will_retry boolean generated always as (failure_kind = 'retryable') stored,
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  is_resolved boolean not null default false,
  first_failed_at timestamptz not null default timezone('utc', now()),
  last_failed_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint webhook_failures_stripe_event_id_unique unique (stripe_event_id)
);

comment on table public.webhook_failures is
  'Stripe webhook deliveries that failed to process, one row per Stripe event ID.';
comment on column public.webhook_failures.failure_kind is
  'retryable when Stripe was asked to retry, permanent when the delivery was acknowledged after recording.';
comment on column public.webhook_failures.will_retry is
  'Derived retry status: true while Stripe is still expected to redeliver this event.';
comment on column public.webhook_failures.occurrence_count is
  'How many deliveries of this Stripe event have failed so far.';

create trigger set_webhook_failures_updated_at
before update on public.webhook_failures
for each row
execute function public.set_updated_at();

-- Unresolved failures are the operational queue, so index that subset directly.
create index if not exists idx_webhook_failures_unresolved
  on public.webhook_failures (last_failed_at desc)
  where is_resolved = false;
create index if not exists idx_webhook_failures_order_id
  on public.webhook_failures (order_id);
create index if not exists idx_webhook_failures_stripe_session_id
  on public.webhook_failures (stripe_session_id);

-- Records a failed delivery. Repeated deliveries of the same Stripe event
-- update the existing row and bump the counter instead of inserting again.
create or replace function public.record_stripe_webhook_failure(
  p_stripe_event_id text,
  p_stripe_event_type text,
  p_stripe_session_id text,
  p_order_id uuid,
  p_error_message text,
  p_failure_kind text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  failure_id uuid;
begin
  if p_failure_kind not in ('retryable', 'permanent') then
    raise exception 'Unknown webhook failure kind %.', p_failure_kind;
  end if;

  insert into public.webhook_failures as failures (
    stripe_event_id,
    stripe_event_type,
    stripe_session_id,
    order_id,
    error_message,
    failure_kind
  )
  values (
    p_stripe_event_id,
    p_stripe_event_type,
    p_stripe_session_id,
    p_order_id,
    left(coalesce(p_error_message, 'Unknown error.'), 2000),
    p_failure_kind
  )
  on conflict (stripe_event_id) do update
  set
    stripe_event_type = excluded.stripe_event_type,
    -- A later delivery may know identifiers an earlier failure did not reach.
    stripe_session_id = coalesce(
      excluded.stripe_session_id,
      failures.stripe_session_id
    ),
    order_id = coalesce(excluded.order_id, failures.order_id),
    error_message = excluded.error_message,
    failure_kind = excluded.failure_kind,
    occurrence_count = failures.occurrence_count + 1,
    -- A previously resolved event that fails again is reopened.
    is_resolved = false,
    resolved_at = null,
    last_failed_at = timezone('utc', now())
  returning failures.id into failure_id;

  return failure_id;
end;
$$;

-- Closes a recorded failure once the same Stripe event is processed cleanly.
create or replace function public.resolve_stripe_webhook_failure(
  p_stripe_event_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_count integer;
begin
  update public.webhook_failures
  set
    is_resolved = true,
    resolved_at = timezone('utc', now())
  where stripe_event_id = p_stripe_event_id
  and is_resolved = false;

  get diagnostics resolved_count = row_count;

  return resolved_count > 0;
end;
$$;

-- Operational queue of everything still needing attention, newest failure first.
create or replace view public.unresolved_webhook_failures
with (security_invoker = true) as
select
  failures.id,
  failures.stripe_event_id,
  failures.stripe_event_type,
  failures.stripe_session_id,
  failures.order_id,
  failures.error_message,
  failures.failure_kind,
  failures.will_retry,
  failures.occurrence_count,
  failures.first_failed_at,
  failures.last_failed_at,
  orders.payment_status,
  orders.order_status,
  orders.customer_email,
  orders.total
from public.webhook_failures as failures
left join public.orders as orders
  on orders.id = failures.order_id
where failures.is_resolved = false;

comment on view public.unresolved_webhook_failures is
  'Stripe webhook failures still needing attention, joined to their order when known.';

-- Failure data describes private orders, so it follows the same trust model as
-- orders: no policies, no direct grants, service-role access only.
alter table public.webhook_failures enable row level security;

revoke all privileges on table public.webhook_failures from anon, authenticated;
revoke all privileges on table public.unresolved_webhook_failures
  from anon, authenticated;

revoke execute on function public.record_stripe_webhook_failure(
  text, text, text, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.record_stripe_webhook_failure(
  text, text, text, uuid, text, text
) to service_role;

revoke execute on function public.resolve_stripe_webhook_failure(text)
  from public, anon, authenticated;
grant execute on function public.resolve_stripe_webhook_failure(text)
  to service_role;
