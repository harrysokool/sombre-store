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
  loadAllPromotionDiscounts,
  loadPromotionDiscounts,
} from "./promotion-discounts";
import {
  PROMOTION_CACHE_TAG,
  PROMOTION_CACHE_TTL_SECONDS,
  PROMOTION_COUPON_CODE,
} from "./promotion";

const PRODUCT_A = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B = "22222222-2222-4222-8222-222222222222";
const PRODUCT_C = "33333333-3333-4333-8333-333333333333";

const NOW = new Date("2026-08-05T12:00:00.000Z");

type CouponOverrides = {
  is_active?: boolean;
  starts_at?: string | null;
  expires_at?: string | null;
  code_normalized?: string;
  discount_code_products?:
    | { product_id: string; discount_percent: string | number }[]
    | null;
};

function couponRow(overrides: CouponOverrides = {}) {
  return {
    id: "99999999-9999-4999-8999-999999999999",
    code_normalized: PROMOTION_COUPON_CODE,
    is_active: true,
    starts_at: null,
    expires_at: null,
    discount_code_products: [
      { product_id: PRODUCT_A, discount_percent: "36.00" },
    ],
    ...overrides,
  };
}

function supabaseWith(result: { data?: unknown; error?: unknown } = {}) {
  const resolved = {
    data: result.data === undefined ? couponRow() : result.data,
    error: result.error ?? null,
  };
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  for (const method of ["select", "eq"]) {
    builder[method] = vi.fn(() => builder);
  }

  builder.maybeSingle = vi.fn(async () => resolved);

  const client = { from: vi.fn(() => builder) };
  mocks.createSupabaseServiceRoleClient.mockReturnValue(client);

  return { client, builder };
}

describe("storefront promotion cache wiring", () => {
  it("caches under a stable key, the shared tag, and a TTL backstop", () => {
    const [, keys, options] = mocks.unstable_cache.mock.calls[0];

    expect(keys).toEqual(["storefront-promotion-discounts"]);
    expect(options).toMatchObject({
      tags: [PROMOTION_CACHE_TAG],
      revalidate: PROMOTION_CACHE_TTL_SECONDS,
    });
    // Caching under one fixed key, rather than per product id, is what stops
    // every distinct set of products on screen minting its own cache entry.
    expect(keys).toHaveLength(1);
    expect(PROMOTION_CACHE_TTL_SECONDS).toBeGreaterThan(0);
  });
});

describe("loadPromotionDiscounts", () => {
  beforeEach(() => {
    mocks.createSupabaseServerClient.mockReset();
    mocks.createSupabaseServiceRoleClient.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("client and privileges", () => {
    it("reads with the service-role client", async () => {
      supabaseWith();

      await loadPromotionDiscounts([PRODUCT_A], NOW);

      // discount_codes revokes every privilege from anon and authenticated, so
      // this is the only client that can read the promotion at all.
      expect(mocks.createSupabaseServiceRoleClient).toHaveBeenCalled();
    });

    it("never falls back to the public anonymous client", async () => {
      supabaseWith();

      await loadPromotionDiscounts([PRODUCT_A], NOW);

      expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    });

    it("looks the coupon up by the shared constant", async () => {
      const { client, builder } = supabaseWith();

      await loadPromotionDiscounts([PRODUCT_A], NOW);

      expect(client.from).toHaveBeenCalledWith("discount_codes");
      expect(builder.eq).toHaveBeenCalledWith(
        "code_normalized",
        PROMOTION_COUPON_CODE,
      );
    });
  });

  describe("coupon availability", () => {
    it("returns the discount for an active coupon", async () => {
      supabaseWith();

      const discounts = await loadPromotionDiscounts([PRODUCT_A], NOW);

      expect(discounts.get(PRODUCT_A)).toBe(3_600);
    });

    it("returns nothing when the coupon does not exist", async () => {
      supabaseWith({ data: null });

      const discounts = await loadPromotionDiscounts([PRODUCT_A], NOW);

      expect(discounts.size).toBe(0);
    });

    it("returns nothing when the coupon is inactive", async () => {
      supabaseWith({ data: couponRow({ is_active: false }) });

      const discounts = await loadPromotionDiscounts([PRODUCT_A], NOW);

      expect(discounts.size).toBe(0);
    });

    it("returns nothing before the coupon starts", async () => {
      supabaseWith({
        data: couponRow({ starts_at: "2026-08-06T00:00:00.000Z" }),
      });

      const discounts = await loadPromotionDiscounts([PRODUCT_A], NOW);

      expect(discounts.size).toBe(0);
    });

    it("returns nothing after the coupon expires", async () => {
      supabaseWith({
        data: couponRow({ expires_at: "2026-08-05T11:00:00.000Z" }),
      });

      const discounts = await loadPromotionDiscounts([PRODUCT_A], NOW);

      expect(discounts.size).toBe(0);
    });

    it("treats the start instant as inclusive, matching checkout", async () => {
      supabaseWith({ data: couponRow({ starts_at: NOW.toISOString() }) });

      const discounts = await loadPromotionDiscounts([PRODUCT_A], NOW);

      expect(discounts.get(PRODUCT_A)).toBe(3_600);
    });

    it("treats the expiry instant as exclusive, matching checkout", async () => {
      supabaseWith({ data: couponRow({ expires_at: NOW.toISOString() }) });

      const discounts = await loadPromotionDiscounts([PRODUCT_A], NOW);

      expect(discounts.size).toBe(0);
    });

    it("honours a coupon inside its window", async () => {
      supabaseWith({
        data: couponRow({
          starts_at: "2026-08-01T00:00:00.000Z",
          expires_at: "2026-09-01T00:00:00.000Z",
        }),
      });

      const discounts = await loadPromotionDiscounts([PRODUCT_A], NOW);

      expect(discounts.get(PRODUCT_A)).toBe(3_600);
    });

    it("ignores a row whose code is not the featured one", async () => {
      supabaseWith({ data: couponRow({ code_normalized: "SOMETHINGELSE" }) });

      const discounts = await loadPromotionDiscounts([PRODUCT_A], NOW);

      expect(discounts.size).toBe(0);
    });

    // The date window is evaluated per call rather than baked into the cached
    // payload, so one snapshot cannot keep a promotion open past its expiry.
    it("re-evaluates the window against the instant it is given", async () => {
      supabaseWith({
        data: couponRow({ expires_at: "2026-08-05T18:00:00.000Z" }),
      });

      const before = await loadPromotionDiscounts([PRODUCT_A], NOW);
      const after = await loadPromotionDiscounts(
        [PRODUCT_A],
        new Date("2026-08-05T18:00:00.000Z"),
      );

      expect(before.get(PRODUCT_A)).toBe(3_600);
      expect(after.size).toBe(0);
    });
  });

  describe("product eligibility", () => {
    it("returns a discount for an assigned product", async () => {
      supabaseWith();

      const discounts = await loadPromotionDiscounts([PRODUCT_A], NOW);

      expect(discounts.has(PRODUCT_A)).toBe(true);
    });

    it("omits an unassigned product rather than returning zero", async () => {
      supabaseWith();

      const discounts = await loadPromotionDiscounts(
        [PRODUCT_A, PRODUCT_B],
        NOW,
      );

      // Absent, not zero: a caller must not mistake "no promotion" for "a
      // promotion of nothing" and render a struck-through price for it.
      expect(discounts.has(PRODUCT_B)).toBe(false);
      expect(discounts.get(PRODUCT_B)).toBeUndefined();
    });

    it("keeps a different percentage per product", async () => {
      supabaseWith({
        data: couponRow({
          discount_code_products: [
            { product_id: PRODUCT_A, discount_percent: "36.00" },
            { product_id: PRODUCT_B, discount_percent: "60.00" },
            { product_id: PRODUCT_C, discount_percent: "12.50" },
          ],
        }),
      });

      const discounts = await loadPromotionDiscounts(
        [PRODUCT_A, PRODUCT_B, PRODUCT_C],
        NOW,
      );

      expect(discounts.get(PRODUCT_A)).toBe(3_600);
      expect(discounts.get(PRODUCT_B)).toBe(6_000);
      expect(discounts.get(PRODUCT_C)).toBe(1_250);
    });

    it("returns nothing when the coupon has no assignments", async () => {
      supabaseWith({ data: couponRow({ discount_code_products: [] }) });

      const discounts = await loadPromotionDiscounts([PRODUCT_A], NOW);

      expect(discounts.size).toBe(0);
    });

    it("tolerates a null assignment list", async () => {
      supabaseWith({ data: couponRow({ discount_code_products: null }) });

      await expect(
        loadPromotionDiscounts([PRODUCT_A], NOW),
      ).resolves.toEqual(new Map());
    });

    it("does not leak an assignment that was not asked about", async () => {
      supabaseWith({
        data: couponRow({
          discount_code_products: [
            { product_id: PRODUCT_A, discount_percent: "36.00" },
            { product_id: PRODUCT_B, discount_percent: "60.00" },
          ],
        }),
      });

      const discounts = await loadPromotionDiscounts([PRODUCT_A], NOW);

      expect([...discounts.keys()]).toEqual([PRODUCT_A]);
    });
  });

  describe("batching", () => {
    it("loads many products in a single database request", async () => {
      const { client, builder } = supabaseWith({
        data: couponRow({
          discount_code_products: [
            { product_id: PRODUCT_A, discount_percent: "36.00" },
            { product_id: PRODUCT_B, discount_percent: "60.00" },
            { product_id: PRODUCT_C, discount_percent: "12.50" },
          ],
        }),
      });

      const discounts = await loadPromotionDiscounts(
        [PRODUCT_A, PRODUCT_B, PRODUCT_C],
        NOW,
      );

      expect(discounts.size).toBe(3);
      // One request for the whole page, not one per product.
      expect(client.from).toHaveBeenCalledTimes(1);
      expect(builder.maybeSingle).toHaveBeenCalledTimes(1);
    });

    it("makes the same single request for one product as for many", async () => {
      const { client } = supabaseWith();

      await loadPromotionDiscounts(Array.from({ length: 50 }, () => PRODUCT_A), NOW);

      expect(client.from).toHaveBeenCalledTimes(1);
    });

    it("makes no request at all for an empty product list", async () => {
      const { client } = supabaseWith();

      const discounts = await loadPromotionDiscounts([], NOW);

      expect(discounts.size).toBe(0);
      expect(client.from).not.toHaveBeenCalled();
    });
  });

  describe("loadAllPromotionDiscounts", () => {
    it("returns every live assignment without needing product ids", async () => {
      supabaseWith({
        data: couponRow({
          discount_code_products: [
            { product_id: PRODUCT_A, discount_percent: "36.00" },
            { product_id: PRODUCT_B, discount_percent: "60.00" },
          ],
        }),
      });

      await expect(loadAllPromotionDiscounts(NOW)).resolves.toEqual({
        [PRODUCT_A]: 3_600,
        [PRODUCT_B]: 6_000,
      });
    });

    it("returns a plain object, so it can cross the server boundary", async () => {
      supabaseWith();

      const discounts = await loadAllPromotionDiscounts(NOW);

      expect(JSON.parse(JSON.stringify(discounts))).toEqual(discounts);
    });

    // The whole point of the availability gate: a coupon that is not live must
    // never have its configuration handed to a browser.
    it("exposes nothing when the coupon is inactive", async () => {
      supabaseWith({ data: couponRow({ is_active: false }) });

      await expect(loadAllPromotionDiscounts(NOW)).resolves.toEqual({});
    });

    it("exposes nothing before the coupon starts", async () => {
      supabaseWith({
        data: couponRow({ starts_at: "2026-08-06T00:00:00.000Z" }),
      });

      await expect(loadAllPromotionDiscounts(NOW)).resolves.toEqual({});
    });

    it("exposes nothing after the coupon expires", async () => {
      supabaseWith({
        data: couponRow({ expires_at: "2026-08-05T11:00:00.000Z" }),
      });

      await expect(loadAllPromotionDiscounts(NOW)).resolves.toEqual({});
    });

    it("exposes nothing when the coupon does not exist", async () => {
      supabaseWith({ data: null });

      await expect(loadAllPromotionDiscounts(NOW)).resolves.toEqual({});
    });

    it("exposes nothing when the read fails", async () => {
      supabaseWith({ error: { message: "connection refused" } });

      await expect(loadAllPromotionDiscounts(NOW)).resolves.toEqual({});
    });

    it("hands back a copy, so a caller cannot corrupt the cached snapshot", async () => {
      supabaseWith();

      const first = await loadAllPromotionDiscounts(NOW);
      first[PRODUCT_B] = 9_999;
      const second = await loadAllPromotionDiscounts(NOW);

      expect(second).toEqual({ [PRODUCT_A]: 3_600 });
    });
  });

  describe("failure", () => {
    // Fails closed: showing nothing understates an offer and recovers on the
    // next load; showing a discount checkout would refuse does not.
    it("returns no discounts when the read fails", async () => {
      supabaseWith({ error: { message: "connection refused" } });

      const discounts = await loadPromotionDiscounts([PRODUCT_A], NOW);

      expect(discounts.size).toBe(0);
    });

    it("returns no discounts when an assignment percentage is malformed", async () => {
      supabaseWith({
        data: couponRow({
          discount_code_products: [
            { product_id: PRODUCT_A, discount_percent: "not-a-number" },
          ],
        }),
      });

      const discounts = await loadPromotionDiscounts([PRODUCT_A], NOW);

      expect(discounts.size).toBe(0);
    });

    it("does not leak the database error text to the caller", async () => {
      supabaseWith({
        error: { message: 'permission denied for table "discount_codes"' },
      });

      // The failure is swallowed into an empty result, so nothing to leak.
      await expect(
        loadPromotionDiscounts([PRODUCT_A], NOW),
      ).resolves.toEqual(new Map());
    });
  });
});
