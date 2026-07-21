-- Give each persisted order item the stable Stripe line-item identity so
-- concurrent webhook deliveries cannot insert the same item more than once.

alter table if exists public.order_items
  add column if not exists stripe_line_item_id text;

alter table if exists public.order_items
  add constraint order_items_order_id_stripe_line_item_id_unique
  unique (order_id, stripe_line_item_id);

comment on column public.order_items.stripe_line_item_id is
  'Stripe Checkout line-item ID used to make webhook item persistence idempotent.';
