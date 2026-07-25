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
  getAdminCoupon,
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
    rpc: vi.fn(),
  };

  for (const builder of queries) {
    client.from.mockReturnValueOnce(builder);
  }

  mocks.createSupabase.mockReturnValue(client);
  return client;
}

// Coupon edits go through one transactional RPC rather than a chain of
// PostgREST requests, so these tests assert the call payload and how each
// refusal reason is worded. The transaction itself is covered in
// coupon-update-atomicity.test.ts.
function supabaseWithRpc(result: QueryResult = {}) {
  const client = {
    from: vi.fn(),
    rpc: vi.fn(async () => ({
      data: result.data ?? null,
      error: result.error ?? null,
    })),
  };

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

  it("sends the whole edit as one transactional RPC and never touches orders", async () => {
    const client = supabaseWithRpc({
      data: {
        ok: true,
        coupon_id: COUPON_ID,
        assigned_product_count: 1,
        removed_product_count: 1,
      },
    });

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

    // One database round trip for the entire edit. Nothing can commit
    // separately from anything else.
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).toHaveBeenCalledWith(
      "update_discount_code_with_assignments",
      {
        p_discount_code_id: COUPON_ID,
        p_is_active: false,
        p_starts_at: null,
        p_expires_at: null,
        // PRODUCT_A is simply absent, which is how a removal is expressed.
        p_assignments: [
          { product_id: PRODUCT_B, discount_percent: "12.50" },
        ],
      },
    );
  });

  it("submits the full desired assignment set, including a since-deactivated product", async () => {
    const client = supabaseWithRpc({
      data: { ok: true, coupon_id: COUPON_ID, assigned_product_count: 2 },
    });

    await expect(
      updateAdminCoupon(
        COUPON_ID,
        submission({
          code: undefined,
          isActive: false,
          startsAt: "2026-08-01T09:00:00",
          expiresAt: "2026-08-02T09:00:00",
          assignments: [
            { productId: PRODUCT_A, discountPercent: "20.00" },
            { productId: PRODUCT_B, discountPercent: "12.50" },
          ],
        }),
      ),
    ).resolves.toEqual({ ok: true, couponId: COUPON_ID });

    // PRODUCT_A stays in the payload even though it is no longer active. The
    // RPC only requires a *newly added* assignment to be active, so an
    // unrelated change never silently drops it.
    expect(client.rpc).toHaveBeenCalledWith(
      "update_discount_code_with_assignments",
      {
        p_discount_code_id: COUPON_ID,
        p_is_active: false,
        p_starts_at: "2026-08-01T01:00:00.000Z",
        p_expires_at: "2026-08-02T01:00:00.000Z",
        p_assignments: [
          { product_id: PRODUCT_A, discount_percent: "20.00" },
          { product_id: PRODUCT_B, discount_percent: "12.50" },
        ],
      },
    );
  });

  it.each([
    ["not_found", "That coupon no longer exists."],
    [
      "inactive_product",
      "Only currently active products can be assigned to a coupon. No changes were saved.",
    ],
    [
      "unknown_product",
      "Only currently active products can be assigned to a coupon. No changes were saved.",
    ],
    [
      "invalid_assignments",
      "One of the selected products is not valid. No changes were saved.",
    ],
    [
      "duplicate_product",
      "One of the selected products is not valid. No changes were saved.",
    ],
    ["invalid_date_range", "Expiry must be later than the start date."],
    [
      "something_new",
      "Coupon could not be updated. No changes were saved. Try again.",
    ],
  ])("words the %s refusal without leaking database detail", async (
    reason,
    message,
  ) => {
    supabaseWithRpc({ data: { ok: false, reason } });

    await expect(
      updateAdminCoupon(
        COUPON_ID,
        submission({
          code: undefined,
          assignments: [{ productId: PRODUCT_A, discountPercent: "20.00" }],
        }),
      ),
    ).resolves.toEqual({ ok: false, error: message });
  });

  it("reports a failed transaction as saving nothing and hides the driver error", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    supabaseWithRpc({
      error: {
        code: "23503",
        message:
          'insert or update on table "discount_code_products" violates foreign key constraint',
        details: "Key (product_id)=(...) is not present in table \"products\".",
      },
    });

    await expect(
      updateAdminCoupon(
        COUPON_ID,
        submission({
          code: undefined,
          assignments: [{ productId: PRODUCT_A, discountPercent: "20.00" }],
        }),
      ),
    ).resolves.toEqual({
      ok: false,
      error: "Coupon could not be updated. No changes were saved. Try again.",
    });

    consoleError.mockRestore();
  });

  it("counts both active and inactive assignments in the admin coupon list", async () => {
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
        // Two assignment rows are returned regardless of whether their
        // product is still active — the count query never filters on it.
        data: [
          { discount_code_id: COUPON_ID },
          { discount_code_id: COUPON_ID },
        ],
      }),
    );

    await expect(listAdminCoupons()).resolves.toMatchObject([
      { assigned_product_count: 2 },
    ]);
  });

  it("loads a coupon's assignments including a since-deactivated product", async () => {
    const couponQuery = query({
      data: {
        id: COUPON_ID,
        code_normalized: "SOMBRE",
        is_active: true,
        starts_at: null,
        expires_at: null,
        created_at: "2026-07-24T00:00:00.000Z",
        updated_at: "2026-07-24T00:00:00.000Z",
      },
    });
    const rawAssignmentsQuery = query({
      data: [
        { product_id: PRODUCT_A, discount_percent: "20.00" },
        { product_id: PRODUCT_B, discount_percent: "5.00" },
      ],
    });
    const activeProductsQuery = query({
      data: [
        { id: PRODUCT_B, name: "Product B", slug: "product-b", price: "500.00" },
      ],
    });
    const assignedProductsQuery = query({
      data: [
        {
          id: PRODUCT_A,
          name: "Product A",
          slug: "product-a",
          price: "1000.00",
          is_active: false,
        },
        {
          id: PRODUCT_B,
          name: "Product B",
          slug: "product-b",
          price: "500.00",
          is_active: true,
        },
      ],
    });
    supabaseWith(
      couponQuery,
      rawAssignmentsQuery,
      activeProductsQuery,
      assignedProductsQuery,
    );

    const result = await getAdminCoupon(COUPON_ID);

    expect(result?.assignments).toEqual([
      {
        product_id: PRODUCT_A,
        discount_percent: "20.00",
        product_name: "Product A",
        product_slug: "product-a",
        product_price: "1000.00",
        is_active: false,
      },
      {
        product_id: PRODUCT_B,
        discount_percent: "5.00",
        product_name: "Product B",
        product_slug: "product-b",
        product_price: "500.00",
        is_active: true,
      },
    ]);
    // The "add a product" list only ever comes from the active-products
    // query, so a deactivated product can never be (re-)added.
    expect(result?.products).toEqual([
      { id: PRODUCT_B, name: "Product B", slug: "product-b", price: "500.00" },
    ]);
  });
});
