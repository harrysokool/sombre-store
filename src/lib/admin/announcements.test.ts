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
  getAdminAnnouncementSettings,
  listAdminAnnouncements,
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

  // Deliberately no insert or upsert: the settings write must be an UPDATE
  // only, and a test asserts these stay absent.
  for (const method of ["select", "eq", "order", "update"]) {
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
      expect(builder.insert).toBeUndefined();
    });
  });
});
