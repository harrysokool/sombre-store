import { beforeEach, describe, expect, it, vi } from "vitest";

import { CouponPreviewError } from "./coupon-quote";

const boundaries = vi.hoisted(() => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));

// The official marker deliberately throws outside a React Server environment.
// Its package is installed and resolved here; only that runtime marker behavior
// is neutralized so Vitest can exercise the real coupons.ts implementation.
vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient:
    boundaries.createSupabaseServiceRoleClient,
}));

import { loadCouponPreview } from "./coupons";

const NOW = new Date("2026-07-24T12:00:00.000Z");
const COUPON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PRODUCT_A_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B_ID = "22222222-2222-4222-8222-222222222222";
const UNRELATED_PRODUCT_ID = "33333333-3333-4333-8333-333333333333";

type QueryResult = {
  data: unknown;
  error: Error | null;
};

type Scenario = {
  coupon: QueryResult;
  assignments: QueryResult;
  products: QueryResult;
};

type QueryMock = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  returns: ReturnType<typeof vi.fn>;
};

const activeCouponRow = {
  id: COUPON_ID,
  code_normalized: "SOMBRE",
  is_active: true,
  starts_at: null,
  expires_at: null,
};

const productRows = [
  {
    id: PRODUCT_A_ID,
    slug: "product-a",
    price: "1000.00",
    is_active: true,
    stock_quantity: 5,
  },
  {
    id: PRODUCT_B_ID,
    slug: "product-b",
    price: "500.00",
    is_active: true,
    stock_quantity: 5,
  },
];

const cartItems = [
  { id: PRODUCT_A_ID, slug: "product-a", quantity: 2 },
  { id: PRODUCT_B_ID, slug: "product-b", quantity: 1 },
];

let scenario: Scenario;
let queries: Record<string, QueryMock>;

function createQuery(table: string) {
  const query = {} as QueryMock;

  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => scenario.coupon);
  query.returns = vi.fn(async () =>
    table === "discount_code_products"
      ? scenario.assignments
      : scenario.products,
  );
  queries[table] = query;

  return query;
}

function setScenario(overrides: Partial<Scenario> = {}) {
  scenario = {
    coupon: { data: activeCouponRow, error: null },
    assignments: {
      data: [{ product_id: PRODUCT_A_ID, discount_percent: "20.00" }],
      error: null,
    },
    products: { data: productRows, error: null },
    ...overrides,
  };
}

async function expectReason(
  promise: Promise<unknown>,
  reason: CouponPreviewError["reason"],
) {
  await expect(promise).rejects.toMatchObject({
    name: "CouponPreviewError",
    reason,
  });
}

describe("loadCouponPreview", () => {
  beforeEach(() => {
    queries = {};
    setScenario();
    boundaries.createSupabaseServiceRoleClient.mockReset();
    boundaries.createSupabaseServiceRoleClient.mockReturnValue({
      from: vi.fn((table: string) => createQuery(table)),
    });
  });

  it("loads the real module and scopes every query to normalized cart inputs", async () => {
    const preview = await loadCouponPreview({
      code: "  sombre  ",
      cartItems,
      now: NOW,
    });

    expect(queries.discount_codes.eq).toHaveBeenCalledWith(
      "code_normalized",
      "SOMBRE",
    );
    expect(queries.discount_codes.maybeSingle).toHaveBeenCalledTimes(1);
    expect(queries.discount_code_products.eq).toHaveBeenCalledWith(
      "discount_code_id",
      COUPON_ID,
    );
    expect(queries.discount_code_products.in).toHaveBeenCalledWith(
      "product_id",
      [PRODUCT_A_ID, PRODUCT_B_ID],
    );
    expect(queries.products.in).toHaveBeenCalledWith("id", [
      PRODUCT_A_ID,
      PRODUCT_B_ID,
    ]);
    expect(preview.couponCode).toBe("SOMBRE");
    expect(preview.quote.lines.map((line) => line.discountBasisPoints)).toEqual(
      [2_000, 0],
    );
  });

  it("ignores unrelated assignment rows and never returns the coupon database ID", async () => {
    setScenario({
      assignments: {
        data: [
          { product_id: PRODUCT_A_ID, discount_percent: "20.00" },
          {
            product_id: UNRELATED_PRODUCT_ID,
            discount_percent: "100.00",
          },
        ],
        error: null,
      },
    });

    const preview = await loadCouponPreview({
      code: "SOMBRE",
      cartItems,
      now: NOW,
    });

    expect(preview.quote.lines).toHaveLength(2);
    expect(
      preview.quote.lines.some(
        (line) => line.productId === UNRELATED_PRODUCT_ID,
      ),
    ).toBe(false);
    expect(JSON.stringify(preview)).not.toContain(COUPON_ID);
  });

  it("maps coupon lookup errors to unavailable", async () => {
    setScenario({
      coupon: { data: null, error: new Error("coupon lookup failed") },
    });

    await expectReason(
      loadCouponPreview({ code: "SOMBRE", cartItems, now: NOW }),
      "unavailable",
    );
  });

  it("maps assignment query errors to unavailable", async () => {
    setScenario({
      assignments: {
        data: null,
        error: new Error("assignment lookup failed"),
      },
    });

    await expectReason(
      loadCouponPreview({ code: "SOMBRE", cartItems, now: NOW }),
      "unavailable",
    );
  });

  it("maps product query errors to unavailable", async () => {
    setScenario({
      products: { data: null, error: new Error("product lookup failed") },
    });

    await expectReason(
      loadCouponPreview({ code: "SOMBRE", cartItems, now: NOW }),
      "unavailable",
    );
  });

  it("maps an unknown coupon to the generic invalid reason without later queries", async () => {
    setScenario({ coupon: { data: null, error: null } });

    await expectReason(
      loadCouponPreview({ code: "SOMBRE", cartItems, now: NOW }),
      "invalid_coupon",
    );
    expect(queries.discount_code_products).toBeUndefined();
    expect(queries.products).toBeUndefined();
  });

  it.each([
    {
      state: "inactive",
      coupon: { ...activeCouponRow, is_active: false },
    },
    {
      state: "future",
      coupon: {
        ...activeCouponRow,
        starts_at: "2026-07-24T12:00:00.001Z",
      },
    },
    {
      state: "expired",
      coupon: {
        ...activeCouponRow,
        expires_at: NOW.toISOString(),
      },
    },
  ])("maps a $state coupon to the same generic invalid reason", async ({
    coupon,
  }) => {
    setScenario({ coupon: { data: coupon, error: null } });

    await expectReason(
      loadCouponPreview({ code: "SOMBRE", cartItems, now: NOW }),
      "invalid_coupon",
    );
    expect(queries.discount_code_products).toBeUndefined();
    expect(queries.products).toBeUndefined();
  });

  it("maps a valid coupon with no matching assignment to not_applicable", async () => {
    setScenario({ assignments: { data: [], error: null } });

    await expectReason(
      loadCouponPreview({ code: "SOMBRE", cartItems, now: NOW }),
      "not_applicable",
    );
  });

  it("maps a product result shorter than the cart to cart_changed", async () => {
    setScenario({ products: { data: [productRows[0]], error: null } });

    await expectReason(
      loadCouponPreview({ code: "SOMBRE", cartItems, now: NOW }),
      "cart_changed",
    );
  });

  it("fails safely for a malformed database price", async () => {
    setScenario({
      products: {
        data: [{ ...productRows[0], price: "10.001" }, productRows[1]],
        error: null,
      },
    });

    await expectReason(
      loadCouponPreview({ code: "SOMBRE", cartItems, now: NOW }),
      "unavailable",
    );
  });

  it.each(["0", "-1", "100.01", "5.001", "not-a-number"])(
    "fails safely for malformed database percentage %j",
    async (discountPercent) => {
      setScenario({
        assignments: {
          data: [
            {
              product_id: PRODUCT_A_ID,
              discount_percent: discountPercent,
            },
          ],
          error: null,
        },
      });

      await expectReason(
        loadCouponPreview({ code: "SOMBRE", cartItems, now: NOW }),
        "unavailable",
      );
    },
  );

  it("fails safely for duplicate assignment rows", async () => {
    setScenario({
      assignments: {
        data: [
          { product_id: PRODUCT_A_ID, discount_percent: "20.00" },
          { product_id: PRODUCT_A_ID, discount_percent: "10.00" },
        ],
        error: null,
      },
    });

    await expectReason(
      loadCouponPreview({ code: "SOMBRE", cartItems, now: NOW }),
      "unavailable",
    );
  });
});
