-- Track every transactional email an order should receive, so Stripe's
-- at-least-once webhook delivery can never send the same email twice.
-- One row per (order, email kind); the row is claimed before the send and
-- marked afterwards.

create table if not exists public.order_emails (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  email_kind text not null check (
    email_kind in (
      'customer_order_confirmation',
      'seller_order_notification',
      'customer_refund_pending',
      'customer_refunded',
      'customer_refund_failed'
    )
  ),
  recipient text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  attempt_count integer not null default 1 check (attempt_count > 0),
  sent_at timestamptz,
  first_attempt_at timestamptz not null default timezone('utc', now()),
  last_attempt_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint order_emails_order_id_email_kind_unique unique (order_id, email_kind)
);

comment on table public.order_emails is
  'Delivery record for each transactional email an order should receive.';
comment on column public.order_emails.email_kind is
  'Which email this row represents. Unique per order, so an email is sent at most once.';
comment on column public.order_emails.status is
  'pending while a send is in flight, sent once the provider accepted it, failed otherwise.';
comment on column public.order_emails.provider_message_id is
  'Identifier returned by the email provider, for tracing a delivery.';

create trigger set_order_emails_updated_at
before update on public.order_emails
for each row
execute function public.set_updated_at();

-- Anything not yet sent is the operational queue.
create index if not exists idx_order_emails_unsent
  on public.order_emails (last_attempt_at desc)
  where status <> 'sent';
create index if not exists idx_order_emails_order_id
  on public.order_emails (order_id);

-- Claims the right to send one email. Returns the row id when the caller may
-- send, or null when it must not: either the email already went out, or another
-- concurrent webhook delivery claimed it moments ago.
create or replace function public.claim_order_email(
  p_order_id uuid,
  p_email_kind text,
  p_recipient text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_id uuid;
begin
  insert into public.order_emails as emails (order_id, email_kind, recipient)
  values (p_order_id, p_email_kind, p_recipient)
  on conflict (order_id, email_kind) do update
  set
    attempt_count = emails.attempt_count + 1,
    last_attempt_at = timezone('utc', now()),
    status = 'pending',
    recipient = excluded.recipient
  -- Never re-send a delivered email, and leave a claim from the last few
  -- minutes alone so simultaneous deliveries cannot both send. An older
  -- unfinished claim is allowed to be retried.
  where emails.status <> 'sent'
    and emails.last_attempt_at < timezone('utc', now()) - interval '5 minutes'
  returning emails.id into claimed_id;

  return claimed_id;
end;
$$;

create or replace function public.mark_order_email_sent(
  p_email_id uuid,
  p_provider_message_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.order_emails
  set
    status = 'sent',
    sent_at = timezone('utc', now()),
    provider_message_id = p_provider_message_id,
    error_message = null
  where id = p_email_id;
end;
$$;

create or replace function public.mark_order_email_failed(
  p_email_id uuid,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.order_emails
  set
    status = 'failed',
    error_message = left(coalesce(p_error_message, 'Unknown error.'), 2000)
  where id = p_email_id
  -- A late failure report must never undo a recorded success.
  and status <> 'sent';
end;
$$;

-- Operational queue: emails that still have not reached the customer.
create or replace view public.unsent_order_emails
with (security_invoker = true) as
select
  emails.id,
  emails.order_id,
  emails.email_kind,
  emails.recipient,
  emails.status,
  emails.error_message,
  emails.attempt_count,
  emails.first_attempt_at,
  emails.last_attempt_at,
  orders.order_status,
  orders.payment_status,
  orders.total
from public.order_emails as emails
left join public.orders as orders
  on orders.id = emails.order_id
where emails.status <> 'sent';

comment on view public.unsent_order_emails is
  'Transactional emails that have not been delivered yet, joined to their order.';

-- Email rows hold customer addresses, so they follow the same trust model as
-- orders: no policies, no direct grants, service-role access only.
alter table public.order_emails enable row level security;

revoke all privileges on table public.order_emails from anon, authenticated;
revoke all privileges on table public.unsent_order_emails from anon, authenticated;

revoke execute on function public.claim_order_email(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_order_email(uuid, text, text)
  to service_role;

revoke execute on function public.mark_order_email_sent(uuid, text)
  from public, anon, authenticated;
grant execute on function public.mark_order_email_sent(uuid, text)
  to service_role;

revoke execute on function public.mark_order_email_failed(uuid, text)
  from public, anon, authenticated;
grant execute on function public.mark_order_email_failed(uuid, text)
  to service_role;
