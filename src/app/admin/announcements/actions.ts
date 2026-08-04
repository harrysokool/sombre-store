"use server";

import { revalidatePath } from "next/cache";

import { updateAdminAnnouncementSettings } from "@/lib/admin/announcements";
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
