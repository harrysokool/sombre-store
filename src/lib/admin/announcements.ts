import "server-only";

import { getAdminUser } from "@/lib/supabase/admin-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

// Read-only access to the announcement banner tables. Both are private to
// trusted server code here: the storefront reads its own filtered subset with
// the anonymous client, but the admin needs inactive rows too, which the public
// RLS policy deliberately hides. Writes arrive in a later phase.

const SETTINGS_COLUMNS =
  "id, is_enabled, rotation_interval_seconds, created_at, updated_at";

const ANNOUNCEMENT_COLUMNS =
  "id, prefix_text, highlight_text, suffix_text, link_label, link_href, is_active, sort_order, created_at, updated_at";

// The settings table holds exactly one row, pinned to this id by a check
// constraint in the migration that created it.
const SETTINGS_ROW_ID = 1;

export type AdminAnnouncementSettings = {
  id: number;
  is_enabled: boolean;
  rotation_interval_seconds: number;
  created_at: string;
  updated_at: string;
};

export type AdminAnnouncement = {
  id: string;
  prefix_text: string | null;
  highlight_text: string | null;
  suffix_text: string | null;
  link_label: string | null;
  link_href: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

async function assertAdmin() {
  const adminUser = await getAdminUser();

  if (!adminUser) {
    throw new Error(
      "Admin announcement data requested without an approved session.",
    );
  }
}

/**
 * The single global settings row. Returns null when the row is missing, which
 * the seed makes unlikely but which the caller must still show honestly rather
 * than reporting a banner state that was never read.
 */
export async function getAdminAnnouncementSettings(): Promise<AdminAnnouncementSettings | null> {
  await assertAdmin();

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("announcement_settings")
    .select(SETTINGS_COLUMNS)
    .eq("id", SETTINGS_ROW_ID)
    .maybeSingle<AdminAnnouncementSettings>();

  if (error) {
    throw new Error("Announcement settings could not be loaded.");
  }

  return data ?? null;
}

/**
 * Every announcement, active and inactive, in display order.
 *
 * The ordering is (sort_order, created_at) to match the storefront and the
 * partial index behind it. sort_order is not unique, so created_at is what
 * keeps two rows sharing a position in a stable, repeatable order.
 */
export async function listAdminAnnouncements(): Promise<AdminAnnouncement[]> {
  await assertAdmin();

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<AdminAnnouncement[]>();

  if (error) {
    throw new Error("Announcements could not be loaded.");
  }

  return data ?? [];
}
