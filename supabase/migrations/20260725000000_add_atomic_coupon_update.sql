-- Make a coupon edit atomic.
--
-- Editing a coupon used to run as three separate PostgREST writes: an
-- assignment upsert, an assignment delete, then the coupon update. Each was
-- its own transaction, so a failure on a later write left the earlier ones
-- committed. The admin form would report that the save failed while live
-- product discounts had already changed.
--
-- Everything below runs inside the single statement PostgREST issues for the
-- call, so the whole edit is one transaction: any raise, constraint violation,
-- or deadlock rolls back every write this function has made.
--
-- Nothing here touches orders, payments, stock, or refunds. Discounts already
-- applied to an order are snapshotted onto that order and are unaffected by
-- later coupon edits.
--
-- Expected refusals come back as {ok:false, reason} and always happen before
-- the first write, so a refusal never leaves anything half-saved either.

create or replace function public.update_discount_code_with_assignments(
  p_discount_code_id uuid,
  p_is_active boolean,
  p_starts_at timestamptz default null,
  p_expires_at timestamptz default null,
  p_assignments jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
-- Empty rather than `public`, because this runs SECURITY DEFINER: an empty
-- path means an unqualified name can never resolve into a schema an attacker
-- controls. Every table below is therefore written `public.`-qualified.
-- Built-in functions, types, and operators still resolve because pg_catalog is
-- searched implicitly whatever this is set to. The updated_at triggers on both
-- discount tables inherit this path — public.set_updated_at() declares no path
-- of its own — and stay safe because its body touches only pg_catalog.
set search_path = ''
as $$
declare
  -- Matches the UUID and two-decimal-percentage shapes the admin data layer
  -- produces. Re-checked here because the database is the authority.
  uuid_pattern constant text :=
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  percent_pattern constant text := '^[0-9]{1,3}([.][0-9]{1,2})?$';
  v_assignments jsonb;
  v_submitted_count integer;
  v_distinct_count integer;
  v_unknown_product_ids uuid[];
  v_inactive_product_ids uuid[];
  v_removed_count integer;
  v_assigned_count integer;
begin
  if p_discount_code_id is null then
    raise exception 'A coupon id is required.';
  end if;

  if p_is_active is null then
    raise exception 'A coupon active state is required.';
  end if;

  v_assignments := coalesce(p_assignments, '[]'::jsonb);

  if jsonb_typeof(v_assignments) <> 'array' then
    raise exception 'Coupon assignments must be a JSON array.';
  end if;

  ----------------------------------------------------------------------------
  -- Validation. Every check below runs before the first write.
  ----------------------------------------------------------------------------

  -- Shape and text format only. Deliberately cast-free: casting a malformed
  -- value here would raise a low-level type error instead of the clean
  -- refusal the admin form can show.
  --
  -- Every scan below names the element column explicitly, as
  -- `as element(assignment)`, so `assignment` is unambiguously the jsonb
  -- object rather than a whole-row reference.
  if exists (
    select 1
    from jsonb_array_elements(v_assignments) as element(assignment)
    where jsonb_typeof(assignment) is distinct from 'object'
      or jsonb_typeof(assignment -> 'product_id') is distinct from 'string'
      or jsonb_typeof(assignment -> 'discount_percent') is null
      or jsonb_typeof(assignment -> 'discount_percent')
        not in ('string', 'number')
      or coalesce(assignment ->> 'product_id', '') !~ uuid_pattern
      or coalesce(assignment ->> 'discount_percent', '') !~ percent_pattern
  ) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_assignments');
  end if;

  -- Range. Safe to cast now that every value is known to be a plain decimal
  -- of at most 999.99, which fits numeric without overflowing.
  if exists (
    select 1
    from jsonb_array_elements(v_assignments) as element(assignment)
    where (assignment ->> 'discount_percent')::numeric <= 0
      or (assignment ->> 'discount_percent')::numeric > 100
  ) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_assignments');
  end if;

  -- One product cannot carry two percentages. ON CONFLICT DO UPDATE cannot
  -- touch a row twice in one statement, so without this the insert below
  -- would raise a cardinality violation instead of refusing cleanly.
  -- Compared as uuid, not text, so two spellings of the same id that differ
  -- only in hex case still count as one product.
  select count(*), count(distinct (assignment ->> 'product_id')::uuid)
  into v_submitted_count, v_distinct_count
  from jsonb_array_elements(v_assignments) as element(assignment);

  if v_submitted_count <> v_distinct_count then
    return jsonb_build_object('ok', false, 'reason', 'duplicate_product');
  end if;

  if
    p_starts_at is not null
    and p_expires_at is not null
    and p_expires_at <= p_starts_at
  then
    return jsonb_build_object('ok', false, 'reason', 'invalid_date_range');
  end if;

  -- Lock the coupon for the rest of the transaction. Two admins saving the
  -- same coupon at once are serialised here, so neither sees a half-applied
  -- assignment set from the other.
  perform 1
  from public.discount_codes
  where id = p_discount_code_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- An assignment that already exists is kept even if its product has since
  -- gone inactive, so saving an unrelated change (dates, active state) never
  -- silently drops it. Only a genuinely new assignment has to point at a
  -- product that exists and is currently active.
  select
    coalesce(
      array_agg(added.product_id) filter (where products.id is null),
      '{}'::uuid[]
    ),
    coalesce(
      array_agg(added.product_id) filter (
        where products.id is not null and products.is_active = false
      ),
      '{}'::uuid[]
    )
  into v_unknown_product_ids, v_inactive_product_ids
  from (
    select (assignment ->> 'product_id')::uuid as product_id
    from jsonb_array_elements(v_assignments) as element(assignment)
    where not exists (
      select 1
      from public.discount_code_products as existing
      where existing.discount_code_id = p_discount_code_id
        and existing.product_id = (assignment ->> 'product_id')::uuid
    )
  ) as added
  left join public.products as products
    on products.id = added.product_id;

  if array_length(v_unknown_product_ids, 1) is not null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'unknown_product',
      'product_ids', to_jsonb(v_unknown_product_ids)
    );
  end if;

  if array_length(v_inactive_product_ids, 1) is not null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'inactive_product',
      'product_ids', to_jsonb(v_inactive_product_ids)
    );
  end if;

  ----------------------------------------------------------------------------
  -- Writes. From here on, a failure rolls the whole edit back.
  ----------------------------------------------------------------------------

  -- Inserts new assignments and updates changed ones in one statement. The
  -- (discount_code_id, product_id) primary key is what makes a resubmitted
  -- save land on the same rows instead of duplicating them, and the guard on
  -- the update branch leaves an unchanged percentage completely untouched so
  -- a repeated save does not churn updated_at.
  insert into public.discount_code_products as target (
    discount_code_id,
    product_id,
    discount_percent
  )
  select
    p_discount_code_id,
    (assignment ->> 'product_id')::uuid,
    (assignment ->> 'discount_percent')::numeric
  from jsonb_array_elements(v_assignments) as element(assignment)
  on conflict (discount_code_id, product_id) do update
  set discount_percent = excluded.discount_percent
  where target.discount_percent is distinct from excluded.discount_percent;

  -- Anything the admin removed from the form. Scoped to this coupon, so no
  -- other coupon's assignments can be caught by it.
  delete from public.discount_code_products as assignments
  where assignments.discount_code_id = p_discount_code_id
    and not exists (
      select 1
      from jsonb_array_elements(v_assignments) as element(assignment)
      where (assignment ->> 'product_id')::uuid = assignments.product_id
    );

  get diagnostics v_removed_count = row_count;

  update public.discount_codes
  set
    is_active = p_is_active,
    starts_at = p_starts_at,
    expires_at = p_expires_at
  where id = p_discount_code_id;

  -- The row was locked above, so it cannot vanish underneath this. Raising
  -- rather than returning is deliberate: it discards the assignment writes
  -- made just above instead of committing them against a missing coupon.
  if not found then
    raise exception 'Coupon % disappeared during update.', p_discount_code_id;
  end if;

  select count(*)
  into v_assigned_count
  from public.discount_code_products
  where discount_code_id = p_discount_code_id;

  return jsonb_build_object(
    'ok', true,
    'coupon_id', p_discount_code_id,
    'assigned_product_count', v_assigned_count,
    'removed_product_count', v_removed_count
  );
end;
$$;

comment on function public.update_discount_code_with_assignments(
  uuid, boolean, timestamptz, timestamptz, jsonb
) is
  'Applies a complete coupon edit — fields, added, changed, and removed product assignments — in one transaction. Callers pass the full desired assignment set; anything omitted is removed.';

-- Coupon configuration is trusted-server data. Only the service role, used by
-- the admin data layer, may run this.
revoke execute on function public.update_discount_code_with_assignments(
  uuid, boolean, timestamptz, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.update_discount_code_with_assignments(
  uuid, boolean, timestamptz, timestamptz, jsonb
) to service_role;
