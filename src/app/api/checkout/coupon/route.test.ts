import { beforeEach, describe, expect, it, vi } from "vitest";

import { CouponPreviewError } from "@/lib/checkout/coupon-quote";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  loadCouponPreview: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
}));

vi.mock("@/lib/checkout/coupons", () => ({
  loadCouponPreview: mocks.loadCouponPreview,
}));

import { COUPON_PREVIEW_RATE_LIMIT, POST } from "./route";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

function previewRequest() {
  return new Request("http://localhost/api/checkout/coupon", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify({
      code: " SOMBRE ",
      cartItems: [
        {
          id: PRODUCT_ID,
          slug: "product-a",
          quantity: 1,
        },
      ],
    }),
  });
}

function oversizedPreviewRequest() {
  return new Request("http://localhost/api/checkout/coupon", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "content-length": String(16 * 1024 + 1),
      "x-forwarded-for": "203.0.113.10",
    },
    body: "{}",
  });
}

function successfulPreview() {
  return {
    couponCode: "SOMBRE",
    quote: {
      lines: [
        {
          productId: PRODUCT_ID,
          quantity: 1,
          originalUnitAmountCents: 100_000,
          discountBasisPoints: 2_000,
          unitDiscountCents: 20_000,
          discountedUnitAmountCents: 80_000,
          originalLineTotalCents: 100_000,
          lineDiscountCents: 20_000,
          discountedLineTotalCents: 80_000,
        },
      ],
      originalSubtotalCents: 100_000,
      discountTotalCents: 20_000,
      discountedSubtotalCents: 80_000,
      shippingCents: 5_000,
      finalTotalCents: 85_000,
    },
  };
}

describe("POST /api/checkout/coupon", () => {
  beforeEach(() => {
    mocks.checkRateLimit.mockReset();
    mocks.getClientIp.mockReset();
    mocks.loadCouponPreview.mockReset();
    mocks.getClientIp.mockReturnValue("203.0.113.10");
    mocks.checkRateLimit.mockResolvedValue({
      isAllowed: true,
      remaining: 19,
      retryAfterSeconds: 0,
    });
  });

  it("returns a no-store preview using the isolated rate-limit namespace", async () => {
    mocks.loadCouponPreview.mockResolvedValue(successfulPreview());

    const response = await POST(previewRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      "coupon-preview:203.0.113.10",
      COUPON_PREVIEW_RATE_LIMIT,
    );
    expect(await response.json()).toMatchObject({
      applicable: true,
      couponCode: "SOMBRE",
      totalMinor: 85_000,
    });
  });

  it("returns 429 with Retry-After without querying coupon data", async () => {
    mocks.checkRateLimit.mockResolvedValue({
      isAllowed: false,
      remaining: 0,
      retryAfterSeconds: 17,
    });

    const response = await POST(previewRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.loadCouponPreview).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      error: "rate_limited",
      message: "Too many coupon attempts. Please wait a moment and try again.",
    });
  });

  it("does not expose why a coupon is unavailable", async () => {
    mocks.loadCouponPreview.mockRejectedValue(
      new CouponPreviewError("invalid_coupon"),
    );

    const response = await POST(previewRequest());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "invalid_coupon",
      message: "This coupon is invalid, expired, or unavailable.",
    });
  });

  it.each([200, 400, 409, 413, 429, 503])(
    "sets Cache-Control: no-store on status %i",
    async (status) => {
      let request = previewRequest();

      switch (status) {
        case 200:
          mocks.loadCouponPreview.mockResolvedValue(successfulPreview());
          break;
        case 400:
          mocks.loadCouponPreview.mockRejectedValue(
            new CouponPreviewError("invalid_coupon"),
          );
          break;
        case 409:
          mocks.loadCouponPreview.mockRejectedValue(
            new CouponPreviewError("cart_changed"),
          );
          break;
        case 413:
          request = oversizedPreviewRequest();
          break;
        case 429:
          mocks.checkRateLimit.mockResolvedValue({
            isAllowed: false,
            remaining: 0,
            retryAfterSeconds: 10,
          });
          break;
        case 503:
          mocks.loadCouponPreview.mockRejectedValue(
            new CouponPreviewError("unavailable"),
          );
          break;
      }

      const response = await POST(request);

      expect(response.status).toBe(status);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    },
  );
});
