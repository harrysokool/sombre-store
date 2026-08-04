import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
  unstable_cache: vi.fn(),
}));

vi.mock("server-only", () => ({}));

// Capture what the module hands to unstable_cache, then run the wrapped
// function directly so the read itself can be asserted.
vi.mock("next/cache", () => ({
  unstable_cache: (
    fn: (...args: unknown[]) => unknown,
    keys: string[],
    options: Record<string, unknown>,
  ) => {
    mocks.unstable_cache(fn, keys, options);
    return fn;
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: mocks.createSupabaseServiceRoleClient,
}));

import {
  ANNOUNCEMENTS_CACHE_TAG,
  ANNOUNCEMENTS_CACHE_TTL_SECONDS,
} from "./announcement-cache-tag";
import { getStorefrontAnnouncementBanner } from "./announcements";

type QueryResult = { data?: unknown; error?: unknown };

function query(result: QueryResult = {}) {
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
  };
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  for (const method of ["select", "eq", "order"]) {
    builder[method] = vi.fn(() => builder);
  }

  builder.returns = vi.fn(async () => resolved);
  builder.maybeSingle = vi.fn(async () => resolved);

  return builder;
}

function supabaseWith(
  settingsQuery: ReturnType<typeof query>,
  announcementsQuery: ReturnType<typeof query>,
) {
  const client = { from: vi.fn() };

  client.from.mockImplementation((table: string) =>
    table === "announcement_settings" ? settingsQuery : announcementsQuery,
  );

  mocks.createSupabaseServerClient.mockReturnValue(client);
  return client;
}

const SETTINGS = { is_enabled: true, rotation_interval_seconds: 10 };

const ANNOUNCEMENT = {
  id: "11111111-1111-4111-8111-111111111111",
  prefix_text: "Use code",
  highlight_text: "HAPPY2026",
  suffix_text: "for up to 60% off selected products",
  link_label: "Shop Now",
  link_href: "/shop",
};

describe("storefront announcement cache wiring", () => {
  it("caches under a stable key, the shared tag, and a TTL backstop", () => {
    const [, keys, options] = mocks.unstable_cache.mock.calls[0];

    expect(keys).toEqual(["storefront-announcement-banner"]);
    expect(options).toMatchObject({
      tags: [ANNOUNCEMENTS_CACHE_TAG],
      revalidate: ANNOUNCEMENTS_CACHE_TTL_SECONDS,
    });
    // Caching is what keeps pages with no other data dependency prerendered.
    expect(ANNOUNCEMENTS_CACHE_TTL_SECONDS).toBeGreaterThan(0);
  });
});

describe("getStorefrontAnnouncementBanner", () => {
  beforeEach(() => {
    mocks.createSupabaseServerClient.mockReset();
    mocks.createSupabaseServiceRoleClient.mockReset();
  });

  describe("client and privileges", () => {
    it("reads with the public anonymous client", async () => {
      supabaseWith(
        query({ data: SETTINGS }),
        query({ data: [ANNOUNCEMENT] }),
      );

      await getStorefrontAnnouncementBanner();

      expect(mocks.createSupabaseServerClient).toHaveBeenCalled();
    });

    it("never uses the service-role client", async () => {
      supabaseWith(
        query({ data: SETTINGS }),
        query({ data: [ANNOUNCEMENT] }),
      );

      await getStorefrontAnnouncementBanner();

      // The service role bypasses RLS and belongs to admin code only.
      expect(mocks.createSupabaseServiceRoleClient).not.toHaveBeenCalled();
    });

    it("depends on no cookies or authenticated session", async () => {
      supabaseWith(
        query({ data: SETTINGS }),
        query({ data: [ANNOUNCEMENT] }),
      );

      await getStorefrontAnnouncementBanner();

      // The client factory is called with no arguments at all: nothing from a
      // request reaches it, which is what makes the result safe to cache
      // globally and share between visitors.
      expect(mocks.createSupabaseServerClient).toHaveBeenCalledWith();
    });
  });

  describe("query shape", () => {
    it("filters to active announcements and orders them for display", async () => {
      const settingsQuery = query({ data: SETTINGS });
      const announcementsQuery = query({ data: [ANNOUNCEMENT] });
      const client = supabaseWith(settingsQuery, announcementsQuery);

      await getStorefrontAnnouncementBanner();

      expect(client.from).toHaveBeenCalledWith("announcements");
      expect(announcementsQuery.eq).toHaveBeenCalledWith("is_active", true);
      expect(announcementsQuery.order).toHaveBeenNthCalledWith(
        1,
        "sort_order",
        { ascending: true },
      );
      expect(announcementsQuery.order).toHaveBeenNthCalledWith(
        2,
        "created_at",
        { ascending: true },
      );
    });

    it("reads the settings singleton by its pinned id", async () => {
      const settingsQuery = query({ data: SETTINGS });
      const client = supabaseWith(settingsQuery, query({ data: [] }));

      await getStorefrontAnnouncementBanner();

      expect(client.from).toHaveBeenCalledWith("announcement_settings");
      expect(settingsQuery.eq).toHaveBeenCalledWith("id", 1);
    });

    it("selects no private column", async () => {
      const announcementsQuery = query({ data: [ANNOUNCEMENT] });
      supabaseWith(query({ data: SETTINGS }), announcementsQuery);

      await getStorefrontAnnouncementBanner();

      const selected = String(announcementsQuery.select.mock.calls[0][0]);
      expect(selected).toContain("prefix_text");
      expect(selected).toContain("link_href");
      // The storefront has no use for these and should not ship them.
      expect(selected).not.toContain("updated_at");
    });
  });

  describe("results", () => {
    it("returns the enabled banner with its active announcements", async () => {
      supabaseWith(
        query({ data: SETTINGS }),
        query({ data: [ANNOUNCEMENT] }),
      );

      await expect(getStorefrontAnnouncementBanner()).resolves.toEqual({
        isEnabled: true,
        rotationIntervalSeconds: 10,
        announcements: [ANNOUNCEMENT],
      });
    });

    it("reports a disabled banner", async () => {
      supabaseWith(
        query({ data: { ...SETTINGS, is_enabled: false } }),
        query({ data: [ANNOUNCEMENT] }),
      );

      const banner = await getStorefrontAnnouncementBanner();

      expect(banner.isEnabled).toBe(false);
    });

    it("treats a missing settings row as disabled rather than guessing it on", async () => {
      supabaseWith(query({ data: null }), query({ data: [ANNOUNCEMENT] }));

      const banner = await getStorefrontAnnouncementBanner();

      expect(banner.isEnabled).toBe(false);
      expect(banner.rotationIntervalSeconds).toBeNull();
    });

    it("returns an empty list when nothing is active", async () => {
      supabaseWith(query({ data: SETTINGS }), query({ data: [] }));

      const banner = await getStorefrontAnnouncementBanner();

      expect(banner.isEnabled).toBe(true);
      expect(banner.announcements).toEqual([]);
    });

    it("returns an empty list rather than null when the query yields nothing", async () => {
      supabaseWith(query({ data: SETTINGS }), query({ data: null }));

      await expect(
        getStorefrontAnnouncementBanner(),
      ).resolves.toMatchObject({ announcements: [] });
    });
  });

  describe("failure", () => {
    it("throws when the settings read fails, so the outage is not cached", async () => {
      supabaseWith(
        query({ error: { message: "connection refused" } }),
        query({ data: [ANNOUNCEMENT] }),
      );

      // Returning an empty banner here would cache a transient failure as
      // valid "no announcements" data for the whole TTL.
      await expect(getStorefrontAnnouncementBanner()).rejects.toThrow(
        "Announcement settings could not be read.",
      );
    });

    it("throws when the announcements read fails", async () => {
      supabaseWith(
        query({ data: SETTINGS }),
        query({ error: { message: "connection refused" } }),
      );

      await expect(getStorefrontAnnouncementBanner()).rejects.toThrow(
        "Announcements could not be read.",
      );
    });

    it("does not leak the database error text", async () => {
      supabaseWith(
        query({ data: SETTINGS }),
        query({ error: { message: 'permission denied for table "x"' } }),
      );

      await expect(getStorefrontAnnouncementBanner()).rejects.not.toThrow(
        /permission denied/,
      );
    });
  });
});
