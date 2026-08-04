import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createSupabase: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  getAdminUser: mocks.getAdminUser,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: mocks.createSupabase,
}));

import {
  createAdminAnnouncement,
  deleteAdminAnnouncement,
  getAdminAnnouncement,
  getAdminAnnouncementSettings,
  listAdminAnnouncements,
  moveAdminAnnouncement,
  setAdminAnnouncementActive,
  updateAdminAnnouncement,
  updateAdminAnnouncementSettings,
} from "./announcements";

type QueryResult = {
  data?: unknown;
  error?: unknown;
};

function query(result: QueryResult = {}) {
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
  };
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  for (const method of [
    "select",
    "eq",
    "order",
    "update",
    "insert",
    "delete",
    "limit",
  ]) {
    builder[method] = vi.fn(() => builder);
  }

  builder.returns = vi.fn(async () => resolved);
  builder.maybeSingle = vi.fn(async () => resolved);

  return builder;
}

function supabaseWith(...queries: ReturnType<typeof query>[]) {
  const client = { from: vi.fn() };

  for (const builder of queries) {
    client.from.mockReturnValueOnce(builder);
  }

  mocks.createSupabase.mockReturnValue(client);
  return client;
}

const SETTINGS_ROW = {
  id: 1,
  is_enabled: true,
  rotation_interval_seconds: 10,
  created_at: "2026-08-04T00:00:00.000Z",
  updated_at: "2026-08-04T00:00:00.000Z",
};

const ANNOUNCEMENT_ROW = {
  id: "11111111-1111-4111-8111-111111111111",
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

describe("admin announcement reads", () => {
  beforeEach(() => {
    mocks.getAdminUser.mockReset();
    mocks.createSupabase.mockReset();
    mocks.getAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
  });

  describe("authorization", () => {
    it.each([
      ["getAdminAnnouncementSettings", getAdminAnnouncementSettings],
      ["listAdminAnnouncements", listAdminAnnouncements],
    ])("refuses %s without an approved session", async (_name, read) => {
      mocks.getAdminUser.mockResolvedValue(null);

      await expect(read()).rejects.toThrow(
        "Admin announcement data requested without an approved session.",
      );
      // The gate is checked before any client is built, so an unapproved
      // caller never reaches the service-role key at all.
      expect(mocks.createSupabase).not.toHaveBeenCalled();
    });

    it("refuses a settings write without an approved session", async () => {
      mocks.getAdminUser.mockResolvedValue(null);

      await expect(
        updateAdminAnnouncementSettings({
          isEnabled: true,
          rotationIntervalSeconds: 10,
        }),
      ).rejects.toThrow(
        "Admin announcement data requested without an approved session.",
      );
      // The guard runs before validation and before the client is built, so a
      // rejected caller cannot even probe which values would be accepted.
      expect(mocks.createSupabase).not.toHaveBeenCalled();
    });

    it("re-checks the session on every read rather than caching it", async () => {
      supabaseWith(
        query({ data: SETTINGS_ROW }),
        query({ data: [ANNOUNCEMENT_ROW] }),
      );

      await getAdminAnnouncementSettings();
      await listAdminAnnouncements();

      expect(mocks.getAdminUser).toHaveBeenCalledTimes(2);
    });
  });

  describe("getAdminAnnouncementSettings", () => {
    it("reads the singleton row by its pinned id", async () => {
      const builder = query({ data: SETTINGS_ROW });
      const client = supabaseWith(builder);

      await expect(getAdminAnnouncementSettings()).resolves.toEqual(
        SETTINGS_ROW,
      );

      expect(client.from).toHaveBeenCalledWith("announcement_settings");
      expect(builder.eq).toHaveBeenCalledWith("id", 1);
      expect(builder.maybeSingle).toHaveBeenCalled();
    });

    it("selects the settings columns the admin view renders", async () => {
      const builder = query({ data: SETTINGS_ROW });
      supabaseWith(builder);

      await getAdminAnnouncementSettings();

      const selected = String(builder.select.mock.calls[0][0]);
      for (const column of [
        "is_enabled",
        "rotation_interval_seconds",
      ]) {
        expect(selected).toContain(column);
      }
    });

    it("returns null when the settings row is missing", async () => {
      supabaseWith(query({ data: null }));

      await expect(getAdminAnnouncementSettings()).resolves.toBeNull();
    });

    it("reports a failed read without leaking the database error", async () => {
      supabaseWith(query({ error: { message: "connection refused" } }));

      await expect(getAdminAnnouncementSettings()).rejects.toThrow(
        "Announcement settings could not be loaded.",
      );
    });
  });

  describe("listAdminAnnouncements", () => {
    it("orders by sort_order and then created_at", async () => {
      const builder = query({ data: [ANNOUNCEMENT_ROW] });
      const client = supabaseWith(builder);

      await expect(listAdminAnnouncements()).resolves.toEqual([
        ANNOUNCEMENT_ROW,
      ]);

      expect(client.from).toHaveBeenCalledWith("announcements");
      // created_at is the tiebreak that keeps two rows sharing a sort_order in
      // a stable order, so the sequence of these two calls matters.
      expect(builder.order).toHaveBeenNthCalledWith(1, "sort_order", {
        ascending: true,
      });
      expect(builder.order).toHaveBeenNthCalledWith(2, "created_at", {
        ascending: true,
      });
    });

    it("returns inactive announcements as well as active ones", async () => {
      const inactive = {
        ...ANNOUNCEMENT_ROW,
        id: "22222222-2222-4222-8222-222222222222",
        is_active: false,
      };
      const builder = query({ data: [ANNOUNCEMENT_ROW, inactive] });
      supabaseWith(builder);

      const announcements = await listAdminAnnouncements();

      expect(announcements).toHaveLength(2);
      expect(announcements.map((item) => item.is_active)).toEqual([
        true,
        false,
      ]);
      // The public RLS policy hides inactive rows; the admin view exists to
      // show them, so no is_active filter may be applied here.
      expect(builder.eq).not.toHaveBeenCalled();
    });

    it("selects every field the admin view renders", async () => {
      const builder = query({ data: [] });
      supabaseWith(builder);

      await listAdminAnnouncements();

      const selected = String(builder.select.mock.calls[0][0]);
      for (const column of [
        "prefix_text",
        "highlight_text",
        "suffix_text",
        "link_label",
        "link_href",
        "is_active",
        "sort_order",
      ]) {
        expect(selected).toContain(column);
      }
    });

    it("returns an empty list rather than null when there are no rows", async () => {
      supabaseWith(query({ data: null }));

      await expect(listAdminAnnouncements()).resolves.toEqual([]);
    });

    it("reports a failed read without leaking the database error", async () => {
      supabaseWith(query({ error: { message: "connection refused" } }));

      await expect(listAdminAnnouncements()).rejects.toThrow(
        "Announcements could not be loaded.",
      );
    });
  });

  describe("updateAdminAnnouncementSettings", () => {
    it("switches the banner from enabled to disabled", async () => {
      const updated = { ...SETTINGS_ROW, is_enabled: false };
      const builder = query({ data: updated });
      const client = supabaseWith(builder);

      await expect(
        updateAdminAnnouncementSettings({
          isEnabled: false,
          rotationIntervalSeconds: 10,
        }),
      ).resolves.toEqual({ ok: true, settings: updated });

      expect(client.from).toHaveBeenCalledWith("announcement_settings");
      expect(builder.update).toHaveBeenCalledWith({
        is_enabled: false,
        rotation_interval_seconds: 10,
      });
      expect(builder.eq).toHaveBeenCalledWith("id", 1);
    });

    it("switches the banner from disabled to enabled", async () => {
      const updated = {
        ...SETTINGS_ROW,
        is_enabled: true,
        rotation_interval_seconds: 25,
      };
      const builder = query({ data: updated });
      supabaseWith(builder);

      await expect(
        updateAdminAnnouncementSettings({
          isEnabled: true,
          rotationIntervalSeconds: "25",
        }),
      ).resolves.toEqual({ ok: true, settings: updated });

      expect(builder.update).toHaveBeenCalledWith({
        is_enabled: true,
        rotation_interval_seconds: 25,
      });
    });

    it("writes only the two configurable columns", async () => {
      const builder = query({ data: SETTINGS_ROW });
      supabaseWith(builder);

      await updateAdminAnnouncementSettings({
        isEnabled: true,
        rotationIntervalSeconds: 10,
      });

      // id, created_at, and updated_at belong to the primary key and the
      // set_updated_at trigger, never to a submitted form.
      expect(Object.keys(builder.update.mock.calls[0][0])).toEqual([
        "is_enabled",
        "rotation_interval_seconds",
      ]);
    });

    it.each([
      ["below the minimum", 2],
      ["above the maximum", 61],
      ["a decimal", 10.5],
      ["missing", null],
      ["not a number", "soon"],
    ])("refuses %s without touching the database", async (_name, seconds) => {
      const builder = query({ data: SETTINGS_ROW });
      supabaseWith(builder);

      const result = await updateAdminAnnouncementSettings({
        isEnabled: true,
        rotationIntervalSeconds: seconds,
      });

      expect(result.ok).toBe(false);
      expect(builder.update).not.toHaveBeenCalled();
    });

    it("reports a failed write without leaking the database error", async () => {
      supabaseWith(query({ error: { message: 'duplicate key value "x"' } }));
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await updateAdminAnnouncementSettings({
        isEnabled: true,
        rotationIntervalSeconds: 10,
      });

      expect(result).toEqual({
        ok: false,
        error: "Banner settings could not be saved. Try again.",
      });
      // The detail is still recorded server-side for debugging.
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it("reports a missing singleton row instead of creating one", async () => {
      const builder = query({ data: null });
      supabaseWith(builder);

      const result = await updateAdminAnnouncementSettings({
        isEnabled: true,
        rotationIntervalSeconds: 10,
      });

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain(
        "banner settings row is missing",
      );
      // An UPDATE that matched nothing must not become an INSERT: no upsert,
      // and no invented defaults written back.
      expect(builder.upsert).toBeUndefined();
      expect(builder.insert).not.toHaveBeenCalled();
    });
  });
});

describe("admin announcement item management", () => {
  const ANNOUNCEMENT_ID = ANNOUNCEMENT_ROW.id;
  const CONTENT = {
    prefixText: "Use code",
    highlightText: "HAPPY2026",
    suffixText: "for up to 60% off selected products",
    linkLabel: "Shop Now",
    linkHref: "/shop",
    isActive: true,
  };

  beforeEach(() => {
    mocks.getAdminUser.mockReset();
    mocks.createSupabase.mockReset();
    mocks.getAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
  });

  describe("authorization", () => {
    it.each([
      ["getAdminAnnouncement", () => getAdminAnnouncement(ANNOUNCEMENT_ID)],
      ["createAdminAnnouncement", () => createAdminAnnouncement(CONTENT)],
      [
        "updateAdminAnnouncement",
        () => updateAdminAnnouncement(ANNOUNCEMENT_ID, CONTENT),
      ],
      [
        "setAdminAnnouncementActive",
        () => setAdminAnnouncementActive(ANNOUNCEMENT_ID, false),
      ],
      [
        "deleteAdminAnnouncement",
        () => deleteAdminAnnouncement(ANNOUNCEMENT_ID),
      ],
    ])("refuses %s without an approved session", async (_name, call) => {
      mocks.getAdminUser.mockResolvedValue(null);

      await expect(call()).rejects.toThrow(
        "Admin announcement data requested without an approved session.",
      );
      // The guard runs before the reference check, before validation, and
      // before the service-role client exists.
      expect(mocks.createSupabase).not.toHaveBeenCalled();
    });
  });

  describe("getAdminAnnouncement", () => {
    it("reads one announcement by id", async () => {
      const builder = query({ data: ANNOUNCEMENT_ROW });
      const client = supabaseWith(builder);

      await expect(getAdminAnnouncement(ANNOUNCEMENT_ID)).resolves.toEqual(
        ANNOUNCEMENT_ROW,
      );

      expect(client.from).toHaveBeenCalledWith("announcements");
      expect(builder.eq).toHaveBeenCalledWith("id", ANNOUNCEMENT_ID);
    });

    it("returns null for an unknown id", async () => {
      supabaseWith(query({ data: null }));

      await expect(getAdminAnnouncement(ANNOUNCEMENT_ID)).resolves.toBeNull();
    });

    it("returns null for a malformed reference without querying", async () => {
      const builder = query({ data: ANNOUNCEMENT_ROW });
      supabaseWith(builder);

      await expect(getAdminAnnouncement("not-a-uuid")).resolves.toBeNull();
      expect(builder.select).not.toHaveBeenCalled();
    });
  });

  describe("createAdminAnnouncement", () => {
    it("appends after the current highest position", async () => {
      const lastQuery = query({ data: { sort_order: 4 } });
      const insertQuery = query({
        data: { ...ANNOUNCEMENT_ROW, sort_order: 5 },
      });
      supabaseWith(lastQuery, insertQuery);

      const result = await createAdminAnnouncement(CONTENT);

      expect(result.ok).toBe(true);
      expect(lastQuery.order).toHaveBeenCalledWith("sort_order", {
        ascending: false,
      });
      expect(insertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({ sort_order: 5 }),
      );
    });

    it("starts the first announcement at position 0", async () => {
      const lastQuery = query({ data: null });
      const insertQuery = query({ data: ANNOUNCEMENT_ROW });
      supabaseWith(lastQuery, insertQuery);

      await createAdminAnnouncement(CONTENT);

      expect(insertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({ sort_order: 0 }),
      );
    });

    it("never lets a submitted sort_order through", async () => {
      const lastQuery = query({ data: { sort_order: 2 } });
      const insertQuery = query({ data: ANNOUNCEMENT_ROW });
      supabaseWith(lastQuery, insertQuery);

      await createAdminAnnouncement({
        ...CONTENT,
        // A crafted request trying to choose its own position.
        ...({ sortOrder: 99, sort_order: 99 } as object),
      });

      expect(insertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({ sort_order: 3 }),
      );
    });

    it("writes normalised content, with empty optional fields as null", async () => {
      const lastQuery = query({ data: null });
      const insertQuery = query({ data: ANNOUNCEMENT_ROW });
      supabaseWith(lastQuery, insertQuery);

      await createAdminAnnouncement({
        prefixText: "  Just this  ",
        highlightText: "",
        suffixText: "   ",
        linkLabel: "",
        linkHref: "",
        isActive: false,
      });

      expect(insertQuery.insert).toHaveBeenCalledWith({
        prefix_text: "Just this",
        highlight_text: null,
        suffix_text: null,
        link_label: null,
        link_href: null,
        is_active: false,
        sort_order: 0,
      });
    });

    it("refuses invalid content without querying at all", async () => {
      const lastQuery = query({ data: null });
      const insertQuery = query({ data: ANNOUNCEMENT_ROW });
      supabaseWith(lastQuery, insertQuery);

      const result = await createAdminAnnouncement({
        ...CONTENT,
        prefixText: "",
        highlightText: "",
        suffixText: "",
      });

      expect(result.ok).toBe(false);
      expect(lastQuery.select).not.toHaveBeenCalled();
      expect(insertQuery.insert).not.toHaveBeenCalled();
    });

    it("refuses an unsafe link path", async () => {
      supabaseWith(query({ data: null }), query({ data: ANNOUNCEMENT_ROW }));

      const result = await createAdminAnnouncement({
        ...CONTENT,
        linkHref: "//evil.example",
      });

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain("stay on this site");
    });

    it("reports a failed insert without leaking the database error", async () => {
      supabaseWith(
        query({ data: null }),
        query({ error: { message: 'null value in column "x"' } }),
      );
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await createAdminAnnouncement(CONTENT);

      expect(result).toEqual({
        ok: false,
        error: "Announcement could not be created. Try again.",
      });
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it("reports a failed position lookup rather than guessing a position", async () => {
      const lastQuery = query({ error: { message: "connection refused" } });
      const insertQuery = query({ data: ANNOUNCEMENT_ROW });
      supabaseWith(lastQuery, insertQuery);
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await createAdminAnnouncement(CONTENT);

      expect(result.ok).toBe(false);
      expect(insertQuery.insert).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe("updateAdminAnnouncement", () => {
    it("rewrites content and the active flag", async () => {
      const builder = query({ data: ANNOUNCEMENT_ROW });
      supabaseWith(builder);

      const result = await updateAdminAnnouncement(ANNOUNCEMENT_ID, CONTENT);

      expect(result).toEqual({ ok: true, announcement: ANNOUNCEMENT_ROW });
      expect(builder.eq).toHaveBeenCalledWith("id", ANNOUNCEMENT_ID);
      expect(builder.update).toHaveBeenCalledWith({
        prefix_text: "Use code",
        highlight_text: "HAPPY2026",
        suffix_text: "for up to 60% off selected products",
        link_label: "Shop Now",
        link_href: "/shop",
        is_active: true,
      });
    });

    it("never moves an announcement while saving an edit", async () => {
      const builder = query({ data: ANNOUNCEMENT_ROW });
      supabaseWith(builder);

      await updateAdminAnnouncement(ANNOUNCEMENT_ID, CONTENT);

      // Reordering belongs to a later phase; an edit must not change position.
      expect(
        Object.keys(builder.update.mock.calls[0][0]),
      ).not.toContain("sort_order");
    });

    it("refuses a malformed reference without querying", async () => {
      const builder = query({ data: ANNOUNCEMENT_ROW });
      supabaseWith(builder);

      const result = await updateAdminAnnouncement("not-a-uuid", CONTENT);

      expect(result.ok).toBe(false);
      expect(builder.update).not.toHaveBeenCalled();
    });

    it("refuses invalid content without querying", async () => {
      const builder = query({ data: ANNOUNCEMENT_ROW });
      supabaseWith(builder);

      const result = await updateAdminAnnouncement(ANNOUNCEMENT_ID, {
        ...CONTENT,
        linkLabel: "",
      });

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain(
        "both a label and a path",
      );
      expect(builder.update).not.toHaveBeenCalled();
    });

    it("reports a vanished announcement instead of recreating it", async () => {
      const builder = query({ data: null });
      supabaseWith(builder);

      const result = await updateAdminAnnouncement(ANNOUNCEMENT_ID, CONTENT);

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain(
        "no longer exists",
      );
      expect(builder.insert).not.toHaveBeenCalled();
    });

    it("reports a failed update without leaking the database error", async () => {
      supabaseWith(query({ error: { message: 'value too long for type' } }));
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await updateAdminAnnouncement(ANNOUNCEMENT_ID, CONTENT);

      expect(result).toEqual({
        ok: false,
        error: "Announcement could not be saved. Try again.",
      });
      consoleError.mockRestore();
    });
  });

  describe("setAdminAnnouncementActive", () => {
    it.each([
      ["activates", true],
      ["deactivates", false],
    ])("%s one announcement", async (_name, isActive) => {
      const builder = query({
        data: { ...ANNOUNCEMENT_ROW, is_active: isActive },
      });
      supabaseWith(builder);

      const result = await setAdminAnnouncementActive(
        ANNOUNCEMENT_ID,
        isActive,
      );

      expect(result.ok).toBe(true);
      expect(builder.update).toHaveBeenCalledWith({ is_active: isActive });
      expect(builder.eq).toHaveBeenCalledWith("id", ANNOUNCEMENT_ID);
    });

    it("touches nothing but the active flag", async () => {
      const builder = query({ data: ANNOUNCEMENT_ROW });
      supabaseWith(builder);

      await setAdminAnnouncementActive(ANNOUNCEMENT_ID, false);

      // The list toggle never loaded the text, so it must not rewrite it.
      expect(Object.keys(builder.update.mock.calls[0][0])).toEqual([
        "is_active",
      ]);
    });

    it("refuses a malformed reference without querying", async () => {
      const builder = query({ data: ANNOUNCEMENT_ROW });
      supabaseWith(builder);

      const result = await setAdminAnnouncementActive("not-a-uuid", true);

      expect(result.ok).toBe(false);
      expect(builder.update).not.toHaveBeenCalled();
    });

    it("reports a vanished announcement", async () => {
      supabaseWith(query({ data: null }));

      const result = await setAdminAnnouncementActive(ANNOUNCEMENT_ID, true);

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain("no longer exists");
    });

    it("reports a failed update without leaking the database error", async () => {
      supabaseWith(query({ error: { message: "deadlock detected" } }));
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await setAdminAnnouncementActive(ANNOUNCEMENT_ID, true);

      expect(result).toEqual({
        ok: false,
        error: "Announcement status could not be changed. Try again.",
      });
      expect(result.ok === false && result.error).not.toContain("deadlock");
      consoleError.mockRestore();
    });
  });

  describe("deleteAdminAnnouncement", () => {
    it("deletes the identified announcement", async () => {
      const builder = query({ data: { id: ANNOUNCEMENT_ID } });
      const client = supabaseWith(builder);

      const result = await deleteAdminAnnouncement(ANNOUNCEMENT_ID);

      expect(result).toEqual({ ok: true, announcementId: ANNOUNCEMENT_ID });
      expect(client.from).toHaveBeenCalledWith("announcements");
      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith("id", ANNOUNCEMENT_ID);
    });

    it("refuses a malformed reference without deleting anything", async () => {
      const builder = query({ data: { id: ANNOUNCEMENT_ID } });
      supabaseWith(builder);

      const result = await deleteAdminAnnouncement("not-a-uuid");

      expect(result.ok).toBe(false);
      // A bad reference must never reach an unfiltered delete.
      expect(builder.delete).not.toHaveBeenCalled();
    });

    it("reports an already-deleted announcement", async () => {
      supabaseWith(query({ data: null }));

      const result = await deleteAdminAnnouncement(ANNOUNCEMENT_ID);

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain("no longer exists");
    });

    it("reports a failed delete without leaking the database error", async () => {
      supabaseWith(query({ error: { message: "permission denied" } }));
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await deleteAdminAnnouncement(ANNOUNCEMENT_ID);

      expect(result).toEqual({
        ok: false,
        error: "Announcement could not be deleted. Try again.",
      });
      expect(result.ok === false && result.error).not.toContain("permission");
      consoleError.mockRestore();
    });
  });
});

describe("moveAdminAnnouncement", () => {
  const FIRST = { ...ANNOUNCEMENT_ROW, id: "aaaaaaaa-1111-4111-8111-111111111111", sort_order: 0 };
  const MIDDLE = { ...ANNOUNCEMENT_ROW, id: "bbbbbbbb-2222-4222-8222-222222222222", sort_order: 1 };
  const LAST = { ...ANNOUNCEMENT_ROW, id: "cccccccc-3333-4333-8333-333333333333", sort_order: 2 };

  beforeEach(() => {
    mocks.getAdminUser.mockReset();
    mocks.createSupabase.mockReset();
    mocks.getAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
  });

  it("refuses without an approved session, before validating anything", async () => {
    mocks.getAdminUser.mockResolvedValue(null);

    await expect(
      moveAdminAnnouncement(MIDDLE.id, "up"),
    ).rejects.toThrow(
      "Admin announcement data requested without an approved session.",
    );
    expect(mocks.createSupabase).not.toHaveBeenCalled();
  });

  it("moves an announcement up by swapping the two positions", async () => {
    const listQuery = query({ data: [FIRST, MIDDLE, LAST] });
    const movingUpdate = query({ data: { id: MIDDLE.id } });
    const neighbourUpdate = query({ data: { id: FIRST.id } });
    supabaseWith(listQuery, movingUpdate, neighbourUpdate);

    const result = await moveAdminAnnouncement(MIDDLE.id, "up");

    expect(result.ok).toBe(true);
    expect(result.ok === true && result.moved).toBe(true);
    // The mover takes its neighbour's position and vice versa.
    expect(movingUpdate.update).toHaveBeenCalledWith({ sort_order: 0 });
    expect(movingUpdate.eq).toHaveBeenCalledWith("id", MIDDLE.id);
    expect(neighbourUpdate.update).toHaveBeenCalledWith({ sort_order: 1 });
    expect(neighbourUpdate.eq).toHaveBeenCalledWith("id", FIRST.id);
    expect(
      result.ok === true && result.announcements.map((item) => item.id),
    ).toEqual([MIDDLE.id, FIRST.id, LAST.id]);
  });

  it("moves an announcement down by swapping the two positions", async () => {
    const listQuery = query({ data: [FIRST, MIDDLE, LAST] });
    supabaseWith(
      listQuery,
      query({ data: { id: MIDDLE.id } }),
      query({ data: { id: LAST.id } }),
    );

    const result = await moveAdminAnnouncement(MIDDLE.id, "down");

    expect(
      result.ok === true && result.announcements.map((item) => item.id),
    ).toEqual([FIRST.id, LAST.id, MIDDLE.id]);
  });

  it("moves across gaps without renumbering the rest", async () => {
    const sparseFirst = { ...FIRST, sort_order: 0 };
    const sparseSecond = { ...MIDDLE, sort_order: 5 };
    const sparseThird = { ...LAST, sort_order: 40 };
    const listQuery = query({ data: [sparseFirst, sparseSecond, sparseThird] });
    const movingUpdate = query({ data: { id: sparseSecond.id } });
    const neighbourUpdate = query({ data: { id: sparseFirst.id } });
    supabaseWith(listQuery, movingUpdate, neighbourUpdate);

    const result = await moveAdminAnnouncement(sparseSecond.id, "up");

    // Only the two values are exchanged; 40 is left alone and the gap stays.
    expect(movingUpdate.update).toHaveBeenCalledWith({ sort_order: 0 });
    expect(neighbourUpdate.update).toHaveBeenCalledWith({ sort_order: 5 });
    expect(
      result.ok === true && result.announcements.map((item) => item.sort_order),
    ).toEqual([0, 5, 40]);
  });

  it("updates exactly two rows and touches no other column", async () => {
    const listQuery = query({ data: [FIRST, MIDDLE, LAST] });
    const movingUpdate = query({ data: { id: MIDDLE.id } });
    const neighbourUpdate = query({ data: { id: FIRST.id } });
    const client = supabaseWith(listQuery, movingUpdate, neighbourUpdate);

    await moveAdminAnnouncement(MIDDLE.id, "up");

    // One read plus exactly two writes.
    expect(client.from).toHaveBeenCalledTimes(3);
    for (const update of [movingUpdate, neighbourUpdate]) {
      expect(update.update).toHaveBeenCalledTimes(1);
      expect(Object.keys(update.update.mock.calls[0][0])).toEqual([
        "sort_order",
      ]);
    }
  });

  it("does nothing when the first item is moved up", async () => {
    const listQuery = query({ data: [FIRST, MIDDLE, LAST] });
    const unusedUpdate = query({ data: { id: FIRST.id } });
    supabaseWith(listQuery, unusedUpdate);

    const result = await moveAdminAnnouncement(FIRST.id, "up");

    expect(result.ok).toBe(true);
    expect(result.ok === true && result.moved).toBe(false);
    expect(unusedUpdate.update).not.toHaveBeenCalled();
    expect(
      result.ok === true && result.announcements.map((item) => item.id),
    ).toEqual([FIRST.id, MIDDLE.id, LAST.id]);
  });

  it("does nothing when the last item is moved down", async () => {
    const listQuery = query({ data: [FIRST, MIDDLE, LAST] });
    const unusedUpdate = query({ data: { id: LAST.id } });
    supabaseWith(listQuery, unusedUpdate);

    const result = await moveAdminAnnouncement(LAST.id, "down");

    expect(result.ok === true && result.moved).toBe(false);
    expect(unusedUpdate.update).not.toHaveBeenCalled();
  });

  it("does nothing in either direction for a single-item list", async () => {
    for (const direction of ["up", "down"] as const) {
      const listQuery = query({ data: [FIRST] });
      const unusedUpdate = query({ data: { id: FIRST.id } });
      supabaseWith(listQuery, unusedUpdate);

      const result = await moveAdminAnnouncement(FIRST.id, direction);

      expect(result.ok === true && result.moved).toBe(false);
      expect(unusedUpdate.update).not.toHaveBeenCalled();
    }
  });

  it("keeps inactive announcements in the same ordered list", async () => {
    const inactiveMiddle = { ...MIDDLE, is_active: false };
    const listQuery = query({ data: [FIRST, inactiveMiddle, LAST] });
    const movingUpdate = query({ data: { id: LAST.id } });
    const neighbourUpdate = query({ data: { id: inactiveMiddle.id } });
    supabaseWith(listQuery, movingUpdate, neighbourUpdate);

    const result = await moveAdminAnnouncement(LAST.id, "up");

    // The inactive row is a real position, not skipped over.
    expect(
      result.ok === true && result.announcements.map((item) => item.id),
    ).toEqual([FIRST.id, LAST.id, inactiveMiddle.id]);
  });

  it("reports an unknown announcement id", async () => {
    const listQuery = query({ data: [FIRST, MIDDLE, LAST] });
    const unusedUpdate = query({ data: { id: FIRST.id } });
    supabaseWith(listQuery, unusedUpdate);

    const result = await moveAdminAnnouncement(
      "dddddddd-4444-4444-8444-444444444444",
      "up",
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("no longer exists");
    expect(unusedUpdate.update).not.toHaveBeenCalled();
  });

  it("refuses a malformed reference without reading anything", async () => {
    const listQuery = query({ data: [FIRST, MIDDLE, LAST] });
    supabaseWith(listQuery);

    const result = await moveAdminAnnouncement("not-a-uuid", "up");

    expect(result.ok).toBe(false);
    expect(listQuery.select).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown direction", "sideways"],
    ["the wrong case", "UP"],
    ["a padded value", " up "],
    ["an empty string", ""],
    ["a missing value", null],
    ["a number", 1],
  ])("refuses %s without reading anything", async (_name, direction) => {
    const listQuery = query({ data: [FIRST, MIDDLE, LAST] });
    supabaseWith(listQuery);

    const result = await moveAdminAnnouncement(MIDDLE.id, direction);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain(
      "move direction is not recognised",
    );
    expect(listQuery.select).not.toHaveBeenCalled();
  });

  it("reads positions from the database rather than any caller-supplied value", async () => {
    const listQuery = query({ data: [FIRST, MIDDLE, LAST] });
    const movingUpdate = query({ data: { id: MIDDLE.id } });
    const neighbourUpdate = query({ data: { id: FIRST.id } });
    supabaseWith(listQuery, movingUpdate, neighbourUpdate);

    await moveAdminAnnouncement(MIDDLE.id, "up");

    // The ordering used to decide the move is the stored one.
    expect(listQuery.order).toHaveBeenNthCalledWith(1, "sort_order", {
      ascending: true,
    });
    expect(listQuery.order).toHaveBeenNthCalledWith(2, "created_at", {
      ascending: true,
    });
    // Written values come only from the loaded rows.
    expect(movingUpdate.update).toHaveBeenCalledWith({
      sort_order: FIRST.sort_order,
    });
    expect(neighbourUpdate.update).toHaveBeenCalledWith({
      sort_order: MIDDLE.sort_order,
    });
  });

  it("refuses rather than silently doing nothing when two rows share a position", async () => {
    const tiedFirst = { ...FIRST, sort_order: 3 };
    const tiedSecond = { ...MIDDLE, sort_order: 3 };
    const listQuery = query({ data: [tiedFirst, tiedSecond] });
    const unusedUpdate = query({ data: { id: tiedSecond.id } });
    supabaseWith(listQuery, unusedUpdate);

    const result = await moveAdminAnnouncement(tiedSecond.id, "up");

    // Swapping equal values changes nothing, and created_at breaks the tie, so
    // reporting success here would claim a move that never happened.
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("share the same position");
    expect(unusedUpdate.update).not.toHaveBeenCalled();
  });

  it("reports a failed read without leaking the database error", async () => {
    supabaseWith(query({ error: { message: "connection refused" } }));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await moveAdminAnnouncement(MIDDLE.id, "up");

    expect(result).toEqual({
      ok: false,
      error: "Announcement could not be moved. Try again.",
    });
    expect(result.ok === false && result.error).not.toContain("connection");
    consoleError.mockRestore();
  });

  it("restores the first position when the second write fails", async () => {
    const listQuery = query({ data: [FIRST, MIDDLE, LAST] });
    const movingUpdate = query({ data: { id: MIDDLE.id } });
    const neighbourUpdate = query({ error: { message: "deadlock detected" } });
    const rollbackUpdate = query({ data: { id: MIDDLE.id } });
    supabaseWith(listQuery, movingUpdate, neighbourUpdate, rollbackUpdate);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await moveAdminAnnouncement(MIDDLE.id, "up");

    expect(result.ok).toBe(false);
    // Without a transaction the first write already landed; leaving it would
    // put both rows on the same position and block any further move.
    expect(rollbackUpdate.update).toHaveBeenCalledWith({
      sort_order: MIDDLE.sort_order,
    });
    expect(rollbackUpdate.eq).toHaveBeenCalledWith("id", MIDDLE.id);
    consoleError.mockRestore();
  });
});
