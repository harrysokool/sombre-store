import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260804000000_add_announcement_banner.sql",
  import.meta.url,
);

async function migrationSql() {
  return (await readFile(migrationUrl, "utf8"))
    .replace(/\s+/g, " ")
    .toLowerCase();
}

describe("announcement banner migration contract", () => {
  it("creates a settings table that can only ever hold one row", async () => {
    const sql = await migrationSql();

    expect(sql).toContain(
      "create table if not exists public.announcement_settings",
    );
    expect(sql).toContain("id integer primary key default 1");
    expect(sql).toContain(
      "constraint announcement_settings_singleton_check check (id = 1)",
    );
  });

  it("defaults the banner off and bounds the rotation interval", async () => {
    const sql = await migrationSql();

    // A row created without an explicit value must not switch the banner on.
    expect(sql).toContain("is_enabled boolean not null default false");
    expect(sql).toContain(
      "rotation_interval_seconds integer not null default 10",
    );
    expect(sql).toContain(
      "constraint announcement_settings_rotation_interval_range_check check (rotation_interval_seconds between 3 and 60)",
    );
  });

  it("stores announcement content as five separately nullable fields", async () => {
    const sql = await migrationSql();

    expect(sql).toContain("create table if not exists public.announcements");

    // Nullable so the highlighted pill can lead, close, or sit inside the
    // sentence depending on which neighbours are populated.
    for (const column of [
      "prefix_text text,",
      "highlight_text text,",
      "suffix_text text,",
      "link_label text,",
      "link_href text,",
    ]) {
      expect(sql).toContain(column);
    }

    expect(sql).toContain("is_active boolean not null default false");
    expect(sql).toContain("sort_order integer not null default 0");
  });

  it("requires at least one of the three text fields", async () => {
    const sql = await migrationSql();

    expect(sql).toContain(
      "constraint announcements_content_present_check check (coalesce(prefix_text, highlight_text, suffix_text) is not null)",
    );
  });

  it("keeps every populated text field trimmed, non-empty, and bounded", async () => {
    const sql = await migrationSql();

    const fieldLimits = [
      ["prefix_text", 80],
      ["highlight_text", 32],
      ["suffix_text", 120],
      ["link_label", 32],
      ["link_href", 200],
    ] as const;

    for (const [field, maxLength] of fieldLimits) {
      // Whitespace-only text would otherwise satisfy the content check above
      // while still rendering as nothing.
      expect(sql).toContain(
        `constraint announcements_${field}_trimmed_check check (${field} is null or ${field} = btrim(${field}))`,
      );
      // The lower bound of 1 is what makes an absent value null rather than "".
      expect(sql).toContain(
        `constraint announcements_${field}_length_check check (${field} is null or char_length(${field}) between 1 and ${maxLength})`,
      );
    }
  });

  it("requires a link to have both halves or neither", async () => {
    const sql = await migrationSql();

    expect(sql).toContain(
      "constraint announcements_link_pair_check check ((link_label is null) = (link_href is null))",
    );
  });

  it("restricts link targets to internal paths", async () => {
    const sql = await migrationSql();

    // '^/($|[^/])' admits '/' and '/shop' but refuses '//evil.example', which
    // a browser resolves as a protocol-relative URL to another origin, and
    // refuses any scheme such as 'javascript:'. The backslash check closes the
    // same escape via separators some browsers normalise to '/'.
    expect(sql).toContain(
      "constraint announcements_link_href_internal_check check (link_href is null or (link_href ~ '^/($|[^/])' and position('\\' in link_href) = 0))",
    );
  });

  it("keeps sort_order non-negative and orders on (sort_order, created_at)", async () => {
    const sql = await migrationSql();

    expect(sql).toContain(
      "constraint announcements_sort_order_non_negative_check check (sort_order >= 0)",
    );
    // Deliberately not unique, so a reorder can swap two values without a
    // temporary placeholder. created_at is the stable tiebreak.
    expect(sql).not.toContain("constraint announcements_sort_order_unique");
    expect(sql).toContain(
      "create index if not exists idx_announcements_active_order on public.announcements (sort_order, created_at) where is_active = true",
    );
  });

  it("keeps updated_at maintained by the shared trigger", async () => {
    const sql = await migrationSql();

    expect(sql).toContain(
      "create trigger set_announcement_settings_updated_at before update on public.announcement_settings for each row execute function public.set_updated_at()",
    );
    expect(sql).toContain(
      "create trigger set_announcements_updated_at before update on public.announcements for each row execute function public.set_updated_at()",
    );
  });

  it("exposes read-only public access, and only to active announcements", async () => {
    const sql = await migrationSql();

    expect(sql).toContain(
      "alter table public.announcement_settings enable row level security",
    );
    expect(sql).toContain(
      "alter table public.announcements enable row level security",
    );
    expect(sql).toContain(
      "revoke all privileges on table public.announcement_settings, public.announcements from public, anon, authenticated, service_role",
    );
    expect(sql).toContain(
      "grant select on table public.announcement_settings, public.announcements to anon, authenticated",
    );
    expect(sql).toContain(
      'create policy "public can read announcement settings" on public.announcement_settings for select to anon, authenticated using (true)',
    );
    // An inactive announcement is invisible to the browser client entirely, so
    // a draft cannot leak before it is switched on.
    expect(sql).toContain(
      'create policy "public can read active announcements" on public.announcements for select to anon, authenticated using (is_active = true)',
    );
  });

  it("grants the service role the access the admin layer will need", async () => {
    const sql = await migrationSql();

    // supabase/config.toml leaves auto_expose_new_tables unset, so a new table
    // reaches none of the Data API roles without an explicit grant. Without
    // these the admin data layer fails with permission denied.
    expect(sql).toContain(
      "grant select, insert, update on table public.announcement_settings to service_role",
    );
    expect(sql).toContain(
      "grant select, insert, update, delete on table public.announcements to service_role",
    );
    // The singleton is switched off, never removed.
    expect(sql).not.toContain(
      "delete on table public.announcement_settings to service_role",
    );
  });

  it("grants the public roles no way to write banner content", async () => {
    const sql = await migrationSql();

    // Read every grant in the migration and assert that any carrying a write
    // privilege targets the service role alone. Checking the parsed clauses
    // rather than raw substrings keeps this honest as the grant list grows.
    const grantClauses = sql
      .split("grant ")
      .slice(1)
      .map((clause) => clause.split(";")[0]);

    expect(grantClauses.length).toBeGreaterThan(0);

    for (const clause of grantClauses) {
      if (!/\b(insert|update|delete|truncate|references|trigger)\b/.test(clause)) {
        continue;
      }

      expect(clause).toContain("to service_role");
      expect(clause).not.toContain("anon");
      expect(clause).not.toContain("authenticated");
    }

    // Public access is read-only by policy as well as by privilege.
    for (const writePolicy of [
      "for insert",
      "for update",
      "for delete",
      "for all",
    ]) {
      expect(sql).not.toContain(writePolicy);
    }
  });

  it("seeds the settings row switched on at a ten second interval", async () => {
    const sql = await migrationSql();

    expect(sql).toContain(
      "insert into public.announcement_settings (id, is_enabled, rotation_interval_seconds) values (1, true, 10) on conflict (id) do nothing",
    );
  });

  it("seeds the currently live storefront copy", async () => {
    const sql = await migrationSql();

    // Reproduces the hardcoded banner exactly, so the later phase that points
    // the component at this data is a visual no-op.
    expect(sql).toContain(
      "'use code', 'happy2026', 'for up to 60% off selected products', 'shop now', '/shop', true, 0",
    );
    // No column here is naturally unique, so the guard is the table being
    // empty. Re-running against a populated table inserts nothing.
    expect(sql).toContain(
      "where not exists (select 1 from public.announcements)",
    );
  });
});
