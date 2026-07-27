-- Older application versions recorded definite provider rejections, ambiguous
-- transport outcomes, and sent-state persistence failures with the same
-- `failed` status. Keep those historical rows unclassified: they can be
-- retried only inside a conservative 23-hour window around Resend's 24-hour
-- idempotency guarantee, leaving time for the retry to reach the provider.
-- New application code explicitly marks a definite failure retryable, or an
-- obsolete/unsafe delivery blocked.
alter table public.order_emails
  add column if not exists retry_disposition text not null
    default 'unclassified'
    check (
      retry_disposition in ('unclassified', 'retryable', 'blocked')
    );

-- Existing rows were written by code that could not distinguish an accepted
-- send from a definite rejection, so they start ambiguous. Future inserts
-- start clean; the claim and outcome functions make ambiguity sticky.
alter table public.order_emails
  add column if not exists has_ambiguous_outcome boolean not null default true;

alter table public.order_emails
  alter column has_ambiguous_outcome set default false;

comment on column public.order_emails.retry_disposition is
  'Manual retry safety: retryable means the provider definitely rejected the send; unclassified requires the provider idempotency window; blocked must not be sent.';

comment on column public.order_emails.has_ambiguous_outcome is
  'Sticky safety flag indicating that some attempt may have reached the provider without a confirmed sent-state write.';

-- Give an administrator one atomic way to claim a recorded failed email for a
-- manual retry. This is deliberately separate from claim_order_email so a
-- definite failure can be retried immediately.

create or replace function public.claim_order_email_retry(
  p_email_id uuid
)
returns table (
  email_id uuid,
  claimed_order_id uuid,
  claimed_email_kind text,
  claimed_recipient text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.order_emails as emails
  set
    status = 'pending',
    retry_disposition = 'unclassified',
    has_ambiguous_outcome =
      emails.has_ambiguous_outcome or emails.status = 'pending',
    attempt_count = emails.attempt_count + 1,
    last_attempt_at = timezone('utc', now())
  where emails.id = p_email_id
    and (
      (
        emails.status = 'failed'
        and (
          (
            emails.retry_disposition = 'retryable'
            and not emails.has_ambiguous_outcome
          )
          or (
            emails.retry_disposition = 'unclassified'
            and emails.has_ambiguous_outcome
            and emails.first_attempt_at
              > timezone('utc', now()) - interval '23 hours'
          )
        )
      )
      or (
        emails.status = 'pending'
        and emails.last_attempt_at
          < timezone('utc', now()) - interval '5 minutes'
        -- Resend guarantees a stable result for 24 hours; stop local retries
        -- after 23 hours so a claimed request cannot cross that boundary while
        -- order data and templates are loaded. Older ambiguous sends require
        -- provider reconciliation, not a blind retry.
        and emails.first_attempt_at
          > timezone('utc', now()) - interval '23 hours'
      )
    )
  returning
    emails.id,
    emails.order_id,
    emails.email_kind,
    emails.recipient;
end;
$$;

comment on function public.claim_order_email_retry(uuid) is
  'Atomically claims one failed or abandoned transactional email for an administrator retry. Sent and fresh in-flight emails are never claimed.';

revoke execute on function public.claim_order_email_retry(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_order_email_retry(uuid)
  to service_role;

-- Keep the original webhook claim API, but bound recovery of an ambiguous
-- pending send to the same provider idempotency window. Definite failures keep
-- their existing five-minute webhook retry delay.
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
  insert into public.order_emails as emails (
    order_id,
    email_kind,
    recipient
  )
  values (p_order_id, p_email_kind, p_recipient)
  on conflict (order_id, email_kind) do update
  set
    attempt_count = emails.attempt_count + 1,
    last_attempt_at = timezone('utc', now()),
    status = 'pending',
    retry_disposition = 'unclassified',
    has_ambiguous_outcome =
      emails.has_ambiguous_outcome or emails.status = 'pending',
    recipient = excluded.recipient
  where
    (
      emails.status = 'failed'
      and (
        (
          emails.retry_disposition = 'retryable'
          and not emails.has_ambiguous_outcome
        )
        or (
          emails.retry_disposition = 'unclassified'
          and emails.has_ambiguous_outcome
          and emails.first_attempt_at
            > timezone('utc', now()) - interval '23 hours'
        )
      )
      and emails.last_attempt_at
        < timezone('utc', now()) - interval '5 minutes'
    )
    or
    (
      emails.status = 'pending'
      and emails.last_attempt_at
        < timezone('utc', now()) - interval '5 minutes'
      and emails.first_attempt_at
        > timezone('utc', now()) - interval '23 hours'
    )
  returning emails.id into claimed_id;

  return claimed_id;
end;
$$;

comment on function public.claim_order_email(uuid, text, text) is
  'Claims a new, failed, or safely stale transactional email while preventing ambiguous retries outside the provider idempotency window.';

revoke execute on function public.claim_order_email(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_order_email(uuid, text, text)
  to service_role;

-- Retain the original failure API for rolling deployments, but do not let an
-- older application instance declare that the provider definitely rejected a
-- request. Its result stays unclassified and therefore time-bounded above.
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
    retry_disposition = 'unclassified',
    has_ambiguous_outcome = true,
    error_message = left(
      coalesce(p_error_message, 'Unknown email delivery error.'),
      2000
    )
  where id = p_email_id
    and status = 'pending';
end;
$$;

revoke execute on function public.mark_order_email_failed(uuid, text)
  from public, anon, authenticated;
grant execute on function public.mark_order_email_failed(uuid, text)
  to service_role;

create or replace function public.mark_order_email_failed_retryable(
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
    retry_disposition = case
      when has_ambiguous_outcome then 'unclassified'
      else 'retryable'
    end,
    error_message = left(
      coalesce(p_error_message, 'Unknown email delivery error.'),
      2000
    )
  where id = p_email_id
    and status = 'pending';
end;
$$;

comment on function public.mark_order_email_failed_retryable(uuid, text) is
  'Records a definite pre-delivery failure that an administrator may safely retry.';

revoke execute on function public.mark_order_email_failed_retryable(uuid, text)
  from public, anon, authenticated;
grant execute on function public.mark_order_email_failed_retryable(uuid, text)
  to service_role;

create or replace function public.mark_order_email_retry_blocked(
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
    retry_disposition = 'blocked',
    error_message = left(
      coalesce(p_error_message, 'This email cannot be retried.'),
      2000
    )
  where id = p_email_id
    and status = 'pending';
end;
$$;

comment on function public.mark_order_email_retry_blocked(uuid, text) is
  'Records an obsolete or unsupported transactional email that must not be retried.';

revoke execute on function public.mark_order_email_retry_blocked(uuid, text)
  from public, anon, authenticated;
grant execute on function public.mark_order_email_retry_blocked(uuid, text)
  to service_role;

-- Preserve an ambiguous provider/recording outcome without reopening the row
-- as failed. It may be reclaimed only by the bounded stale-pending branch
-- above, which remains inside the provider idempotency window.
create or replace function public.mark_order_email_retry_uncertain(
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
    status = 'pending',
    retry_disposition = 'unclassified',
    has_ambiguous_outcome = true,
    error_message = left(
      coalesce(p_error_message, 'Email delivery outcome is uncertain.'),
      2000
    )
  where id = p_email_id
    and status = 'pending';
end;
$$;

comment on function public.mark_order_email_retry_uncertain(uuid, text) is
  'Records an ambiguous email provider outcome without making the delivery immediately retryable.';

revoke execute on function public.mark_order_email_retry_uncertain(uuid, text)
  from public, anon, authenticated;
grant execute on function public.mark_order_email_retry_uncertain(uuid, text)
  to service_role;

-- Add the server-only retry classification to the existing operational view.
-- Existing columns remain in their original order for compatibility.
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
  orders.total,
  emails.retry_disposition,
  emails.updated_at
from public.order_emails as emails
left join public.orders as orders
  on orders.id = emails.order_id
where emails.status <> 'sent';

revoke all privileges on table public.unsent_order_emails
  from anon, authenticated;
