"use server";

import { revalidatePath } from "next/cache";

import {
  createAdminAnnouncement,
  deleteAdminAnnouncement,
  setAdminAnnouncementActive,
  updateAdminAnnouncement,
  updateAdminAnnouncementSettings,
} from "@/lib/admin/announcements";
import { getAdminUser } from "@/lib/supabase/admin-auth";

export type AnnouncementSettingsActionState = {
  error: string | null;
  success: string | null;
};

export async function updateAnnouncementSettingsAction(
  _previousState: AnnouncementSettingsActionState,
  formData: FormData,
): Promise<AnnouncementSettingsActionState> {
  // A Server Action is its own endpoint: anyone can post to it without ever
  // rendering the admin page, so the gate is re-checked here.
  // updateAdminAnnouncementSettings checks again and throws, which is the real
  // backstop — this branch only turns an expired session into a message
  // instead of a crash.
  const adminUser = await getAdminUser();

  if (!adminUser) {
    return {
      error:
        "Your admin session has ended. Sign in again to update banner settings.",
      success: null,
    };
  }

  try {
    // An unchecked checkbox is not submitted at all, so an absent value is
    // what "disabled" looks like here.
    const result = await updateAdminAnnouncementSettings({
      isEnabled: formData.get("isEnabled") === "on",
      rotationIntervalSeconds: formData.get("rotationIntervalSeconds"),
    });

    if (!result.ok) {
      return { error: result.error, success: null };
    }

    // Only after a confirmed write. A refused or failed save leaves the cached
    // page alone, because nothing about it changed.
    revalidatePath("/admin/announcements");

    return {
      error: null,
      success: result.settings.is_enabled
        ? `Banner settings saved. The banner is on, rotating every ${result.settings.rotation_interval_seconds} seconds.`
        : "Banner settings saved. The banner is off.",
    };
  } catch (error) {
    // Nothing from Supabase or PostgreSQL reaches the administrator: the
    // detail goes to the server log and the form gets one generic message.
    console.error("Admin announcement settings update failed", error);

    return {
      error: "Banner settings could not be saved. Try again.",
      success: null,
    };
  }
}

export type AnnouncementActionState = {
  error: string | null;
  success: string | null;
  announcementId: string | null;
};

export type AnnouncementListActionState = {
  error: string | null;
  success: string | null;
};

const EXPIRED_SESSION_ERROR =
  "Your admin session has ended. Sign in again to manage announcements.";

// The five content fields plus the active flag. sort_order is deliberately not
// read from the form: position is assigned by the data layer on create and is
// never changed by an edit.
function readAnnouncementSubmission(formData: FormData) {
  return {
    prefixText: formData.get("prefixText"),
    highlightText: formData.get("highlightText"),
    suffixText: formData.get("suffixText"),
    linkLabel: formData.get("linkLabel"),
    linkHref: formData.get("linkHref"),
    isActive: formData.get("isActive") === "on",
  };
}

function refreshAnnouncementViews(announcementId?: string) {
  revalidatePath("/admin/announcements");

  if (announcementId) {
    revalidatePath(`/admin/announcements/${announcementId}`);
  }
}

export async function createAnnouncementAction(
  _previousState: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  if (!(await getAdminUser())) {
    return { error: EXPIRED_SESSION_ERROR, success: null, announcementId: null };
  }

  try {
    const result = await createAdminAnnouncement(
      readAnnouncementSubmission(formData),
    );

    if (!result.ok) {
      return { error: result.error, success: null, announcementId: null };
    }

    refreshAnnouncementViews(result.announcement.id);

    return {
      error: null,
      success: "Announcement created.",
      announcementId: result.announcement.id,
    };
  } catch (error) {
    console.error("Admin announcement creation failed", error);
    return {
      error: "Announcement could not be created. Try again.",
      success: null,
      announcementId: null,
    };
  }
}

export async function updateAnnouncementAction(
  _previousState: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  if (!(await getAdminUser())) {
    return { error: EXPIRED_SESSION_ERROR, success: null, announcementId: null };
  }

  const announcementId = formData.get("announcementId");

  if (typeof announcementId !== "string") {
    return {
      error: "That announcement reference is not valid.",
      success: null,
      announcementId: null,
    };
  }

  try {
    const result = await updateAdminAnnouncement(
      announcementId.trim(),
      readAnnouncementSubmission(formData),
    );

    if (!result.ok) {
      return { error: result.error, success: null, announcementId: null };
    }

    refreshAnnouncementViews(result.announcement.id);

    return {
      error: null,
      success: "Announcement saved.",
      announcementId: result.announcement.id,
    };
  } catch (error) {
    console.error("Admin announcement update failed", error);
    return {
      error: "Announcement could not be saved. Try again.",
      success: null,
      announcementId: null,
    };
  }
}

export async function setAnnouncementActiveAction(
  _previousState: AnnouncementListActionState,
  formData: FormData,
): Promise<AnnouncementListActionState> {
  if (!(await getAdminUser())) {
    return { error: EXPIRED_SESSION_ERROR, success: null };
  }

  const announcementId = String(formData.get("announcementId") ?? "").trim();
  const isActive = formData.get("isActive") === "true";

  try {
    const result = await setAdminAnnouncementActive(announcementId, isActive);

    if (!result.ok) {
      return { error: result.error, success: null };
    }

    refreshAnnouncementViews(announcementId);

    return {
      error: null,
      success: result.announcement.is_active
        ? "Announcement activated."
        : "Announcement deactivated.",
    };
  } catch (error) {
    console.error("Admin announcement status change failed", error);
    return {
      error: "Announcement status could not be changed. Try again.",
      success: null,
    };
  }
}

export async function deleteAnnouncementAction(
  _previousState: AnnouncementListActionState,
  formData: FormData,
): Promise<AnnouncementListActionState> {
  if (!(await getAdminUser())) {
    return { error: EXPIRED_SESSION_ERROR, success: null };
  }

  const announcementId = String(formData.get("announcementId") ?? "").trim();

  try {
    const result = await deleteAdminAnnouncement(announcementId);

    if (!result.ok) {
      return { error: result.error, success: null };
    }

    refreshAnnouncementViews();

    return { error: null, success: "Announcement deleted." };
  } catch (error) {
    console.error("Admin announcement deletion failed", error);
    return {
      error: "Announcement could not be deleted. Try again.",
      success: null,
    };
  }
}
