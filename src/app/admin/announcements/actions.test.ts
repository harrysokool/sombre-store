import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  updateAdminAnnouncementSettings: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  getAdminUser: mocks.getAdminUser,
}));

vi.mock("@/lib/admin/announcements", () => ({
  updateAdminAnnouncementSettings: mocks.updateAdminAnnouncementSettings,
}));

import { updateAnnouncementSettingsAction } from "./actions";

const SETTINGS = {
  id: 1,
  is_enabled: true,
  rotation_interval_seconds: 10,
  created_at: "2026-08-04T00:00:00.000Z",
  updated_at: "2026-08-04T00:00:00.000Z",
};

const initialState = { error: null, success: null };

function formData(entries: Record<string, string>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }

  return data;
}

describe("updateAnnouncementSettingsAction", () => {
  beforeEach(() => {
    mocks.getAdminUser.mockReset();
    mocks.updateAdminAnnouncementSettings.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.getAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
    mocks.updateAdminAnnouncementSettings.mockResolvedValue({
      ok: true,
      settings: SETTINGS,
    });
  });

  describe("authorization", () => {
    it("refuses an expired session before reaching the data layer", async () => {
      mocks.getAdminUser.mockResolvedValue(null);

      const state = await updateAnnouncementSettingsAction(
        initialState,
        formData({ isEnabled: "on", rotationIntervalSeconds: "10" }),
      );

      expect(state.error).toContain("admin session has ended");
      expect(state.success).toBeNull();
      // A Server Action is a directly callable endpoint, so this gate runs
      // before anything reads or writes.
      expect(mocks.updateAdminAnnouncementSettings).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("form parsing", () => {
    it("reads a checked toggle as enabled", async () => {
      await updateAnnouncementSettingsAction(
        initialState,
        formData({ isEnabled: "on", rotationIntervalSeconds: "10" }),
      );

      expect(mocks.updateAdminAnnouncementSettings).toHaveBeenCalledWith({
        isEnabled: true,
        rotationIntervalSeconds: "10",
      });
    });

    it("reads an absent toggle as disabled", async () => {
      // An unchecked checkbox is not submitted at all, which is what a
      // disabled banner looks like on the wire.
      await updateAnnouncementSettingsAction(
        initialState,
        formData({ rotationIntervalSeconds: "10" }),
      );

      expect(mocks.updateAdminAnnouncementSettings).toHaveBeenCalledWith({
        isEnabled: false,
        rotationIntervalSeconds: "10",
      });
    });

    it("passes the raw interval through for the data layer to validate", async () => {
      await updateAnnouncementSettingsAction(
        initialState,
        formData({ isEnabled: "on", rotationIntervalSeconds: "  61 " }),
      );

      expect(mocks.updateAdminAnnouncementSettings).toHaveBeenCalledWith({
        isEnabled: true,
        rotationIntervalSeconds: "  61 ",
      });
    });
  });

  describe("success", () => {
    it("revalidates the announcements page after a confirmed write", async () => {
      const state = await updateAnnouncementSettingsAction(
        initialState,
        formData({ isEnabled: "on", rotationIntervalSeconds: "10" }),
      );

      expect(state.error).toBeNull();
      expect(state.success).toContain("Banner settings saved.");
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/announcements");
    });

    it("describes the saved state using the row the database returned", async () => {
      mocks.updateAdminAnnouncementSettings.mockResolvedValue({
        ok: true,
        settings: { ...SETTINGS, is_enabled: true, rotation_interval_seconds: 25 },
      });

      const state = await updateAnnouncementSettingsAction(
        initialState,
        formData({ isEnabled: "on", rotationIntervalSeconds: "25" }),
      );

      expect(state.success).toContain("rotating every 25 seconds");
    });

    it("does not claim a rotation speed when the banner is off", async () => {
      mocks.updateAdminAnnouncementSettings.mockResolvedValue({
        ok: true,
        settings: { ...SETTINGS, is_enabled: false },
      });

      const state = await updateAnnouncementSettingsAction(
        initialState,
        formData({ rotationIntervalSeconds: "10" }),
      );

      expect(state.success).toBe("Banner settings saved. The banner is off.");
      expect(state.success).not.toContain("rotating");
    });
  });

  describe("failure", () => {
    it("returns a refusal without revalidating", async () => {
      mocks.updateAdminAnnouncementSettings.mockResolvedValue({
        ok: false,
        error: "The rotation interval must be between 3 and 60 seconds.",
      });

      const state = await updateAnnouncementSettingsAction(
        initialState,
        formData({ isEnabled: "on", rotationIntervalSeconds: "61" }),
      );

      expect(state.error).toBe(
        "The rotation interval must be between 3 and 60 seconds.",
      );
      expect(state.success).toBeNull();
      // Nothing changed, so the cached page must not be discarded.
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("returns the missing-row refusal unchanged", async () => {
      mocks.updateAdminAnnouncementSettings.mockResolvedValue({
        ok: false,
        error:
          "The banner settings row is missing, so nothing was saved. Restore it before changing the banner.",
      });

      const state = await updateAnnouncementSettingsAction(
        initialState,
        formData({ isEnabled: "on", rotationIntervalSeconds: "10" }),
      );

      expect(state.error).toContain("banner settings row is missing");
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("turns an unexpected rejection into one generic message", async () => {
      mocks.updateAdminAnnouncementSettings.mockRejectedValue(
        new Error('relation "announcement_settings" does not exist'),
      );
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const state = await updateAnnouncementSettingsAction(
        initialState,
        formData({ isEnabled: "on", rotationIntervalSeconds: "10" }),
      );

      expect(state.error).toBe("Banner settings could not be saved. Try again.");
      // No Supabase or PostgreSQL text reaches the administrator.
      expect(state.error).not.toContain("relation");
      expect(state.success).toBeNull();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });
});
