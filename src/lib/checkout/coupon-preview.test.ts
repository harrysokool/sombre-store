import { describe, expect, it } from "vitest";

import {
  getCouponPublicError,
  parseCouponPreviewPayload,
  toCouponPreviewResponse,
} from "./coupon-preview";
import { CouponPreviewError } from "./coupon-quote";
import { calculateDiscountQuote } from "./discounts";

const PRODUCT_A_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B_ID = "22222222-2222-4222-8222-222222222222";

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

describe("parseCouponPreviewPayload", () => {
  it("accepts one code and strips every untrusted cart amount", () => {
    const payload = parseCouponPreviewPayload({
      code: "  sombre  ",
      subtotal: 1,
      shipping: 0,
      discount: 999_999,
      cartItems: [
        {
          id: PRODUCT_A_ID,
          slug: "product-a",
          quantity: 2,
          price: 0.01,
          discountBasisPoints: 10_000,
          lineTotal: 0,
        },
      ],
    });

    expect(payload).toEqual({
      code: "SOMBRE",
      cartItems: [
        {
          id: PRODUCT_A_ID,
          slug: "product-a",
          quantity: 2,
        },
      ],
    });
  });

  it.each([0, -1, 1.5, 11])("rejects invalid quantity %j", (quantity) => {
    expectCouponReason(
      () =>
        parseCouponPreviewPayload({
          code: "SOMBRE",
          cartItems: [
            {
              id: PRODUCT_A_ID,
              slug: "product-a",
              quantity,
            },
          ],
        }),
      "cart_changed",
    );
  });

  it("rejects an invalid product identifier", () => {
    expectCouponReason(
      () =>
        parseCouponPreviewPayload({
          code: "SOMBRE",
          cartItems: [
            {
              id: "not-a-uuid",
              slug: "product-a",
              quantity: 1,
            },
          ],
        }),
      "cart_changed",
    );
  });

  it("rejects duplicate cart products", () => {
    expectCouponReason(
      () =>
        parseCouponPreviewPayload({
          code: "SOMBRE",
          cartItems: [
            { id: PRODUCT_A_ID, slug: "product-a", quantity: 1 },
            { id: PRODUCT_A_ID, slug: "product-a", quantity: 2 },
          ],
        }),
      "cart_changed",
    );
  });

  it("rejects more than 100 cart lines", () => {
    expectCouponReason(
      () =>
        parseCouponPreviewPayload({
          code: "SOMBRE",
          cartItems: Array.from({ length: 101 }, (_, index) => ({
            id: `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`,
            slug: `product-${index}`,
            quantity: 1,
          })),
        }),
      "cart_changed",
    );
  });
});

describe("toCouponPreviewResponse", () => {
  it("returns integer minor units for every cart line", () => {
    const quote = calculateDiscountQuote(
      [
        {
          productId: PRODUCT_A_ID,
          quantity: 2,
          originalUnitAmountCents: 100_000,
          discountBasisPoints: 2_000,
        },
        {
          productId: PRODUCT_B_ID,
          quantity: 1,
          originalUnitAmountCents: 100_000,
        },
      ],
      5_000,
    );

    expect(
      toCouponPreviewResponse({ couponCode: "SOMBRE", quote }),
    ).toEqual({
      applicable: true,
      couponCode: "SOMBRE",
      currency: "hkd",
      originalSubtotalMinor: 300_000,
      discountMinor: 40_000,
      discountedSubtotalMinor: 260_000,
      shippingMinor: 5_000,
      totalMinor: 265_000,
      items: [
        {
          productId: PRODUCT_A_ID,
          quantity: 2,
          discountBasisPoints: 2_000,
          originalUnitMinor: 100_000,
          unitDiscountMinor: 20_000,
          discountedUnitMinor: 80_000,
          originalLineMinor: 200_000,
          discountMinor: 40_000,
          discountedLineMinor: 160_000,
        },
        {
          productId: PRODUCT_B_ID,
          quantity: 1,
          discountBasisPoints: 0,
          originalUnitMinor: 100_000,
          unitDiscountMinor: 0,
          discountedUnitMinor: 100_000,
          originalLineMinor: 100_000,
          discountMinor: 0,
          discountedLineMinor: 100_000,
        },
      ],
    });
  });
});

describe("getCouponPublicError", () => {
  it.each([
    "malformed",
    "unknown",
    "inactive",
    "future",
    "expired",
  ])("uses the same public error for %s coupons", () => {
    const error = getCouponPublicError(
      new CouponPreviewError("invalid_coupon"),
    );

    expect(error).toEqual({
      code: "invalid_coupon",
      message: "This coupon is invalid, expired, or unavailable.",
      status: 400,
    });
  });

  it("uses the specific not-applicable message only after validation", () => {
    expect(
      getCouponPublicError(new CouponPreviewError("not_applicable")),
    ).toMatchObject({
      code: "not_applicable",
      message: "This coupon does not apply to the items in your cart.",
    });
  });

  it("maps unknown failures to a safe unavailable response", () => {
    expect(getCouponPublicError(new Error("database details"))).toEqual({
      code: "unavailable",
      message: "Coupon preview is temporarily unavailable.",
      status: 503,
    });
  });
});
