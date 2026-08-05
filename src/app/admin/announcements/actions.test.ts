import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  updateAdminAnnouncementSettings: vi.fn(),
  createAdminAnnouncement: vi.fn(),
  updateAdminAnnouncement: vi.fn(),
  setAdminAnnouncementActive: vi.fn(),
  deleteAdminAnnouncement: vi.fn(),
  moveAdminAnnouncement: vi.fn(),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
  redirect: vi.fn(),
}));

// The real redirect() signals by throwing, which is what makes it unsafe to
// call inside a try/catch. Mirroring that here is what proves the actions call
// it from outside one.
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  updateTag: mocks.updateTag,
}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  getAdminUser: mocks.getAdminUser,
}));

vi.mock("@/lib/admin/announcements", () => ({
  updateAdminAnnouncementSettings: mocks.updateAdminAnnouncementSettings,
  createAdminAnnouncement: mocks.createAdminAnnouncement,
  updateAdminAnnouncement: mocks.updateAdminAnnouncement,
  setAdminAnnouncementActive: mocks.setAdminAnnouncementActive,
  deleteAdminAnnouncement: mocks.deleteAdminAnnouncement,
  moveAdminAnnouncement: mocks.moveAdminAnnouncement,
}));

import {
  createAnnouncementAction,
  deleteAnnouncementAction,
  moveAnnouncementAction,
  setAnnouncementActiveAction,
  updateAnnouncementAction,
  updateAnnouncementSettingsAction,
} from "./actions";

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
    mocks.updateTag.mockReset();
    mocks.redirect.mockReset();
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
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

const ANNOUNCEMENT_ID = "11111111-1111-4111-8111-111111111111";

const ANNOUNCEMENT = {
  id: ANNOUNCEMENT_ID,
  prefix_text: "Use code",
  highlight_text: "HAPPY2026",
  suffix_text: "for up to 60% off selected products",
  link_label: "Shop Now",
  link_href: "/shop",
  is_active: true,
  sort_order: 0,
  created_at: "2026-08-04T00:00:00.000Z",
  updated_at: "2026-08-04T00:00:00.000Z",
};

const formState = { error: null, success: null, announcementId: null };
const listState = { error: null, success: null };

/** A successful create or edit ends in redirect(), which throws to signal. */
async function expectRedirectToList(run: () => Promise<unknown>) {
  await expect(run()).rejects.toThrow("NEXT_REDIRECT");
  expect(mocks.redirect).toHaveBeenCalledWith("/admin/announcements");
}

function contentFormData(overrides: Record<string, string> = {}) {
  return formData({
    prefixText: "Use code",
    highlightText: "HAPPY2026",
    suffixText: "for up to 60% off selected products",
    linkLabel: "Shop Now",
    linkHref: "/shop",
    isActive: "on",
    ...overrides,
  });
}

describe("announcement item actions", () => {
  beforeEach(() => {
    mocks.getAdminUser.mockReset();
    mocks.createAdminAnnouncement.mockReset();
    mocks.updateAdminAnnouncement.mockReset();
    mocks.setAdminAnnouncementActive.mockReset();
    mocks.deleteAdminAnnouncement.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.updateTag.mockReset();
    mocks.redirect.mockReset();
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    mocks.getAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
    mocks.createAdminAnnouncement.mockResolvedValue({
      ok: true,
      announcement: ANNOUNCEMENT,
    });
    mocks.updateAdminAnnouncement.mockResolvedValue({
      ok: true,
      announcement: ANNOUNCEMENT,
    });
    mocks.setAdminAnnouncementActive.mockResolvedValue({
      ok: true,
      announcement: ANNOUNCEMENT,
    });
    mocks.deleteAdminAnnouncement.mockResolvedValue({
      ok: true,
      announcementId: ANNOUNCEMENT_ID,
    });
  });

  describe("authorization", () => {
    it.each([
      [
        "createAnnouncementAction",
        () => createAnnouncementAction(formState, contentFormData()),
        "createAdminAnnouncement",
      ],
      [
        "updateAnnouncementAction",
        () =>
          updateAnnouncementAction(
            formState,
            contentFormData({ announcementId: ANNOUNCEMENT_ID }),
          ),
        "updateAdminAnnouncement",
      ],
      [
        "setAnnouncementActiveAction",
        () =>
          setAnnouncementActiveAction(
            listState,
            formData({ announcementId: ANNOUNCEMENT_ID, isActive: "false" }),
          ),
        "setAdminAnnouncementActive",
      ],
      [
        "deleteAnnouncementAction",
        () =>
          deleteAnnouncementAction(
            listState,
            formData({ announcementId: ANNOUNCEMENT_ID }),
          ),
        "deleteAdminAnnouncement",
      ],
    ])(
      "refuses %s on an expired session before any database call",
      async (_name, call, dataLayerFunction) => {
        mocks.getAdminUser.mockResolvedValue(null);

        const state = await call();

        expect(state.error).toContain("admin session has ended");
        expect(
          mocks[dataLayerFunction as keyof typeof mocks],
        ).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
      },
    );
  });

  describe("createAnnouncementAction", () => {
    it("passes the five content fields and the active flag through", async () => {
      await expectRedirectToList(() =>
        createAnnouncementAction(formState, contentFormData()),
      );

      expect(mocks.createAdminAnnouncement).toHaveBeenCalledWith({
        prefixText: "Use code",
        highlightText: "HAPPY2026",
        suffixText: "for up to 60% off selected products",
        linkLabel: "Shop Now",
        linkHref: "/shop",
        isActive: true,
      });
    });

    it("never forwards a submitted position", async () => {
      await expectRedirectToList(() =>
        createAnnouncementAction(
          formState,
          contentFormData({ sortOrder: "99", sort_order: "99" }),
        ),
      );

      // Position is the data layer's to assign; a crafted field is ignored.
      const submitted = mocks.createAdminAnnouncement.mock.calls[0][0];
      expect(submitted).not.toHaveProperty("sortOrder");
      expect(submitted).not.toHaveProperty("sort_order");
    });

    it("reads an absent checkbox as inactive", async () => {
      await expectRedirectToList(() =>
        createAnnouncementAction(formState, contentFormData({ isActive: "" })),
      );

      expect(mocks.createAdminAnnouncement).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it("revalidates then redirects to the list after success", async () => {
      await expectRedirectToList(() =>
        createAnnouncementAction(formState, contentFormData()),
      );

      expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/announcements");
      expect(mocks.revalidatePath).toHaveBeenCalledWith(
        `/admin/announcements/${ANNOUNCEMENT_ID}`,
      );
    });

    it("stays on the form when the write is refused", async () => {
      mocks.createAdminAnnouncement.mockResolvedValue({
        ok: false,
        error: "Enter at least one of prefix, highlight, or suffix text.",
      });

      const state = await createAnnouncementAction(
        formState,
        contentFormData(),
      );

      expect(state.error).toContain("at least one of prefix");
      expect(mocks.redirect).not.toHaveBeenCalled();
    });

    it("returns a validation refusal without revalidating", async () => {
      mocks.createAdminAnnouncement.mockResolvedValue({
        ok: false,
        error: "Enter at least one of prefix, highlight, or suffix text.",
      });

      const state = await createAnnouncementAction(
        formState,
        contentFormData(),
      );

      expect(state.error).toContain("at least one of prefix");
      expect(state.success).toBeNull();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("turns an unexpected rejection into one generic message", async () => {
      mocks.createAdminAnnouncement.mockRejectedValue(
        new Error('relation "announcements" does not exist'),
      );
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const state = await createAnnouncementAction(
        formState,
        contentFormData(),
      );

      expect(state.error).toBe("Announcement could not be created. Try again.");
      expect(state.error).not.toContain("relation");
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe("updateAnnouncementAction", () => {
    it("saves, revalidates both views, then redirects to the list", async () => {
      await expectRedirectToList(() =>
        updateAnnouncementAction(
          formState,
          contentFormData({ announcementId: ANNOUNCEMENT_ID }),
        ),
      );

      expect(mocks.updateAdminAnnouncement).toHaveBeenCalledWith(
        ANNOUNCEMENT_ID,
        expect.objectContaining({ prefixText: "Use code" }),
      );
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/announcements");
      expect(mocks.revalidatePath).toHaveBeenCalledWith(
        `/admin/announcements/${ANNOUNCEMENT_ID}`,
      );
    });

    it("refuses a missing reference before reaching the data layer", async () => {
      const state = await updateAnnouncementAction(
        formState,
        contentFormData(),
      );

      expect(state.error).toContain("reference is not valid");
      expect(mocks.updateAdminAnnouncement).not.toHaveBeenCalled();
      expect(mocks.redirect).not.toHaveBeenCalled();
    });

    it("surfaces a vanished announcement without revalidating", async () => {
      mocks.updateAdminAnnouncement.mockResolvedValue({
        ok: false,
        error: "That announcement no longer exists. Refresh the list.",
      });

      const state = await updateAnnouncementAction(
        formState,
        contentFormData({ announcementId: ANNOUNCEMENT_ID }),
      );

      expect(state.error).toContain("no longer exists");
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
      // A refused write keeps the administrator on the form with their input.
      expect(mocks.redirect).not.toHaveBeenCalled();
    });

    it("stays on the form when the write throws", async () => {
      mocks.updateAdminAnnouncement.mockRejectedValue(new Error("boom"));
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const state = await updateAnnouncementAction(
        formState,
        contentFormData({ announcementId: ANNOUNCEMENT_ID }),
      );

      expect(state.error).toBe("Announcement could not be saved. Try again.");
      expect(mocks.redirect).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe("setAnnouncementActiveAction", () => {
    it.each([
      ["activates", "true", true, "Announcement activated."],
      ["deactivates", "false", false, "Announcement deactivated."],
    ])("%s an announcement", async (_name, submitted, expected, message) => {
      mocks.setAdminAnnouncementActive.mockResolvedValue({
        ok: true,
        announcement: { ...ANNOUNCEMENT, is_active: expected },
      });

      const state = await setAnnouncementActiveAction(
        listState,
        formData({ announcementId: ANNOUNCEMENT_ID, isActive: submitted }),
      );

      expect(mocks.setAdminAnnouncementActive).toHaveBeenCalledWith(
        ANNOUNCEMENT_ID,
        expected,
      );
      expect(state.success).toBe(message);
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/announcements");
    });

    it("describes the state the database actually returned", async () => {
      // The row came back active even though "false" was submitted; the
      // message follows the database, not the request.
      mocks.setAdminAnnouncementActive.mockResolvedValue({
        ok: true,
        announcement: { ...ANNOUNCEMENT, is_active: true },
      });

      const state = await setAnnouncementActiveAction(
        listState,
        formData({ announcementId: ANNOUNCEMENT_ID, isActive: "false" }),
      );

      expect(state.success).toBe("Announcement activated.");
    });

    it("returns a refusal without revalidating", async () => {
      mocks.setAdminAnnouncementActive.mockResolvedValue({
        ok: false,
        error: "That announcement no longer exists. Refresh the list.",
      });

      const state = await setAnnouncementActiveAction(
        listState,
        formData({ announcementId: ANNOUNCEMENT_ID, isActive: "true" }),
      );

      expect(state.error).toContain("no longer exists");
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("deleteAnnouncementAction", () => {
    it("deletes and revalidates the list", async () => {
      const state = await deleteAnnouncementAction(
        listState,
        formData({ announcementId: ANNOUNCEMENT_ID }),
      );

      expect(mocks.deleteAdminAnnouncement).toHaveBeenCalledWith(
        ANNOUNCEMENT_ID,
      );
      expect(state.success).toBe("Announcement deleted.");
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/announcements");
    });

    it("does not revalidate the editor route of a deleted announcement", async () => {
      await deleteAnnouncementAction(
        listState,
        formData({ announcementId: ANNOUNCEMENT_ID }),
      );

      expect(mocks.revalidatePath).not.toHaveBeenCalledWith(
        `/admin/announcements/${ANNOUNCEMENT_ID}`,
      );
    });

    it("returns an already-deleted refusal without revalidating", async () => {
      mocks.deleteAdminAnnouncement.mockResolvedValue({
        ok: false,
        error: "That announcement no longer exists. Refresh the list.",
      });

      const state = await deleteAnnouncementAction(
        listState,
        formData({ announcementId: ANNOUNCEMENT_ID }),
      );

      expect(state.error).toContain("no longer exists");
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("turns an unexpected rejection into one generic message", async () => {
      mocks.deleteAdminAnnouncement.mockRejectedValue(
        new Error("permission denied for table announcements"),
      );
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const state = await deleteAnnouncementAction(
        listState,
        formData({ announcementId: ANNOUNCEMENT_ID }),
      );

      expect(state.error).toBe("Announcement could not be deleted. Try again.");
      expect(state.error).not.toContain("permission denied");
      consoleError.mockRestore();
    });
  });
});

describe("moveAnnouncementAction", () => {
  beforeEach(() => {
    mocks.getAdminUser.mockReset();
    mocks.moveAdminAnnouncement.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.updateTag.mockReset();
    mocks.redirect.mockReset();
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    mocks.getAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
    mocks.moveAdminAnnouncement.mockResolvedValue({
      ok: true,
      moved: true,
      announcements: [ANNOUNCEMENT],
    });
  });

  it("refuses an expired session before any database call", async () => {
    mocks.getAdminUser.mockResolvedValue(null);

    const state = await moveAnnouncementAction(
      listState,
      formData({ announcementId: ANNOUNCEMENT_ID, direction: "up" }),
    );

    expect(state.error).toContain("admin session has ended");
    expect(mocks.moveAdminAnnouncement).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["up", "down"])(
    "moves %s and revalidates the list without announcing it",
    async (direction) => {
      const state = await moveAnnouncementAction(
        listState,
        formData({ announcementId: ANNOUNCEMENT_ID, direction }),
      );

      expect(mocks.moveAdminAnnouncement).toHaveBeenCalledWith(
        ANNOUNCEMENT_ID,
        direction,
      );
      // The announcement visibly changed places; that is the confirmation.
      expect(state.success).toBeNull();
      expect(state.error).toBeNull();
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/announcements");
    },
  );

  it("passes only the reference and direction, ignoring any submitted position", async () => {
    await moveAnnouncementAction(
      listState,
      formData({
        announcementId: ANNOUNCEMENT_ID,
        direction: "up",
        sortOrder: "99",
        sort_order: "99",
      }),
    );

    // Two arguments only; a crafted position never reaches the data layer.
    expect(mocks.moveAdminAnnouncement.mock.calls[0]).toEqual([
      ANNOUNCEMENT_ID,
      "up",
    ]);
  });

  it("forwards an unrecognised direction for the data layer to reject", async () => {
    mocks.moveAdminAnnouncement.mockResolvedValue({
      ok: false,
      error: "That move direction is not recognised.",
    });

    const state = await moveAnnouncementAction(
      listState,
      formData({ announcementId: ANNOUNCEMENT_ID, direction: "sideways" }),
    );

    expect(mocks.moveAdminAnnouncement).toHaveBeenCalledWith(
      ANNOUNCEMENT_ID,
      "sideways",
    );
    expect(state.error).toContain("not recognised");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["up", "down"])(
    "says nothing on a boundary %s move and does not revalidate",
    async (direction) => {
      mocks.moveAdminAnnouncement.mockResolvedValue({
        ok: true,
        moved: false,
        announcements: [ANNOUNCEMENT],
      });

      const state = await moveAnnouncementAction(
        listState,
        formData({ announcementId: ANNOUNCEMENT_ID, direction }),
      );

      // The disabled arrow normally prevents this, so there is nothing worth
      // telling the administrator.
      expect(state.error).toBeNull();
      expect(state.success).toBeNull();
      // Nothing changed, so the cached page is still correct.
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("still reports a failed move", async () => {
    mocks.moveAdminAnnouncement.mockResolvedValue({
      ok: false,
      error: "Announcement could not be moved. Try again.",
    });

    const state = await moveAnnouncementAction(
      listState,
      formData({ announcementId: ANNOUNCEMENT_ID, direction: "up" }),
    );

    // Silence is only for success: a failure must still speak up.
    expect(state.error).toBe("Announcement could not be moved. Try again.");
    expect(state.success).toBeNull();
  });

  it("returns a refusal without revalidating", async () => {
    mocks.moveAdminAnnouncement.mockResolvedValue({
      ok: false,
      error: "That announcement no longer exists. Refresh the list.",
    });

    const state = await moveAnnouncementAction(
      listState,
      formData({ announcementId: ANNOUNCEMENT_ID, direction: "up" }),
    );

    expect(state.error).toContain("no longer exists");
    expect(state.success).toBeNull();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("turns an unexpected rejection into one generic message", async () => {
    mocks.moveAdminAnnouncement.mockRejectedValue(
      new Error('relation "announcements" does not exist'),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const state = await moveAnnouncementAction(
      listState,
      formData({ announcementId: ANNOUNCEMENT_ID, direction: "up" }),
    );

    expect(state.error).toBe("Announcement could not be moved. Try again.");
    expect(state.error).not.toContain("relation");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("storefront cache invalidation", () => {
  const TAG = "announcements";

  beforeEach(() => {
    mocks.getAdminUser.mockReset();
    mocks.updateAdminAnnouncementSettings.mockReset();
    mocks.createAdminAnnouncement.mockReset();
    mocks.updateAdminAnnouncement.mockReset();
    mocks.setAdminAnnouncementActive.mockReset();
    mocks.deleteAdminAnnouncement.mockReset();
    mocks.moveAdminAnnouncement.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.updateTag.mockReset();
    mocks.redirect.mockReset();
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    mocks.getAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
    mocks.updateAdminAnnouncementSettings.mockResolvedValue({
      ok: true,
      settings: SETTINGS,
    });
    mocks.createAdminAnnouncement.mockResolvedValue({
      ok: true,
      announcement: ANNOUNCEMENT,
    });
    mocks.updateAdminAnnouncement.mockResolvedValue({
      ok: true,
      announcement: ANNOUNCEMENT,
    });
    mocks.setAdminAnnouncementActive.mockResolvedValue({
      ok: true,
      announcement: ANNOUNCEMENT,
    });
    mocks.deleteAdminAnnouncement.mockResolvedValue({
      ok: true,
      announcementId: ANNOUNCEMENT_ID,
    });
    mocks.moveAdminAnnouncement.mockResolvedValue({
      ok: true,
      moved: true,
      announcements: [ANNOUNCEMENT],
    });
  });

  const successfulMutations: Array<[string, () => Promise<unknown>]> = [
    [
      "settings save",
      () =>
        updateAnnouncementSettingsAction(
          initialState,
          formData({ isEnabled: "on", rotationIntervalSeconds: "10" }),
        ),
    ],
    [
      "create",
      () =>
        createAnnouncementAction(formState, contentFormData()).catch(
          () => undefined,
        ),
    ],
    [
      "edit",
      () =>
        updateAnnouncementAction(
          formState,
          contentFormData({ announcementId: ANNOUNCEMENT_ID }),
        ).catch(() => undefined),
    ],
    [
      "activate or deactivate",
      () =>
        setAnnouncementActiveAction(
          listState,
          formData({ announcementId: ANNOUNCEMENT_ID, isActive: "false" }),
        ),
    ],
    [
      "delete",
      () =>
        deleteAnnouncementAction(
          listState,
          formData({ announcementId: ANNOUNCEMENT_ID }),
        ),
    ],
    [
      "move",
      () =>
        moveAnnouncementAction(
          listState,
          formData({ announcementId: ANNOUNCEMENT_ID, direction: "up" }),
        ),
    ],
  ];

  it.each(successfulMutations)(
    "expires the storefront tag after a successful %s",
    async (_name, run) => {
      await run();

      // Without this the storefront keeps serving its cached banner until the
      // TTL backstop expires.
      expect(mocks.updateTag).toHaveBeenCalledWith(TAG);
    },
  );

  it.each(successfulMutations)(
    "keeps the admin path revalidation alongside the tag for %s",
    async (_name, run) => {
      await run();

      expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/announcements");
    },
  );

  describe("no invalidation without a change", () => {
    it("does not expire the tag when the session has ended", async () => {
      mocks.getAdminUser.mockResolvedValue(null);

      for (const [, run] of successfulMutations) {
        await run();
      }

      expect(mocks.updateTag).not.toHaveBeenCalled();
    });

    it("does not expire the tag on a validation refusal", async () => {
      mocks.createAdminAnnouncement.mockResolvedValue({
        ok: false,
        error: "Enter at least one of prefix, highlight, or suffix text.",
      });

      await createAnnouncementAction(formState, contentFormData());

      expect(mocks.updateTag).not.toHaveBeenCalled();
    });

    it("does not expire the tag on a database failure", async () => {
      mocks.deleteAdminAnnouncement.mockResolvedValue({
        ok: false,
        error: "Announcement could not be deleted. Try again.",
      });

      await deleteAnnouncementAction(
        listState,
        formData({ announcementId: ANNOUNCEMENT_ID }),
      );

      expect(mocks.updateTag).not.toHaveBeenCalled();
    });

    it("does not expire the tag on an unexpected rejection", async () => {
      mocks.updateAdminAnnouncement.mockRejectedValue(new Error("boom"));
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await updateAnnouncementAction(
        formState,
        contentFormData({ announcementId: ANNOUNCEMENT_ID }),
      );

      expect(mocks.updateTag).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it("does not expire the tag on a no-op boundary move", async () => {
      mocks.moveAdminAnnouncement.mockResolvedValue({
        ok: true,
        moved: false,
        announcements: [ANNOUNCEMENT],
      });

      const state = await moveAnnouncementAction(
        listState,
        formData({ announcementId: ANNOUNCEMENT_ID, direction: "up" }),
      );

      // Nothing moved, so the storefront's cached banner is still correct,
      // and there is nothing to tell the administrator.
      expect(state.success).toBeNull();
      expect(state.error).toBeNull();
      expect(mocks.updateTag).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
  });
});
