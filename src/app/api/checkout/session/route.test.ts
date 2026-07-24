import { beforeEach, describe, expect, it, vi } from "vitest";

import { CouponPreviewError } from "@/lib/checkout/coupon-quote";
import { calculateDiscountQuote } from "@/lib/checkout/discounts";
import { SHIPPING_FEE_HKD_CENTS } from "@/lib/checkout/shipping";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  createSession: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  getClientIp: vi.fn(),
  loadCouponPreview: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
}));

vi.mock("@/lib/stripe/server", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: mocks.createSession,
      },
    },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("@/lib/checkout/coupons", () => ({
  loadCouponPreview: mocks.loadCouponPreview,
}));

import { POST } from "./route";

const PRODUCT_A_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B_ID = "22222222-2222-4222-8222-222222222222";
const COUPON_DATABASE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  price: number;
  size_label: string | null;
  is_active: boolean;
  stock_quantity: number;
};

const customer = {
  fullName: "Sombre Customer",
  email: "customer@example.com",
  phone: "91234567",
  addressLine1: "1 Sombre Street",
  addressLine2: "",
  district: "Central",
  city: "Hong Kong",
  postalCode: "",
  country: "Hong Kong",
};

const defaultProducts: ProductRow[] = [
  {
    id: PRODUCT_A_ID,
    slug: "product-a",
    name: "Product A",
    price: 1_000,
    size_label: "One Size",
    is_active: true,
    stock_quantity: 10,
  },
  {
    id: PRODUCT_B_ID,
    slug: "product-b",
    name: "Product B",
    price: 500,
    size_label: null,
    is_active: true,
    stock_quantity: 10,
  },
];

let productRows: ProductRow[];
let productError: Error | null;

function cartItem(product: ProductRow, quantity: number) {
  return {
    id: product.id,
    slug: product.slug,
    name: "Untrusted client name",
    price: 1,
    size_label: product.size_label,
    image_url: null,
    quantity,
  };
}

function checkoutBody({
  cartItems = [
    cartItem(defaultProducts[0], 2),
    cartItem(defaultProducts[1], 1),
  ],
  subtotal = 2_500,
  couponCode,
}: {
  cartItems?: ReturnType<typeof cartItem>[];
  subtotal?: number;
  couponCode?: unknown;
} = {}) {
  return {
    cartItems,
    subtotal,
    customer,
    ...(couponCode !== undefined ? { couponCode } : {}),
  };
}

function checkoutRequest(body: unknown) {
  return new Request("http://localhost/api/checkout/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify(body),
  });
}

function couponPreview({
  code = "SOMBRE",
  lines = [
    {
      productId: PRODUCT_A_ID,
      quantity: 2,
      originalUnitAmountCents: 100_000,
      discountBasisPoints: 2_000,
    },
    {
      productId: PRODUCT_B_ID,
      quantity: 1,
      originalUnitAmountCents: 50_000,
    },
  ],
}: {
  code?: string;
  lines?: Parameters<typeof calculateDiscountQuote>[0];
} = {}) {
  return {
    couponCode: code,
    quote: calculateDiscountQuote(lines, SHIPPING_FEE_HKD_CENTS),
  };
}

function stripeInput() {
  return mocks.createSession.mock.calls[0]?.[0] as Record<string, unknown>;
}

function containsBigInt(value: unknown): boolean {
  if (typeof value === "bigint") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some(containsBigInt);
  }

  if (value && typeof value === "object") {
    return Object.values(value).some(containsBigInt);
  }

  return false;
}

describe("POST /api/checkout/session coupon pricing", () => {
  beforeEach(() => {
    process.env.SITE_URL = "https://sombre.example";
    productRows = defaultProducts.map((product) => ({ ...product }));
    productError = null;

    mocks.checkRateLimit.mockReset();
    mocks.checkRateLimit.mockResolvedValue({
      isAllowed: true,
      remaining: 9,
      retryAfterSeconds: 0,
    });
    mocks.getClientIp.mockReset();
    mocks.getClientIp.mockReturnValue("203.0.113.10");
    mocks.createSession.mockReset();
    mocks.createSession.mockResolvedValue({
      id: "cs_test_sombre",
      url: "https://checkout.stripe.test/c/pay/cs_test_sombre",
    });
    mocks.loadCouponPreview.mockReset();
    mocks.createSupabaseServerClient.mockReset();
    mocks.createSupabaseServerClient.mockImplementation(() => {
      const query = {
        select: vi.fn(),
        in: vi.fn(),
        returns: vi.fn(async () => ({
          data: productRows,
          error: productError,
        })),
      };

      query.select.mockReturnValue(query);
      query.in.mockReturnValue(query);

      return {
        from: vi.fn(() => query),
      };
    });
  });

  it.each([undefined, null])(
    "preserves the no-coupon checkout for %s",
    async (couponCode) => {
      const response = await POST(
        checkoutRequest(checkoutBody({ couponCode })),
      );

      expect(response.status).toBe(200);
      expect(mocks.loadCouponPreview).not.toHaveBeenCalled();
      expect(mocks.createSession).toHaveBeenCalledTimes(1);

      const input = stripeInput() as {
        line_items: {
          price_data: {
            unit_amount: number;
            product_data: { metadata: Record<string, string> };
          };
        }[];
        metadata: Record<string, string>;
      };

      expect(
        input.line_items.map((line) => line.price_data.unit_amount),
      ).toEqual([100_000, 50_000]);
      expect(input.line_items[0].price_data.product_data.metadata).toEqual({
        product_id: PRODUCT_A_ID,
        product_slug: "product-a",
      });
      expect(input.metadata).toMatchObject({
        subtotal: "2500.00",
        shipping_fee: "50.00",
        total: "2550.00",
      });
      expect(input.metadata).not.toHaveProperty("coupon_code");
      expect(input.metadata).not.toHaveProperty("quote_version");
    },
  );

  it("uses discounted integer unit amounts and adds string snapshot metadata", async () => {
    mocks.loadCouponPreview.mockResolvedValue(couponPreview());

    const response = await POST(
      checkoutRequest(
        checkoutBody({
          couponCode: "  sombre  ",
          subtotal: 2_500.009,
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.loadCouponPreview).toHaveBeenCalledWith({
      code: "  sombre  ",
      cartItems: checkoutBody().cartItems,
    });

    const input = stripeInput() as {
      line_items: {
        quantity: number;
        price_data: {
          unit_amount: number;
          product_data: { metadata: Record<string, string> };
        };
      }[];
      shipping_options: {
        shipping_rate_data: {
          fixed_amount: { amount: number };
        };
      }[];
      metadata: Record<string, string>;
    };

    expect(
      input.line_items.map((line) => ({
        quantity: line.quantity,
        unitAmount: line.price_data.unit_amount,
      })),
    ).toEqual([
      { quantity: 2, unitAmount: 80_000 },
      { quantity: 1, unitAmount: 50_000 },
    ]);
    expect(input.shipping_options[0].shipping_rate_data.fixed_amount.amount).toBe(
      5_000,
    );
    expect(input.metadata).toMatchObject({
      customer_name: "Sombre Customer",
      customer_phone: "91234567",
      address_line_1: "1 Sombre Street",
      address_line_2: "",
      district: "Central",
      city: "Hong Kong",
      postal_code: "",
      country: "Hong Kong",
      cart_item_count: "2",
      cart_quantity_total: "3",
      subtotal: "2500.00",
      shipping_fee: "50.00",
      total: "2550.00",
      quote_version: "product-discount-v1",
      coupon_code: "SOMBRE",
      original_subtotal_minor: "250000",
      discount_minor: "40000",
      discounted_subtotal_minor: "210000",
      shipping_minor: "5000",
      total_minor: "215000",
    });
    expect(input.line_items[0].price_data.product_data.metadata).toEqual({
      product_id: PRODUCT_A_ID,
      product_slug: "product-a",
      original_unit_minor: "100000",
      discount_basis_points: "2000",
      unit_discount_minor: "20000",
      discounted_unit_minor: "80000",
    });
    expect(input.line_items[1].price_data.product_data.metadata).toEqual({
      product_id: PRODUCT_B_ID,
      product_slug: "product-b",
      original_unit_minor: "50000",
      discount_basis_points: "0",
      unit_discount_minor: "0",
      discounted_unit_minor: "50000",
    });
    expect(JSON.stringify(input)).not.toContain(COUPON_DATABASE_ID);
    expect(containsBigInt(input)).toBe(false);
    expect(
      Object.values(input.metadata).every(
        (value) => typeof value === "string",
      ),
    ).toBe(true);
    expect(
      input.line_items.every((line) =>
        Object.values(line.price_data.product_data.metadata).every(
          (value) => typeof value === "string",
        ),
      ),
    ).toBe(true);
  });

  it.each([
    { label: "array", couponCode: ["SOMBRE"] },
    { label: "object", couponCode: { code: "SOMBRE" } },
    { label: "number", couponCode: 10 },
    { label: "boolean", couponCode: true },
    { label: "empty string", couponCode: "" },
    { label: "whitespace string", couponCode: "   " },
  ])("rejects a coupon code supplied as $label", async ({ couponCode }) => {
    const response = await POST(
      checkoutRequest(checkoutBody({ couponCode })),
    );

    expect(response.status).toBe(400);
    expect(mocks.loadCouponPreview).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it.each(["unknown", "inactive", "future", "expired"])(
    "rejects an %s coupon without calling Stripe",
    async () => {
      mocks.loadCouponPreview.mockRejectedValue(
        new CouponPreviewError("invalid_coupon"),
      );

      const response = await POST(
        checkoutRequest(checkoutBody({ couponCode: "SOMBRE" })),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "This coupon is invalid, expired, or unavailable.",
      });
      expect(mocks.createSession).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      label: "zero-effect coupon",
      reason: "not_applicable" as const,
      status: 400,
      error: "This coupon does not apply to the items in your cart.",
    },
    {
      label: "cart changed during coupon reload",
      reason: "cart_changed" as const,
      status: 409,
      error: "Your cart changed. Please review it and try again.",
    },
  ])(
    "rejects a $label without calling Stripe",
    async ({ reason, status, error }) => {
      mocks.loadCouponPreview.mockRejectedValue(
        new CouponPreviewError(reason),
      );

      const response = await POST(
        checkoutRequest(checkoutBody({ couponCode: "SOMBRE" })),
      );

      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({ error });
      expect(mocks.createSession).not.toHaveBeenCalled();
    },
  );

  it("supports quantities and different discounts in a mixed cart", async () => {
    productRows[1].stock_quantity = 5;
    const cartItems = [
      cartItem(defaultProducts[0], 2),
      cartItem(defaultProducts[1], 3),
    ];
    mocks.loadCouponPreview.mockResolvedValue(
      couponPreview({
        lines: [
          {
            productId: PRODUCT_A_ID,
            quantity: 2,
            originalUnitAmountCents: 100_000,
            discountBasisPoints: 2_000,
          },
          {
            productId: PRODUCT_B_ID,
            quantity: 3,
            originalUnitAmountCents: 50_000,
            discountBasisPoints: 525,
          },
        ],
      }),
    );

    const response = await POST(
      checkoutRequest(
        checkoutBody({
          cartItems,
          subtotal: 3_500,
          couponCode: "SOMBRE",
        }),
      ),
    );

    expect(response.status).toBe(200);
    const input = stripeInput() as {
      line_items: {
        quantity: number;
        price_data: { unit_amount: number };
      }[];
      metadata: Record<string, string>;
    };
    expect(
      input.line_items.map((line) => [
        line.quantity,
        line.price_data.unit_amount,
      ]),
    ).toEqual([
      [2, 80_000],
      [3, 47_375],
    ]);
    expect(input.metadata.discount_minor).toBe("47875");
    expect(input.metadata.total_minor).toBe("307125");
  });

  it("uses deterministic per-unit rounding from the shared quote", async () => {
    productRows = [{ ...defaultProducts[0], price: 10.01 }];
    const cartItems = [cartItem(productRows[0], 2)];
    mocks.loadCouponPreview.mockResolvedValue(
      couponPreview({
        lines: [
          {
            productId: PRODUCT_A_ID,
            quantity: 2,
            originalUnitAmountCents: 1_001,
            discountBasisPoints: 5_000,
          },
        ],
      }),
    );

    const response = await POST(
      checkoutRequest(
        checkoutBody({
          cartItems,
          subtotal: 20.02,
          couponCode: "SOMBRE",
        }),
      ),
    );

    expect(response.status).toBe(200);
    const input = stripeInput() as {
      line_items: { price_data: { unit_amount: number } }[];
      metadata: Record<string, string>;
    };
    expect(input.line_items[0].price_data.unit_amount).toBe(500);
    expect(input.metadata.discount_minor).toBe("1002");
  });

  it("supports a fully discounted product while charging full shipping", async () => {
    productRows = [{ ...defaultProducts[0] }];
    const cartItems = [cartItem(productRows[0], 1)];
    mocks.loadCouponPreview.mockResolvedValue(
      couponPreview({
        lines: [
          {
            productId: PRODUCT_A_ID,
            quantity: 1,
            originalUnitAmountCents: 100_000,
            discountBasisPoints: 10_000,
          },
        ],
      }),
    );

    const response = await POST(
      checkoutRequest(
        checkoutBody({
          cartItems,
          subtotal: 1_000,
          couponCode: "SOMBRE",
        }),
      ),
    );

    expect(response.status).toBe(200);
    const input = stripeInput() as {
      line_items: { price_data: { unit_amount: number } }[];
      shipping_options: {
        shipping_rate_data: { fixed_amount: { amount: number } };
      }[];
      metadata: Record<string, string>;
    };
    expect(input.line_items[0].price_data.unit_amount).toBe(0);
    expect(input.shipping_options[0].shipping_rate_data.fixed_amount.amount).toBe(
      5_000,
    );
    expect(input.metadata.discounted_subtotal_minor).toBe("0");
    expect(input.metadata.shipping_minor).toBe("5000");
    expect(input.metadata.total_minor).toBe("5000");
  });

  it.each([
    {
      label: "stock",
      mutate: () => {
        productRows[0].stock_quantity = 1;
      },
      expectedStatus: 409,
    },
    {
      label: "slug",
      mutate: () => {
        productRows[0].slug = "changed-product-a";
      },
      expectedStatus: 400,
    },
  ])(
    "rejects a $label change before coupon pricing or Stripe",
    async ({ mutate, expectedStatus }) => {
      mutate();

      const response = await POST(
        checkoutRequest(checkoutBody({ couponCode: "SOMBRE" })),
      );

      expect(response.status).toBe(expectedStatus);
      expect(mocks.loadCouponPreview).not.toHaveBeenCalled();
      expect(mocks.createSession).not.toHaveBeenCalled();
    },
  );

  it("rejects duplicate products before external pricing or Stripe", async () => {
    const duplicate = cartItem(defaultProducts[0], 1);
    const response = await POST(
      checkoutRequest(
        checkoutBody({
          cartItems: [duplicate, { ...duplicate }],
          subtotal: 2_000,
          couponCode: "SOMBRE",
        }),
      ),
    );

    expect(response.status).toBe(400);
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    expect(mocks.loadCouponPreview).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("maps coupon database failures safely and does not call Stripe", async () => {
    mocks.loadCouponPreview.mockRejectedValue(
      new CouponPreviewError("unavailable"),
    );

    const response = await POST(
      checkoutRequest(checkoutBody({ couponCode: "SOMBRE" })),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Coupon preview is temporarily unavailable.",
    });
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("preserves the observed-subtotal stale-cart safeguard", async () => {
    const response = await POST(
      checkoutRequest(
        checkoutBody({
          subtotal: 1,
          couponCode: "SOMBRE",
        }),
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Checkout prices changed. Please review your cart and try again.",
    });
    expect(mocks.loadCouponPreview).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "invalid total",
      tamper: (preview: ReturnType<typeof couponPreview>) => {
        preview.quote.finalTotalCents += 1;
      },
    },
    {
      label: "wrong shipping",
      tamper: (preview: ReturnType<typeof couponPreview>) => {
        preview.quote.shippingCents = 0;
        preview.quote.finalTotalCents =
          preview.quote.discountedSubtotalCents;
      },
    },
    {
      label: "zero effect",
      tamper: (preview: ReturnType<typeof couponPreview>) => {
        preview.quote.lines = preview.quote.lines.map((line) => ({
          ...line,
          discountBasisPoints: 0,
          unitDiscountCents: 0,
          discountedUnitAmountCents: line.originalUnitAmountCents,
          lineDiscountCents: 0,
          discountedLineTotalCents: line.originalLineTotalCents,
        }));
        preview.quote.discountTotalCents = 0;
        preview.quote.discountedSubtotalCents =
          preview.quote.originalSubtotalCents;
        preview.quote.finalTotalCents =
          preview.quote.originalSubtotalCents +
          preview.quote.shippingCents;
      },
    },
  ])(
    "rejects a coupon quote with $label before Stripe",
    async ({ tamper }) => {
      const preview = couponPreview();
      tamper(preview);
      mocks.loadCouponPreview.mockResolvedValue(preview);

      const response = await POST(
        checkoutRequest(checkoutBody({ couponCode: "SOMBRE" })),
      );

      expect(response.status).toBe(503);
      expect(mocks.createSession).not.toHaveBeenCalled();
    },
  );
});
