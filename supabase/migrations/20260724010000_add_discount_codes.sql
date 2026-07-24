-- Reusable coupon configuration. Coupons have no usage or customer limits;
-- each assignment defines the percentage for one product.

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code_normalized text not null,
  is_active boolean not null default false,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint discount_codes_code_normalized_unique unique (code_normalized),
  constraint discount_codes_code_normalized_trimmed_check
    check (code_normalized = btrim(code_normalized)),
  constraint discount_codes_code_normalized_uppercase_check
    check (code_normalized = upper(code_normalized)),
  constraint discount_codes_code_normalized_length_check
    check (char_length(code_normalized) between 3 and 32),
  constraint discount_codes_code_normalized_format_check
    check (code_normalized ~ '^[A-Z0-9][A-Z0-9_-]*$'),
  constraint discount_codes_valid_date_range_check
    check (
      starts_at is null
      or expires_at is null
      or expires_at > starts_at
    )
);

create table if not exists public.discount_code_products (
  discount_code_id uuid not null,
  product_id uuid not null,
  discount_percent numeric(5, 2) not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint discount_code_products_pkey
    primary key (discount_code_id, product_id),
  constraint discount_code_products_discount_code_id_fkey
    foreign key (discount_code_id)
    references public.discount_codes (id)
    on delete cascade,
  constraint discount_code_products_product_id_fkey
    foreign key (product_id)
    references public.products (id)
    on delete cascade,
  constraint discount_code_products_discount_percent_check
    check (discount_percent > 0 and discount_percent <= 100)
);

create index if not exists idx_discount_code_products_product_id
  on public.discount_code_products (product_id);

create trigger set_discount_codes_updated_at
before update on public.discount_codes
for each row
execute function public.set_updated_at();

create trigger set_discount_code_products_updated_at
before update on public.discount_code_products
for each row
execute function public.set_updated_at();

-- Coupon configuration is available only to trusted server code. No RLS
-- policies are created for either table.
alter table public.discount_codes enable row level security;
alter table public.discount_code_products enable row level security;

revoke all privileges
  on table public.discount_codes, public.discount_code_products
  from public, anon, authenticated;
