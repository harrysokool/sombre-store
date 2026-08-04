import "server-only";

import {
  validateAnnouncementSubmission,
  type AdminAnnouncementSubmission,
} from "@/lib/admin/announcement-content-rules";
import {
  getAdjacentIndex,
  isAnnouncementMoveDirection,
} from "@/lib/admin/announcement-order-rules";
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
// sort_order is assigned on create and rewritten only by moveAdminAnnouncement,
// which swaps two neighbours. An edit never changes an announcement's position,
// and the browser never supplies a position.

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
const MOVE_FAILED_MESSAGE =
  "Announcement could not be moved. Try again.";

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

export type AdminAnnouncementMoveResult =
  | { ok: true; moved: boolean; announcements: AdminAnnouncement[] }
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

/**
 * Moves one announcement a single place up or down.
 *
 * The order is a derived view of (sort_order, created_at), so the move is
 * expressed by swapping the two neighbours' sort_order values and nothing
 * else. Gaps in the sequence are preserved: swapping 0 and 5 still exchanges
 * those two positions, and no other row is renumbered.
 *
 * Reaching the end of the list is an ordinary outcome, not an error — the
 * result says the move did not happen rather than claiming one that did not.
 */
export async function moveAdminAnnouncement(
  announcementId: string,
  direction: unknown,
): Promise<AdminAnnouncementMoveResult> {
  await assertAdmin();

  if (!UUID_PATTERN.test(announcementId)) {
    return { ok: false, error: INVALID_REFERENCE_MESSAGE };
  }

  if (!isAnnouncementMoveDirection(direction)) {
    return { ok: false, error: "That move direction is not recognised." };
  }

  const supabase = createSupabaseServiceRoleClient();
  // The whole list in display order. Positions are decided here from stored
  // values; the browser never supplies a sort_order.
  const { data, error } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<AdminAnnouncement[]>();

  if (error) {
    console.error("Failed to read announcements before moving", error);
    return { ok: false, error: MOVE_FAILED_MESSAGE };
  }

  const announcements = data ?? [];
  const index = announcements.findIndex(
    (announcement) => announcement.id === announcementId,
  );

  if (index === -1) {
    return { ok: false, error: MISSING_ANNOUNCEMENT_MESSAGE };
  }

  const targetIndex = getAdjacentIndex(index, direction, announcements.length);

  if (targetIndex === null) {
    // Already at the end it was asked to move toward. The controls disable
    // this, so reaching here means a stale page or a direct request.
    return { ok: true, moved: false, announcements };
  }

  const moving = announcements[index];
  const neighbour = announcements[targetIndex];

  // Two rows sharing a position are ordered by created_at, which this swap
  // cannot change: exchanging equal values would leave the list exactly as it
  // is. Say so rather than reporting a move that did not happen.
  if (moving.sort_order === neighbour.sort_order) {
    return {
      ok: false,
      error:
        "These two announcements share the same position, so they cannot be swapped. Recreate one of them to give it a new position.",
    };
  }

  const { error: movingError } = await supabase
    .from("announcements")
    .update({ sort_order: neighbour.sort_order })
    .eq("id", moving.id)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (movingError) {
    console.error("Failed to move announcement", movingError);
    return { ok: false, error: MOVE_FAILED_MESSAGE };
  }

  const { error: neighbourError } = await supabase
    .from("announcements")
    .update({ sort_order: moving.sort_order })
    .eq("id", neighbour.id)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (neighbourError) {
    console.error("Failed to move the adjacent announcement", neighbourError);

    // Without a transaction the first write already landed, leaving both rows
    // on the same position. Put it back so the list stays swappable.
    const { error: rollbackError } = await supabase
      .from("announcements")
      .update({ sort_order: moving.sort_order })
      .eq("id", moving.id)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (rollbackError) {
      console.error(
        "Failed to restore the announcement position after a partial move",
        rollbackError,
      );
    }

    return { ok: false, error: MOVE_FAILED_MESSAGE };
  }

  // The result is the loaded list with those two entries exchanged, which is
  // what re-reading with the same ordering would produce.
  const reordered = [...announcements];
  reordered[index] = { ...neighbour, sort_order: moving.sort_order };
  reordered[targetIndex] = { ...moving, sort_order: neighbour.sort_order };

  return { ok: true, moved: true, announcements: reordered };
}
