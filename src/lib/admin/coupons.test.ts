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
  createAdminCoupon,
  listAdminCoupons,
  updateAdminCoupon,
  validateAdminCouponSubmission,
} from "./coupons";

const COUPON_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_A = "22222222-2222-4222-8222-222222222222";
const PRODUCT_B = "33333333-3333-4333-8333-333333333333";

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
  const chainMethods = [
    "select",
    "eq",
    "in",
    "order",
    "insert",
    "update",
    "upsert",
    "delete",
  ];

  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder);
  }

  builder.returns = vi.fn(async () => resolved);
  builder.maybeSingle = vi.fn(async () => resolved);
  builder.single = vi.fn(async () => resolved);

  return builder;
}

function supabaseWith(...queries: ReturnType<typeof query>[]) {
  const client = {
    from: vi.fn(),
  };

  for (const builder of queries) {
    client.from.mockReturnValueOnce(builder);
  }

  mocks.createSupabase.mockReturnValue(client);
  return client;
}

function submission(
  overrides: Partial<Parameters<typeof createAdminCoupon>[0]> = {},
) {
  return {
    code: " sombre-20 ",
    isActive: true,
    startsAt: "",
    expiresAt: "",
    assignments: [],
    ...overrides,
  };
}

describe("admin coupon management", () => {
  beforeEach(() => {
    mocks.getAdminUser.mockReset();
    mocks.createSupabase.mockReset();
    mocks.getAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
  });

  it("fails closed before creating a service-role client without admin authentication", async () => {
    mocks.getAdminUser.mockResolvedValue(null);

    await expect(listAdminCoupons()).rejects.toThrow(
      "without an approved session",
    );
    expect(mocks.createSupabase).not.toHaveBeenCalled();
  });

  it("lists coupons with an accurate assigned-product count", async () => {
    supabaseWith(
      query({
        data: [
          {
            id: COUPON_ID,
            code_normalized: "SOMBRE",
            is_active: true,
            starts_at: null,
            expires_at: null,
            created_at: "2026-07-24T00:00:00.000Z",
            updated_at: "2026-07-24T00:00:00.000Z",
          },
        ],
      }),
      query({
        data: [
          { discount_code_id: COUPON_ID },
          { discount_code_id: COUPON_ID },
        ],
      }),
    );

    await expect(listAdminCoupons()).resolves.toMatchObject([
      {
        code_normalized: "SOMBRE",
        is_active: true,
        assigned_product_count: 2,
      },
    ]);
  });

  it("normalizes a new code and saves active state and optional dates", async () => {
    const duplicateQuery = query({ data: null });
    const createQuery = query({ data: { id: COUPON_ID } });
    const client = supabaseWith(duplicateQuery, createQuery);

    await expect(
      createAdminCoupon(
        submission({
          startsAt: "2026-08-01T09:00:00",
          expiresAt: "2026-08-02T09:00:00",
        }),
      ),
    ).resolves.toEqual({ ok: true, couponId: COUPON_ID });

    expect(createQuery.insert).toHaveBeenCalledWith({
      code_normalized: "SOMBRE-20",
      is_active: true,
      starts_at: "2026-08-01T01:00:00.000Z",
      expires_at: "2026-08-02T01:00:00.000Z",
    });
    expect(client.from.mock.calls.map(([table]) => table)).toEqual([
      "discount_codes",
      "discount_codes",
    ]);
  });

  it("rejects duplicate coupon codes without inserting", async () => {
    const duplicateQuery = query({ data: { id: COUPON_ID } });
    const client = supabaseWith(duplicateQuery);

    await expect(createAdminCoupon(submission())).resolves.toEqual({
      ok: false,
      error: "A coupon with that code already exists.",
    });
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(duplicateQuery.insert).not.toHaveBeenCalled();
  });

  it("rejects invalid code formats and invalid date ranges", () => {
    expect(
      validateAdminCouponSubmission(
        submission({ code: "!!", assignments: [] }),
        { requireCode: true },
      ),
    ).toMatchObject({ ok: false, error: expect.stringContaining("3–32") });

    expect(
      validateAdminCouponSubmission(
        submission({
          startsAt: "2026-08-02T09:00",
          expiresAt: "2026-08-01T09:00",
        }),
        { requireCode: true },
      ),
    ).toEqual({
      ok: false,
      error: "Expiry must be later than the start date.",
    });
  });

  it.each(["0", "-1", "100.01", "10.001", "abc"])(
    "rejects invalid discount percentage %s",
    (discountPercent) => {
      expect(
        validateAdminCouponSubmission(
          submission({
            assignments: [{ productId: PRODUCT_A, discountPercent }],
          }),
          { requireCode: true },
        ),
      ).toMatchObject({
        ok: false,
        error: expect.stringContaining("at most two decimal"),
      });
    },
  );

  it("creates different product-specific percentage assignments", async () => {
    const productsQuery = query({
      data: [{ id: PRODUCT_A }, { id: PRODUCT_B }],
    });
    const duplicateQuery = query({ data: null });
    const createQuery = query({ data: { id: COUPON_ID } });
    const assignmentsQuery = query({
      data: [{ product_id: PRODUCT_A }, { product_id: PRODUCT_B }],
    });
    supabaseWith(
      productsQuery,
      duplicateQuery,
      createQuery,
      assignmentsQuery,
    );

    await expect(
      createAdminCoupon(
        submission({
          assignments: [
            { productId: PRODUCT_A, discountPercent: "20" },
            { productId: PRODUCT_B, discountPercent: "5.25" },
          ],
        }),
      ),
    ).resolves.toEqual({ ok: true, couponId: COUPON_ID });

    expect(assignmentsQuery.insert).toHaveBeenCalledWith([
      {
        discount_code_id: COUPON_ID,
        product_id: PRODUCT_A,
        discount_percent: "20.00",
      },
      {
        discount_code_id: COUPON_ID,
        product_id: PRODUCT_B,
        discount_percent: "5.25",
      },
    ]);
  });

  it("updates active state and assignments, removes omitted products, and never touches orders", async () => {
    const couponQuery = query({ data: { id: COUPON_ID } });
    const productsQuery = query({ data: [{ id: PRODUCT_B }] });
    const existingQuery = query({
      data: [{ product_id: PRODUCT_A }, { product_id: PRODUCT_B }],
    });
    const upsertQuery = query({ data: [{ product_id: PRODUCT_B }] });
    const removeQuery = query({ data: [{ product_id: PRODUCT_A }] });
    const updateQuery = query({ data: { id: COUPON_ID } });
    const client = supabaseWith(
      couponQuery,
      productsQuery,
      existingQuery,
      upsertQuery,
      removeQuery,
      updateQuery,
    );

    await expect(
      updateAdminCoupon(
        COUPON_ID,
        submission({
          code: undefined,
          isActive: false,
          assignments: [
            { productId: PRODUCT_B, discountPercent: "12.5" },
          ],
        }),
      ),
    ).resolves.toEqual({ ok: true, couponId: COUPON_ID });

    expect(upsertQuery.upsert).toHaveBeenCalledWith(
      [
        {
          discount_code_id: COUPON_ID,
          product_id: PRODUCT_B,
          discount_percent: "12.50",
        },
      ],
      { onConflict: "discount_code_id,product_id" },
    );
    expect(removeQuery.in).toHaveBeenCalledWith("product_id", [PRODUCT_A]);
    expect(updateQuery.update).toHaveBeenCalledWith({
      is_active: false,
      starts_at: null,
      expires_at: null,
    });
    expect(client.from.mock.calls.map(([table]) => table)).not.toContain(
      "orders",
    );
  });
});
