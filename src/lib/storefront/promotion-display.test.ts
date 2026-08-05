import { describe, expect, it } from "vitest";

import { PROMOTION_COUPON_CODE } from "./promotion";
import { getProductPriceDisplay } from "./promotion-display";

describe("getProductPriceDisplay", () => {
  describe("promotional pair", () => {
    it("pairs the retail price with the discounted selling price", () => {
      // HK$800.00 selling price less 20% is HK$640.00, shown against a
      // HK$1,000.00 retail price.
      const display = getProductPriceDisplay({
        price: "800.00",
        retailPrice: "1000.00",
        discountBasisPoints: 2_000,
      });

      expect(display).toEqual({
        kind: "promotional",
        formattedRetailPrice: "HK$1,000.00",
        formattedPromotionalPrice: "HK$640.00",
        couponCode: PROMOTION_COUPON_CODE,
      });
    });

    it("computes the lower price from the selling price, not the retail price", () => {
      // 20% off the HK$1,000.00 retail price would be HK$800.00. The discount
      // applies to the selling price, so the answer must be HK$640.00.
      const display = getProductPriceDisplay({
        price: "800.00",
        retailPrice: "1000.00",
        discountBasisPoints: 2_000,
      });

      expect(display).toMatchObject({
        formattedPromotionalPrice: "HK$640.00",
      });
      expect(display).not.toMatchObject({
        formattedPromotionalPrice: "HK$800.00",
      });
    });

    it("never carries the normal selling price into the display", () => {
      const display = getProductPriceDisplay({
        price: "800.00",
        retailPrice: "1000.00",
        discountBasisPoints: 2_000,
      });

      // Only two figures reach the page; the base of the calculation is not one
      // of them.
      expect(JSON.stringify(display)).not.toContain("800");
    });

    it("names the coupon from the shared constant", () => {
      const display = getProductPriceDisplay({
        price: "1000.00",
        retailPrice: "1500.00",
        discountBasisPoints: 3_600,
      });

      expect(display).toMatchObject({ couponCode: "HAPPY2026" });
    });

    it("reads a numeric price and retail price as well as decimal strings", () => {
      expect(
        getProductPriceDisplay({
          price: 800,
          retailPrice: 1000,
          discountBasisPoints: 2_000,
        }),
      ).toEqual(
        getProductPriceDisplay({
          price: "800.00",
          retailPrice: "1000.00",
          discountBasisPoints: 2_000,
        }),
      );
    });

    it("rounds the lower price the way checkout rounds it", () => {
      // 10.01 at 50% is a discount of exactly 5.005. Half-up rounds the
      // discount to 5.01, which leaves 5.00 to pay — the same figure checkout
      // arrives at, since both round the discount rather than the price.
      const display = getProductPriceDisplay({
        price: "10.01",
        retailPrice: "20.00",
        discountBasisPoints: 5_000,
      });

      expect(display).toMatchObject({
        formattedPromotionalPrice: "HK$5.00",
      });
    });
  });

  describe("fallback to the single price", () => {
    it("keeps the single price when no retail price is published", () => {
      const display = getProductPriceDisplay({
        price: "800.00",
        retailPrice: null,
        discountBasisPoints: 2_000,
      });

      expect(display).toEqual({
        kind: "single",
        formattedPrice: "HK$800.00",
      });
    });

    it("keeps the single price when the product has no assignment", () => {
      const display = getProductPriceDisplay({
        price: "800.00",
        retailPrice: "1000.00",
        discountBasisPoints: undefined,
      });

      expect(display).toEqual({
        kind: "single",
        formattedPrice: "HK$800.00",
      });
    });

    it("keeps the single price when both are missing", () => {
      const display = getProductPriceDisplay({
        price: "800.00",
        retailPrice: null,
        discountBasisPoints: undefined,
      });

      expect(display).toMatchObject({ kind: "single" });
    });

    // Bad data rather than a promotion: a struck-through figure below the one
    // beside it would read as a price rise.
    it("keeps the single price when the retail price is below the discounted price", () => {
      const display = getProductPriceDisplay({
        price: "800.00",
        retailPrice: "500.00",
        discountBasisPoints: 2_000,
      });

      expect(display).toMatchObject({ kind: "single" });
    });

    it("keeps the single price when the retail price equals the discounted price", () => {
      const display = getProductPriceDisplay({
        price: "800.00",
        retailPrice: "640.00",
        discountBasisPoints: 2_000,
      });

      expect(display).toMatchObject({ kind: "single" });
    });

    // One malformed row costs that product its promotion, not the whole page.
    it("falls back rather than throwing on an unparseable price", () => {
      const display = getProductPriceDisplay({
        price: "8.001",
        retailPrice: "1000.00",
        discountBasisPoints: 2_000,
      });

      expect(display).toMatchObject({ kind: "single" });
    });

    it("falls back rather than throwing on an unparseable retail price", () => {
      const display = getProductPriceDisplay({
        price: "800.00",
        retailPrice: "not-a-price",
        discountBasisPoints: 2_000,
      });

      expect(display).toMatchObject({ kind: "single" });
    });

    it("falls back rather than throwing on out-of-range basis points", () => {
      const display = getProductPriceDisplay({
        price: "800.00",
        retailPrice: "1000.00",
        discountBasisPoints: 10_001,
      });

      expect(display).toMatchObject({ kind: "single" });
    });
  });
});
