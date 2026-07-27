-- Add a shipping confirmation email kind so the existing order-email
-- architecture (order_emails table, claim/mark/retry RPCs, per-(order, kind)
-- idempotency) can also deliver the "MARK AS SHIPPED" notification. No new
-- table or RPC is needed: claim_order_email, claim_order_email_retry, and the
-- mark_order_email_* functions already operate on any email_kind value.
alter table public.order_emails
  drop constraint if exists order_emails_email_kind_check;

alter table public.order_emails
  add constraint order_emails_email_kind_check
  check (
    email_kind in (
      'customer_order_confirmation',
      'seller_order_notification',
      'customer_refund_pending',
      'customer_refunded',
      'customer_refund_failed',
      'shipping_confirmation'
    )
  );

comment on column public.order_emails.email_kind is
  'Which email this row represents, including shipping_confirmation for the admin "mark as shipped" notification. Unique per order, so an email is sent at most once.';
