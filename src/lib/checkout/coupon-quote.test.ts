import { describe, expect, it } from "vitest";

import {
  assertCouponIsAvailable,
  buildCouponPreviewQuote,
  CouponPreviewError,
  normalizeCouponCode,
  type CouponConfiguration,
  type CouponProduct,
} from "./coupon-quote";

const NOW = new Date("2026-07-24T12:00:00.000Z");
const PRODUCT_A_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B_ID = "22222222-2222-4222-8222-222222222222";

const activeCoupon: CouponConfiguration = {
  codeNormalized: "SOMBRE",
  isActive: true,
  startsAt: "2026-07-24T12:00:00.000Z",
  expiresAt: "2026-08-01T00:00:00.000Z",
};

const products: CouponProduct[] = [
  {
    id: PRODUCT_A_ID,
    slug: "product-a",
    price: "1000.00",
    isActive: true,
    stockQuantity: 5,
  },
  {
    id: PRODUCT_B_ID,
    slug: "product-b",
    price: "500.00",
    isActive: true,
    stockQuantity: 5,
  },
];

const cartItems = [
  { id: PRODUCT_A_ID, slug: "product-a", quantity: 2 },
  { id: PRODUCT_B_ID, slug: "product-b", quantity: 1 },
];

function expectCouponReason(action: () => unknown, reason: string) {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(CouponPreviewError);
    expect((error as CouponPreviewError).reason).toBe(reason);
    return;
  }

  throw new Error(`Expected coupon failure ${reason}.`);
}

describe("normalizeCouponCode", () => {
  it.each([
    ["  sombre  ", "SOMBRE"],
    ["summer-25", "SUMMER-25"],
    ["vip_100", "VIP_100"],
    ["123", "123"],
  ])("normalizes %j to %s", (value, expected) => {
    expect(normalizeCouponCode(value)).toBe(expected);
  });

  it.each([
    "",
    "  ",
    "AB",
    "A".repeat(33),
    "_SOMBRE",
    "-SOMBRE",
    "SOMBRE!",
    "SOMBRE CODE",
    "SØMBRE",
    123,
    ["SOMBRE"],
  ])("rejects invalid code %j", (value) => {
    expectCouponReason(() => normalizeCouponCode(value), "invalid_coupon");
  });
});

describe("assertCouponIsAvailable", () => {
  it("accepts an active coupon exactly at its inclusive start time", () => {
    expect(() =>
      assertCouponIsAvailable(activeCoupon, "SOMBRE", NOW),
    ).not.toThrow();
  });

  it.each([
    {
      label: "no start",
      startsAt: null,
      expiresAt: "2026-08-01T00:00:00.000Z",
    },
    {
      label: "no expiry",
      startsAt: "2026-07-01T00:00:00.000Z",
      expiresAt: null,
    },
    {
      label: "no date boundaries",
      startsAt: null,
      expiresAt: null,
    },
  ])("accepts an active coupon with $label", ({ startsAt, expiresAt }) => {
    expect(() =>
      assertCouponIsAvailable(
        { ...activeCoupon, startsAt, expiresAt },
        "SOMBRE",
        NOW,
      ),
    ).not.toThrow();
  });

  it("rejects an inactive coupon", () => {
    expectCouponReason(
      () =>
        assertCouponIsAvailable(
          { ...activeCoupon, isActive: false },
          "SOMBRE",
          NOW,
        ),
      "invalid_coupon",
    );
  });

  it("rejects a future coupon", () => {
    expectCouponReason(
      () =>
        assertCouponIsAvailable(
          { ...activeCoupon, startsAt: "2026-07-24T12:00:00.001Z" },
          "SOMBRE",
          NOW,
        ),
      "invalid_coupon",
    );
  });

  it("rejects a coupon exactly at its exclusive expiry time", () => {
    expectCouponReason(
      () =>
        assertCouponIsAvailable(
          { ...activeCoupon, expiresAt: NOW.toISOString() },
          "SOMBRE",
          NOW,
        ),
      "invalid_coupon",
    );
  });

  it("rejects an unknown coupon", () => {
    expectCouponReason(
      () => assertCouponIsAvailable(null, "SOMBRE", NOW),
      "invalid_coupon",
    );
  });
});

describe("buildCouponPreviewQuote", () => {
  it("builds a valid quote from active server products", () => {
    const preview = buildCouponPreviewQuote({
      code: " sombre ",
      coupon: activeCoupon,
      assignments: [
        { productId: PRODUCT_A_ID, discountPercent: "20.00" },
      ],
      products,
      cartItems,
      shippingCents: 5_000,
      now: NOW,
    });

    expect(preview.couponCode).toBe("SOMBRE");
    expect(preview.quote).toMatchObject({
      originalSubtotalCents: 250_000,
      discountTotalCents: 40_000,
      discountedSubtotalCents: 210_000,
      shippingCents: 5_000,
      finalTotalCents: 215_000,
    });
  });

  it("includes discounted and full-price products in one quote", () => {
    const preview = buildCouponPreviewQuote({
      code: "SOMBRE",
      coupon: activeCoupon,
      assignments: [
        { productId: PRODUCT_A_ID, discountPercent: "20" },
      ],
      products,
      cartItems,
      shippingCents: 5_000,
      now: NOW,
    });

    expect(
      preview.quote.lines.map((line) => ({
        productId: line.productId,
        discountBasisPoints: line.discountBasisPoints,
        unitDiscountCents: line.unitDiscountCents,
      })),
    ).toEqual([
      {
        productId: PRODUCT_A_ID,
        discountBasisPoints: 2_000,
        unitDiscountCents: 20_000,
      },
      {
        productId: PRODUCT_B_ID,
        discountBasisPoints: 0,
        unitDiscountCents: 0,
      },
    ]);
  });

  it("supports a different percentage for every matching product", () => {
    const preview = buildCouponPreviewQuote({
      code: "SOMBRE",
      coupon: activeCoupon,
      assignments: [
        { productId: PRODUCT_A_ID, discountPercent: "20.00" },
        { productId: PRODUCT_B_ID, discountPercent: "5.25" },
      ],
      products,
      cartItems,
      shippingCents: 5_000,
      now: NOW,
    });

    expect(
      preview.quote.lines.map((line) => line.discountBasisPoints),
    ).toEqual([2_000, 525]);
    expect(preview.quote.discountTotalCents).toBe(42_625);
  });

  it("rejects a coupon with no matching products", () => {
    expectCouponReason(
      () =>
        buildCouponPreviewQuote({
          code: "SOMBRE",
          coupon: activeCoupon,
          assignments: [],
          products,
          cartItems,
          shippingCents: 5_000,
          now: NOW,
        }),
      "not_applicable",
    );
  });

  it("rejects a coupon whose rounded total discount is zero", () => {
    expectCouponReason(
      () =>
        buildCouponPreviewQuote({
          code: "SOMBRE",
          coupon: activeCoupon,
          assignments: [
            { productId: PRODUCT_A_ID, discountPercent: "0.01" },
          ],
          products: [
            {
              ...products[0],
              price: "0.01",
            },
          ],
          cartItems: [
            { id: PRODUCT_A_ID, slug: "product-a", quantity: 1 },
          ],
          shippingCents: 5_000,
          now: NOW,
        }),
      "not_applicable",
    );
  });

  it("rejects a product slug mismatch", () => {
    expectCouponReason(
      () =>
        buildCouponPreviewQuote({
          code: "SOMBRE",
          coupon: activeCoupon,
          assignments: [
            { productId: PRODUCT_A_ID, discountPercent: "20" },
          ],
          products,
          cartItems: [
            { id: PRODUCT_A_ID, slug: "wrong-slug", quantity: 1 },
          ],
          shippingCents: 5_000,
          now: NOW,
        }),
      "cart_changed",
    );
  });

  it("rejects an inactive product", () => {
    expectCouponReason(
      () =>
        buildCouponPreviewQuote({
          code: "SOMBRE",
          coupon: activeCoupon,
          assignments: [
            { productId: PRODUCT_A_ID, discountPercent: "20" },
          ],
          products: [{ ...products[0], isActive: false }],
          cartItems: [
            { id: PRODUCT_A_ID, slug: "product-a", quantity: 1 },
          ],
          shippingCents: 5_000,
          now: NOW,
        }),
      "cart_changed",
    );
  });

  it("rejects an out-of-stock product", () => {
    expectCouponReason(
      () =>
        buildCouponPreviewQuote({
          code: "SOMBRE",
          coupon: activeCoupon,
          assignments: [
            { productId: PRODUCT_A_ID, discountPercent: "20" },
          ],
          products: [{ ...products[0], stockQuantity: 0 }],
          cartItems: [
            { id: PRODUCT_A_ID, slug: "product-a", quantity: 1 },
          ],
          shippingCents: 5_000,
          now: NOW,
        }),
      "cart_changed",
    );
  });

  it("rejects a quantity above current stock", () => {
    expectCouponReason(
      () =>
        buildCouponPreviewQuote({
          code: "SOMBRE",
          coupon: activeCoupon,
          assignments: [
            { productId: PRODUCT_A_ID, discountPercent: "20" },
          ],
          products: [{ ...products[0], stockQuantity: 1 }],
          cartItems: [
            { id: PRODUCT_A_ID, slug: "product-a", quantity: 2 },
          ],
          shippingCents: 5_000,
          now: NOW,
        }),
      "cart_changed",
    );
  });

  it("maps malformed server money to unavailable", () => {
    expectCouponReason(
      () =>
        buildCouponPreviewQuote({
          code: "SOMBRE",
          coupon: activeCoupon,
          assignments: [
            { productId: PRODUCT_A_ID, discountPercent: "20" },
          ],
          products: [{ ...products[0], price: "10.001" }],
          cartItems: [
            { id: PRODUCT_A_ID, slug: "product-a", quantity: 1 },
          ],
          shippingCents: 5_000,
          now: NOW,
        }),
      "unavailable",
    );
  });

  it.each(["0", "-1", "100.01", "5.001", "not-a-number"])(
    "maps invalid database percentage %j to unavailable",
    (discountPercent) => {
      expectCouponReason(
        () =>
          buildCouponPreviewQuote({
            code: "SOMBRE",
            coupon: activeCoupon,
            assignments: [
              { productId: PRODUCT_A_ID, discountPercent },
            ],
            products,
            cartItems,
            shippingCents: 5_000,
            now: NOW,
          }),
        "unavailable",
      );
    },
  );

  it("maps a product list shorter than the submitted cart to cart_changed", () => {
    expectCouponReason(
      () =>
        buildCouponPreviewQuote({
          code: "SOMBRE",
          coupon: activeCoupon,
          assignments: [
            { productId: PRODUCT_A_ID, discountPercent: "20" },
          ],
          products: [products[0]],
          cartItems,
          shippingCents: 5_000,
          now: NOW,
        }),
      "cart_changed",
    );
  });
});
