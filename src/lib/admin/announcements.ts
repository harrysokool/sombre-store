import "server-only";

import {
  validateAnnouncementSubmission,
  type AdminAnnouncementSubmission,
} from "@/lib/admin/announcement-content-rules";
import {
  validateAnnouncementSettingsSubmission,
  type AdminAnnouncementSettingsSubmission,
} from "@/lib/admin/announcement-settings-rules";
import { getAdminUser } from "@/lib/supabase/admin-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

// Trusted-server access to the announcement banner tables. Both are private
// here: the storefront reads its own filtered subset with the anonymous
// client, but the admin needs inactive rows too, which the public RLS policy
// deliberately hides, and every write goes through the service role.
//
// Reordering is not here. sort_order is assigned on create and never rewritten
// by an edit; the controls that move an announcement arrive in a later phase.

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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVALID_REFERENCE_MESSAGE = "That announcement reference is not valid.";
const MISSING_ANNOUNCEMENT_MESSAGE =
  "That announcement no longer exists. Refresh the list.";

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

export type AdminAnnouncementMutationResult =
  | { ok: true; announcement: AdminAnnouncement }
  | { ok: false; error: string };

export type AdminAnnouncementDeletionResult =
  | { ok: true; announcementId: string }
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

/**
 * One announcement by id, for the editor route.
 *
 * A reference that is not a UUID returns null rather than reaching the
 * database, so a malformed URL produces the ordinary not-found page instead of
 * a query error.
 */
export async function getAdminAnnouncement(
  announcementId: string,
): Promise<AdminAnnouncement | null> {
  await assertAdmin();

  if (!UUID_PATTERN.test(announcementId)) {
    return null;
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .eq("id", announcementId)
    .maybeSingle<AdminAnnouncement>();

  if (error) {
    throw new Error("Announcement details could not be loaded.");
  }

  return data ?? null;
}

/**
 * Appends a new announcement to the end of the display order.
 *
 * sort_order is derived here, never submitted: it is the current maximum plus
 * one, or 0 for the first announcement. Two creates racing can land on the
 * same position, which is deliberately harmless — sort_order is not unique and
 * (sort_order, created_at) still resolves them to a stable order.
 */
export async function createAdminAnnouncement(
  input: AdminAnnouncementSubmission,
): Promise<AdminAnnouncementMutationResult> {
  await assertAdmin();

  const validated = validateAnnouncementSubmission(input);

  if (!validated.ok) {
    return validated;
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: lastAnnouncement, error: lastAnnouncementError } =
    await supabase
      .from("announcements")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle<{ sort_order: number }>();

  if (lastAnnouncementError) {
    console.error(
      "Failed to read the last announcement position",
      lastAnnouncementError,
    );
    return { ok: false, error: "Announcement could not be created. Try again." };
  }

  const { data, error } = await supabase
    .from("announcements")
    .insert({
      ...validated.value,
      sort_order: (lastAnnouncement?.sort_order ?? -1) + 1,
    })
    .select(ANNOUNCEMENT_COLUMNS)
    .maybeSingle<AdminAnnouncement>();

  if (error || !data) {
    console.error("Failed to create announcement", error);
    return { ok: false, error: "Announcement could not be created. Try again." };
  }

  return { ok: true, announcement: data };
}

/**
 * Rewrites one announcement's content and active flag.
 *
 * sort_order is deliberately absent from the update: position is changed only
 * by the reordering controls that arrive in a later phase, so saving an edit
 * can never move an announcement.
 */
export async function updateAdminAnnouncement(
  announcementId: string,
  input: AdminAnnouncementSubmission,
): Promise<AdminAnnouncementMutationResult> {
  await assertAdmin();

  if (!UUID_PATTERN.test(announcementId)) {
    return { ok: false, error: INVALID_REFERENCE_MESSAGE };
  }

  const validated = validateAnnouncementSubmission(input);

  if (!validated.ok) {
    return validated;
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("announcements")
    .update(validated.value)
    .eq("id", announcementId)
    .select(ANNOUNCEMENT_COLUMNS)
    .maybeSingle<AdminAnnouncement>();

  if (error) {
    console.error("Failed to update announcement", error);
    return { ok: false, error: "Announcement could not be saved. Try again." };
  }

  if (!data) {
    return { ok: false, error: MISSING_ANNOUNCEMENT_MESSAGE };
  }

  return { ok: true, announcement: data };
}

/**
 * Switches one announcement on or off without touching its content.
 *
 * Separate from updateAdminAnnouncement so the list toggle cannot accidentally
 * rewrite text it never loaded.
 */
export async function setAdminAnnouncementActive(
  announcementId: string,
  isActive: boolean,
): Promise<AdminAnnouncementMutationResult> {
  await assertAdmin();

  if (!UUID_PATTERN.test(announcementId)) {
    return { ok: false, error: INVALID_REFERENCE_MESSAGE };
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("announcements")
    .update({ is_active: isActive === true })
    .eq("id", announcementId)
    .select(ANNOUNCEMENT_COLUMNS)
    .maybeSingle<AdminAnnouncement>();

  if (error) {
    console.error("Failed to change announcement status", error);
    return {
      ok: false,
      error: "Announcement status could not be changed. Try again.",
    };
  }

  if (!data) {
    return { ok: false, error: MISSING_ANNOUNCEMENT_MESSAGE };
  }

  return { ok: true, announcement: data };
}

/**
 * Removes one announcement.
 *
 * The remaining rows keep their sort_order values, so the surviving order is
 * unchanged and gaps in the sequence are expected rather than repaired.
 */
export async function deleteAdminAnnouncement(
  announcementId: string,
): Promise<AdminAnnouncementDeletionResult> {
  await assertAdmin();

  if (!UUID_PATTERN.test(announcementId)) {
    return { ok: false, error: INVALID_REFERENCE_MESSAGE };
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", announcementId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    console.error("Failed to delete announcement", error);
    return { ok: false, error: "Announcement could not be deleted. Try again." };
  }

  if (!data) {
    return { ok: false, error: MISSING_ANNOUNCEMENT_MESSAGE };
  }

  return { ok: true, announcementId: data.id };
}
