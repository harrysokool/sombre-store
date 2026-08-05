import { describe, expect, it } from "vitest";

import { calculateDiscountQuote } from "@/lib/checkout/discounts";

import { calculatePromotionalPrice } from "./promotion-price";

// What checkout would charge for a single unit of the same product at the same
// configured percentage. Going through calculateDiscountQuote rather than
// reimplementing the arithmetic is the point: these tests compare the displayed
// price against the real charging path, not against a copy of it.
function checkoutDiscountedUnitCents(
  originalUnitAmountCents: number,
  discountBasisPoints: number,
) {
  const quote = calculateDiscountQuote(
    [
      {
        productId: "11111111-1111-4111-8111-111111111111",
        quantity: 1,
        originalUnitAmountCents,
        discountBasisPoints,
      },
    ],
    0,
  );

  return quote.lines[0].discountedUnitAmountCents;
}

describe("calculatePromotionalPrice", () => {
  it("applies a percentage to the selling price", () => {
    // HK$1000.00 less 36% is HK$640.00.
    const price = calculatePromotionalPrice("1000.00", 3_600);

    expect(price.originalUnitAmountCents).toBe(100_000);
    expect(price.unitDiscountCents).toBe(36_000);
    expect(price.discountedUnitAmountCents).toBe(64_000);
  });

  it("reads a numeric price as well as Supabase's decimal string", () => {
    // The column is typed `number | string`; both must land on the same cents.
    expect(calculatePromotionalPrice(1000, 3_600)).toEqual(
      calculatePromotionalPrice("1000.00", 3_600),
    );
  });

  it("keeps every amount an integer number of cents", () => {
    const price = calculatePromotionalPrice("999.99", 3_333);

    expect(Number.isInteger(price.originalUnitAmountCents)).toBe(true);
    expect(Number.isInteger(price.unitDiscountCents)).toBe(true);
    expect(Number.isInteger(price.discountedUnitAmountCents)).toBe(true);
  });

  it("reports a discount that reconciles with the original", () => {
    const price = calculatePromotionalPrice("845.50", 2_750);

    expect(
      price.originalUnitAmountCents - price.unitDiscountCents,
    ).toBe(price.discountedUnitAmountCents);
  });

  describe("rounding parity with checkout", () => {
    // Half-up at the cent, matching calculateUnitDiscountCents. 10.01 at 50%
    // is exactly 5.005, which must round up to 5.01 rather than down.
    it("rounds a half-cent up, as the charged price does", () => {
      const price = calculatePromotionalPrice("10.01", 5_000);

      expect(price.unitDiscountCents).toBe(501);
      expect(price.discountedUnitAmountCents).toBe(
        checkoutDiscountedUnitCents(1_001, 5_000),
      );
    });

    // A spread of awkward prices and percentages: repeating decimals, exact
    // halves, and percentages with their own fractional part.
    const cases: { price: string; basisPoints: number }[] = [
      { price: "1000.00", basisPoints: 3_600 },
      { price: "999.99", basisPoints: 3_333 },
      { price: "10.01", basisPoints: 5_000 },
      { price: "3.33", basisPoints: 3_333 },
      { price: "0.01", basisPoints: 5_000 },
      { price: "0.03", basisPoints: 1_667 },
      { price: "845.50", basisPoints: 2_750 },
      { price: "1250.75", basisPoints: 6_000 },
      { price: "87.45", basisPoints: 1_250 },
      { price: "1000.00", basisPoints: 10_000 },
      { price: "640.00", basisPoints: 1 },
    ];

    it.each(cases)(
      "matches checkout for $price at $basisPoints basis points",
      ({ price, basisPoints }) => {
        const displayed = calculatePromotionalPrice(price, basisPoints);

        expect(displayed.discountedUnitAmountCents).toBe(
          checkoutDiscountedUnitCents(
            displayed.originalUnitAmountCents,
            basisPoints,
          ),
        );
      },
    );

    it("never rounds a full discount into a negative price", () => {
      const price = calculatePromotionalPrice("1000.00", 10_000);

      expect(price.discountedUnitAmountCents).toBe(0);
    });
  });

  describe("rejected input", () => {
    // The shared money parser is strict on purpose; a price it cannot read must
    // fail loudly rather than silently display a wrong figure.
    it("rejects a price with more than two decimal places", () => {
      expect(() => calculatePromotionalPrice("10.001", 5_000)).toThrow(
        RangeError,
      );
    });

    it("rejects a negative price", () => {
      expect(() => calculatePromotionalPrice("-10.00", 5_000)).toThrow(
        RangeError,
      );
    });

    it("rejects basis points above one hundred percent", () => {
      expect(() => calculatePromotionalPrice("10.00", 10_001)).toThrow(
        RangeError,
      );
    });
  });
});
