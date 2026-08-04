import "server-only";

import {
  validateAnnouncementSettingsSubmission,
  type AdminAnnouncementSettingsSubmission,
} from "@/lib/admin/announcement-settings-rules";
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

const SAVE_FAILED_MESSAGE =
  "Banner settings could not be saved. Try again.";
const MISSING_SETTINGS_MESSAGE =
  "The banner settings row is missing, so nothing was saved. Restore it before changing the banner.";

export type AdminAnnouncementSettings = {
  id: number;
  is_enabled: boolean;
  rotation_interval_seconds: number;
  created_at: string;
  updated_at: string;
};

export type AdminAnnouncementSettingsMutationResult =
  | { ok: true; settings: AdminAnnouncementSettings }
  | { ok: false; error: string };

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
 * Writes the two configurable settings fields to the singleton row.
 *
 * Deliberately an UPDATE rather than an upsert: the row is created by the
 * migration that added the table, so a missing row means the database is not
 * in the state this code expects. Recreating it here would paper over that
 * with invented defaults, so it is reported instead.
 */
export async function updateAdminAnnouncementSettings(
  input: AdminAnnouncementSettingsSubmission,
): Promise<AdminAnnouncementSettingsMutationResult> {
  await assertAdmin();

  const validated = validateAnnouncementSettingsSubmission(input);

  if (!validated.ok) {
    return validated;
  }

  const supabase = createSupabaseServiceRoleClient();
  // Only these two columns are ever written. id, created_at, and updated_at
  // are left to the primary key and the set_updated_at trigger.
  const { data, error } = await supabase
    .from("announcement_settings")
    .update({
      is_enabled: validated.value.isEnabled,
      rotation_interval_seconds: validated.value.rotationIntervalSeconds,
    })
    .eq("id", SETTINGS_ROW_ID)
    .select(SETTINGS_COLUMNS)
    .maybeSingle<AdminAnnouncementSettings>();

  if (error) {
    console.error("Failed to update announcement settings", error);
    return { ok: false, error: SAVE_FAILED_MESSAGE };
  }

  if (!data) {
    return { ok: false, error: MISSING_SETTINGS_MESSAGE };
  }

  return { ok: true, settings: data };
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
