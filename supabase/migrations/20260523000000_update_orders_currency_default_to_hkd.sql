-- Align future order defaults with the HKD storefront checkout currency.
-- Existing order rows are intentionally left unchanged.

alter table if exists public.orders
  alter column currency set default 'hkd';
