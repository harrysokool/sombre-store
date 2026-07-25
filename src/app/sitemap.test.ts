import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabase: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabase,
}));

import { resetSiteUrlWarningForTests } from "@/lib/seo/site-url";

import sitemap from "./sitemap";

const ORIGIN = "https://sombre.example";

type ProductRow = { slug: string; updated_at: string | null };

/**
 * Stands in for the Supabase query builder, capturing the filters applied so
 * the active-only rule can be asserted rather than assumed.
 */
function supabaseReturning(
  result: { data?: ProductRow[]; error?: unknown } = {},
) {
  const filters: Record<string, unknown> = {};
  const builder: Record<string, unknown> = {};

  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn((column: string, value: unknown) => {
    filters[column] = value;
    return builder;
  });
  builder.order = vi.fn(() => builder);
  builder.returns = vi.fn(async () => ({
    data: result.data ?? null,
    error: result.error ?? null,
  }));

  const client = { from: vi.fn(() => builder) };
  mocks.createSupabase.mockReturnValue(client);

  return { client, builder, filters };
}

function urls(entries: Awaited<ReturnType<typeof sitemap>>) {
  return entries.map((entry) => entry.url);
}

describe("sitemap.xml", () => {
  const originalSiteUrl = process.env.SITE_URL;

  beforeEach(() => {
    process.env.SITE_URL = ORIGIN;
    resetSiteUrlWarningForTests();
    mocks.createSupabase.mockReset();
    supabaseReturning({ data: [] });
  });

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.SITE_URL;
    } else {
      process.env.SITE_URL = originalSiteUrl;
    }
    resetSiteUrlWarningForTests();
    vi.restoreAllMocks();
  });

  it("contains every public route", async () => {
    const entries = urls(await sitemap());

    expect(entries).toEqual(
      expect.arrayContaining([
        `${ORIGIN}/`,
        `${ORIGIN}/shop`,
        `${ORIGIN}/brands`,
        `${ORIGIN}/about`,
        `${ORIGIN}/contact`,
        `${ORIGIN}/shipping-policy`,
        `${ORIGIN}/refund-policy`,
        `${ORIGIN}/privacy-policy`,
        `${ORIGIN}/terms`,
      ]),
    );
  });

  it("contains active product pages generated from server data", async () => {
    supabaseReturning({
      data: [
        { slug: "replica-jazz-club", updated_at: "2026-07-01T00:00:00.000Z" },
        { slug: "replica-by-the-fireplace", updated_at: null },
      ],
    });

    const entries = urls(await sitemap());

    expect(entries).toContain(`${ORIGIN}/products/replica-jazz-club`);
    expect(entries).toContain(`${ORIGIN}/products/replica-by-the-fireplace`);
  });

  it("asks the database for active products only, so inactive ones are excluded", async () => {
    const { client, filters } = supabaseReturning({
      data: [{ slug: "active-one", updated_at: null }],
    });

    const entries = urls(await sitemap());

    expect(client.from).toHaveBeenCalledWith("products");
    // The exclusion is enforced in the query, matching the product page, which
    // 404s for anything not active.
    expect(filters.is_active).toBe(true);
    expect(entries).toContain(`${ORIGIN}/products/active-one`);
  });

  it.each([
    ["the cart", "/cart"],
    ["checkout", "/checkout"],
    ["checkout success", "/checkout/success"],
    ["checkout cancel", "/checkout/cancel"],
    ["the removed public login", "/login"],
    ["admin sign in", "/admin/login"],
    ["the admin dashboard", "/admin"],
  ])("excludes %s", async (_label, path) => {
    const entries = urls(await sitemap());

    expect(entries).not.toContain(`${ORIGIN}${path}`);
  });

  it("excludes every filtered query-string URL", async () => {
    const entries = urls(await sitemap());

    // The canonical policy collapses these onto /shop, so advertising them
    // here would work against it.
    expect(entries.every((url) => !url.includes("?"))).toBe(true);
  });

  it("sets lastModified only when the stored value is a real date", async () => {
    supabaseReturning({
      data: [
        { slug: "with-date", updated_at: "2026-07-01T00:00:00.000Z" },
        { slug: "no-date", updated_at: null },
        { slug: "bad-date", updated_at: "not a date" },
      ],
    });

    const entries = await sitemap();
    const entryFor = (slug: string) =>
      entries.find((entry) => entry.url.endsWith(`/products/${slug}`))!;

    expect(entryFor("with-date").lastModified).toEqual(
      new Date("2026-07-01T00:00:00.000Z"),
    );
    expect(entryFor("no-date").lastModified).toBeUndefined();
    expect(entryFor("bad-date").lastModified).toBeUndefined();
  });

  it("skips a product whose slug is blank", async () => {
    supabaseReturning({
      data: [
        { slug: "  ", updated_at: null },
        { slug: "real-product", updated_at: null },
      ],
    });

    const entries = urls(await sitemap());

    expect(entries).toContain(`${ORIGIN}/products/real-product`);
    expect(entries.some((url) => url.endsWith("/products/"))).toBe(false);
  });

  it("still returns the static routes when the product query fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    supabaseReturning({ error: { message: "connection refused" } });

    // The route must not throw: a broken sitemap would show a crawler an
    // internal error page and risk the whole sitemap being dropped.
    const entries = urls(await sitemap());

    expect(entries).toContain(`${ORIGIN}/`);
    expect(entries).toContain(`${ORIGIN}/shop`);
    expect(entries.some((url) => url.includes("/products/"))).toBe(false);

    consoleError.mockRestore();
  });

  it("does not leak the internal error into the sitemap output", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    supabaseReturning({
      error: { message: "permission denied for relation products" },
    });

    const serialized = JSON.stringify(await sitemap());

    expect(serialized).not.toContain("permission denied");

    consoleError.mockRestore();
  });
});
