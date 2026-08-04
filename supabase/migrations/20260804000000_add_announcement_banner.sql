-- Admin-managed announcement banner: schema and seed only.
--
-- Today the storefront banner copy is hardcoded in the React component. These
-- two tables are the data behind an admin-managed replacement: one global
-- settings row decides whether the banner appears at all and how fast it
-- rotates, and each announcements row is one message in that rotation.
--
-- This is phase 1 of that work. No application code reads or writes either
-- table yet and the storefront component is untouched, so nothing a customer
-- or an administrator can see changes when this migration is applied. The
-- seeded announcement deliberately reproduces the currently live copy, so the
-- later phase that switches the component over to this data renders exactly
-- what is on the site today.

-- Global banner switch and rotation speed. Exactly one row may ever exist: the
-- primary key is pinned to 1 by a check constraint, so a second row is
-- rejected by the primary key rather than silently competing with the first.
create table if not exists public.announcement_settings (
  id integer primary key default 1,
  -- Defaults to off so a row created without an explicit value cannot switch
  -- the banner on by accident. The seed below sets it on deliberately, because
  -- the banner is live on the storefront today.
  is_enabled boolean not null default false,
  rotation_interval_seconds integer not null default 10,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint announcement_settings_singleton_check
    check (id = 1),
  -- Below three seconds a message cannot be read before it moves on; above a
  -- minute the banner is static in practice and the rotation is pointless.
  constraint announcement_settings_rotation_interval_range_check
    check (rotation_interval_seconds between 3 and 60)
);

comment on table public.announcement_settings is
  'Single-row global configuration for the storefront announcement banner.';

comment on column public.announcement_settings.is_enabled is
  'Master switch. When false the storefront renders no banner regardless of how many active announcements exist.';

comment on column public.announcement_settings.rotation_interval_seconds is
  'Seconds each announcement is shown before the banner advances. Applies to the whole banner; announcements do not carry individual intervals.';

-- One message in the banner rotation. The three text columns are rendered in
-- order as a single sentence, with highlight_text styled as a pill, so leaving
-- prefix_text or suffix_text null is how the pill is moved to the start or the
-- end of the sentence. Every text column is nullable and an absent value is
-- stored as null, never as an empty string.
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  prefix_text text,
  highlight_text text,
  suffix_text text,
  link_label text,
  link_href text,
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  -- An announcement with no text at all would render as an empty bar.
  constraint announcements_content_present_check
    check (coalesce(prefix_text, highlight_text, suffix_text) is not null),
  -- A populated column holds real, trimmed content. Whitespace-only text would
  -- otherwise satisfy the check above while still rendering as nothing.
  constraint announcements_prefix_text_trimmed_check
    check (prefix_text is null or prefix_text = btrim(prefix_text)),
  constraint announcements_prefix_text_length_check
    check (prefix_text is null or char_length(prefix_text) between 1 and 80),
  constraint announcements_highlight_text_trimmed_check
    check (highlight_text is null or highlight_text = btrim(highlight_text)),
  constraint announcements_highlight_text_length_check
    check (highlight_text is null or char_length(highlight_text) between 1 and 32),
  constraint announcements_suffix_text_trimmed_check
    check (suffix_text is null or suffix_text = btrim(suffix_text)),
  constraint announcements_suffix_text_length_check
    check (suffix_text is null or char_length(suffix_text) between 1 and 120),
  constraint announcements_link_label_trimmed_check
    check (link_label is null or link_label = btrim(link_label)),
  constraint announcements_link_label_length_check
    check (link_label is null or char_length(link_label) between 1 and 32),
  constraint announcements_link_href_trimmed_check
    check (link_href is null or link_href = btrim(link_href)),
  constraint announcements_link_href_length_check
    check (link_href is null or char_length(link_href) between 1 and 200),
  -- A link needs both halves: a label with no target renders nothing useful,
  -- and a target with no label gives the customer nothing to click.
  constraint announcements_link_pair_check
    check ((link_label is null) = (link_href is null)),
  -- Internal paths only for this version. '^/($|[^/])' accepts '/' and
  -- '/shop' while rejecting '//evil.example', which browsers resolve as a
  -- protocol-relative URL to another origin, and rejecting anything with a
  -- scheme such as 'javascript:'. Backslashes are refused because some
  -- browsers normalise them to forward slashes, which would reopen the same
  -- off-site escape. Relax this with a new migration if external links are
  -- ever wanted.
  constraint announcements_link_href_internal_check
    check (link_href is null or (link_href ~ '^/($|[^/])' and position('\' in link_href) = 0)),
  -- Ordering is by (sort_order, created_at) everywhere, so sort_order is
  -- deliberately not unique: reordering can swap two values without needing a
  -- temporary placeholder, and created_at breaks any tie stably.
  constraint announcements_sort_order_non_negative_check
    check (sort_order >= 0)
);

comment on table public.announcements is
  'One message in the storefront announcement banner rotation.';

comment on column public.announcements.highlight_text is
  'Optional emphasised fragment, rendered as a pill between prefix_text and suffix_text. Typically a coupon code.';

comment on column public.announcements.sort_order is
  'Display position, ascending. Not unique; (sort_order, created_at) is the stable ordering used by both the storefront and the admin list.';

create index if not exists idx_announcements_active_order
  on public.announcements (sort_order, created_at)
  where is_active = true;

create trigger set_announcement_settings_updated_at
before update on public.announcement_settings
for each row
execute function public.set_updated_at();

create trigger set_announcements_updated_at
before update on public.announcements
for each row
execute function public.set_updated_at();

-- Banner content is public marketing copy, so the storefront reads it with the
-- anonymous client. Reads only: every write goes through trusted server code
-- using the service role, which bypasses RLS. Inactive announcements are
-- invisible to the public roles entirely, so a draft cannot leak through the
-- browser client before it is switched on.
--
-- Every privilege is revoked and then granted back by name, including for the
-- service role. supabase/config.toml leaves auto_expose_new_tables unset, so a
-- new table reaches none of the Data API roles without an explicit grant; the
-- admin data layer would fail with permission denied if the service role were
-- left to a default that no longer exists.
alter table public.announcement_settings enable row level security;
alter table public.announcements enable row level security;

revoke all privileges
  on table public.announcement_settings, public.announcements
  from public, anon, authenticated, service_role;

grant select
  on table public.announcement_settings, public.announcements
  to anon, authenticated;

-- The settings row is created by the seed below and is never deleted; it is
-- switched off rather than removed, so no delete privilege is granted. Insert
-- is granted so an upsert is available, which the singleton check constraint
-- and the primary key make safe: a second row cannot be created.
grant select, insert, update
  on table public.announcement_settings
  to service_role;

grant select, insert, update, delete
  on table public.announcements
  to service_role;

create policy "Public can read announcement settings"
  on public.announcement_settings
  for select
  to anon, authenticated
  using (true);

create policy "Public can read active announcements"
  on public.announcements
  for select
  to anon, authenticated
  using (is_active = true);

-- Seed the singleton settings row, switched on to match the banner that is
-- live on the storefront today.
insert into public.announcement_settings (id, is_enabled, rotation_interval_seconds)
values (1, true, 10)
on conflict (id) do nothing;

-- Seed the currently live announcement copy, so the phase that switches the
-- storefront component to this data is a no-op visually. Guarded on the table
-- being empty rather than on a unique column, because no column here is
-- naturally unique; re-running this migration against a populated table
-- inserts nothing.
insert into public.announcements (
  prefix_text,
  highlight_text,
  suffix_text,
  link_label,
  link_href,
  is_active,
  sort_order
)
select
  'Use code',
  'HAPPY2026',
  'for up to 60% off selected products',
  'Shop Now',
  '/shop',
  true,
  0
where not exists (select 1 from public.announcements);
