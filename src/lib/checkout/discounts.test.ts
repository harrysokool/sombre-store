import { describe, expect, it } from "vitest";

import {
  assertDiscountQuoteInvariants,
  calculateDiscountQuote,
  calculateUnitDiscountCents,
} from "./discounts";
import { MAX_CART_ITEM_QUANTITY } from "../cart/limits";

describe("calculateUnitDiscountCents", () => {
  it.each([
    {
      originalUnitAmountCents: 1,
      discountBasisPoints: 4_999,
      expected: 0,
    },
    {
      originalUnitAmountCents: 1,
      discountBasisPoints: 5_000,
      expected: 1,
    },
    {
      originalUnitAmountCents: 101,
      discountBasisPoints: 5_000,
      expected: 51,
    },
    {
      originalUnitAmountCents: 128_000,
      discountBasisPoints: 525,
      expected: 6_720,
    },
    {
      originalUnitAmountCents: 1,
      discountBasisPoints: 1,
      expected: 0,
    },
  ])(
    "rounds $originalUnitAmountCents cents at $discountBasisPoints basis points to $expected cents",
    ({ originalUnitAmountCents, discountBasisPoints, expected }) => {
      expect(
        calculateUnitDiscountCents(
          originalUnitAmountCents,
          discountBasisPoints,
        ),
      ).toBe(expected);
    },
  );
});

describe("calculateDiscountQuote", () => {
  it("calculates quantity greater than one from the rounded unit amount", () => {
    const quote = calculateDiscountQuote(
      [
        {
          productId: "product-a",
          quantity: 3,
          originalUnitAmountCents: 101,
          discountBasisPoints: 5_000,
        },
      ],
      0,
    );

    expect(quote.lines[0]).toEqual({
      productId: "product-a",
      quantity: 3,
      originalUnitAmountCents: 101,
      discountBasisPoints: 5_000,
      unitDiscountCents: 51,
      discountedUnitAmountCents: 50,
      originalLineTotalCents: 303,
      lineDiscountCents: 153,
      discountedLineTotalCents: 150,
    });
  });

  it("supports different percentages and full-price products in one realistic cart", () => {
    const quote = calculateDiscountQuote(
      [
        {
          productId: "maison-margiela-jacket",
          quantity: 2,
          originalUnitAmountCents: 128_000,
          discountBasisPoints: 2_000,
        },
        {
          productId: "maison-margiela-shirt",
          quantity: 1,
          originalUnitAmountCents: 85_000,
          discountBasisPoints: 1_000,
        },
        {
          productId: "maison-margiela-wallet",
          quantity: 1,
          originalUnitAmountCents: 39_900,
          discountBasisPoints: 525,
        },
        {
          productId: "maison-margiela-ring",
          quantity: 1,
          originalUnitAmountCents: 27_500,
        },
      ],
      5_000,
    );

    expect(
      quote.lines.map((line) => ({
        productId: line.productId,
        discountBasisPoints: line.discountBasisPoints,
        unitDiscountCents: line.unitDiscountCents,
      })),
    ).toEqual([
      {
        productId: "maison-margiela-jacket",
        discountBasisPoints: 2_000,
        unitDiscountCents: 25_600,
      },
      {
        productId: "maison-margiela-shirt",
        discountBasisPoints: 1_000,
        unitDiscountCents: 8_500,
      },
      {
        productId: "maison-margiela-wallet",
        discountBasisPoints: 525,
        unitDiscountCents: 2_095,
      },
      {
        productId: "maison-margiela-ring",
        discountBasisPoints: 0,
        unitDiscountCents: 0,
      },
    ]);
    expect(quote).toMatchObject({
      originalSubtotalCents: 408_400,
      discountTotalCents: 61_795,
      discountedSubtotalCents: 346_605,
      shippingCents: 5_000,
      finalTotalCents: 351_605,
    });
  });

  it("keeps an unconfigured product at full price", () => {
    const quote = calculateDiscountQuote(
      [
        {
          productId: "full-price",
          quantity: 2,
          originalUnitAmountCents: 12_345,
        },
      ],
      5_000,
    );

    expect(quote.lines[0]).toMatchObject({
      discountBasisPoints: 0,
      unitDiscountCents: 0,
      discountedUnitAmountCents: 12_345,
      discountedLineTotalCents: 24_690,
    });
    expect(quote.discountTotalCents).toBe(0);
  });

  it("allows a 100 percent product discount", () => {
    const quote = calculateDiscountQuote(
      [
        {
          productId: "free-product",
          quantity: 2,
          originalUnitAmountCents: 12_345,
          discountBasisPoints: 10_000,
        },
      ],
      0,
    );

    expect(quote.lines[0]).toMatchObject({
      unitDiscountCents: 12_345,
      discountedUnitAmountCents: 0,
      lineDiscountCents: 24_690,
      discountedLineTotalCents: 0,
    });
    expect(quote.discountedSubtotalCents).toBe(0);
  });

  it("charges full shipping when the product is discounted 100 percent", () => {
    const quote = calculateDiscountQuote(
      [
        {
          productId: "free-product",
          quantity: 1,
          originalUnitAmountCents: 50_000,
          discountBasisPoints: 10_000,
        },
      ],
      5_000,
    );

    expect(quote).toMatchObject({
      originalSubtotalCents: 50_000,
      discountTotalCents: 50_000,
      discountedSubtotalCents: 0,
      shippingCents: 5_000,
      finalTotalCents: 5_000,
    });
  });

  it("allows very small discounts to round to zero", () => {
    const quote = calculateDiscountQuote(
      [
        {
          productId: "one-cent",
          quantity: 10,
          originalUnitAmountCents: 1,
          discountBasisPoints: 1,
        },
      ],
      5_000,
    );

    expect(quote.lines[0].unitDiscountCents).toBe(0);
    expect(quote.discountTotalCents).toBe(0);
    expect(quote.finalTotalCents).toBe(5_010);
  });

  it("is deterministic for the same original input", () => {
    const input = [
      {
        productId: "product-a",
        quantity: 4,
        originalUnitAmountCents: 22_222,
        discountBasisPoints: 1_250,
      },
    ] as const;

    expect(calculateDiscountQuote(input, 5_000)).toEqual(
      calculateDiscountQuote(input, 5_000),
    );
  });

  it("does not compound when reapplied from the original unit amount", () => {
    const firstQuote = calculateDiscountQuote(
      [
        {
          productId: "product-a",
          quantity: 1,
          originalUnitAmountCents: 10_000,
          discountBasisPoints: 2_000,
        },
      ],
      5_000,
    );
    const reappliedQuote = calculateDiscountQuote(
      [
        {
          productId: firstQuote.lines[0].productId,
          quantity: firstQuote.lines[0].quantity,
          originalUnitAmountCents:
            firstQuote.lines[0].originalUnitAmountCents,
          discountBasisPoints: 2_000,
        },
      ],
      5_000,
    );

    expect(reappliedQuote).toEqual(firstQuote);
    expect(reappliedQuote.lines[0].discountedUnitAmountCents).toBe(8_000);
  });

  it("accepts the existing maximum cart quantity", () => {
    const quote = calculateDiscountQuote(
      [
        {
          productId: "product-a",
          quantity: MAX_CART_ITEM_QUANTITY,
          originalUnitAmountCents: 1_000,
          discountBasisPoints: 500,
        },
      ],
      0,
    );

    expect(quote.lines[0].quantity).toBe(MAX_CART_ITEM_QUANTITY);
    expect(quote.originalSubtotalCents).toBe(10_000);
  });

  it("rejects duplicate product identifiers", () => {
    expect(() =>
      calculateDiscountQuote(
        [
          {
            productId: "duplicate",
            quantity: 1,
            originalUnitAmountCents: 1_000,
          },
          {
            productId: "duplicate",
            quantity: 2,
            originalUnitAmountCents: 2_000,
          },
        ],
        0,
      ),
    ).toThrowError(/duplicate product ID/i);
  });

  it.each([
    { productId: "product", quantity: 0 },
    { productId: "product", quantity: -1 },
    { productId: "product", quantity: 1.5 },
    { productId: "product", quantity: MAX_CART_ITEM_QUANTITY + 1 },
    { productId: "product", quantity: Number.MAX_SAFE_INTEGER + 1 },
  ])("rejects invalid quantity $quantity", ({ productId, quantity }) => {
    expect(() =>
      calculateDiscountQuote(
        [{ productId, quantity, originalUnitAmountCents: 1_000 }],
        0,
      ),
    ).toThrow();
  });

  it.each([
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects invalid original unit amount %j", (originalUnitAmountCents) => {
    expect(() =>
      calculateDiscountQuote(
        [{ productId: "product", quantity: 1, originalUnitAmountCents }],
        0,
      ),
    ).toThrow();
  });

  it.each([-1, 0, 1.5, 10_001, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid configured basis points %j",
    (discountBasisPoints) => {
      expect(() =>
        calculateDiscountQuote(
          [
            {
              productId: "product",
              quantity: 1,
              originalUnitAmountCents: 1_000,
              discountBasisPoints,
            },
          ],
          0,
        ),
      ).toThrow();
    },
  );

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid shipping %j",
    (shippingCents) => {
      expect(() =>
        calculateDiscountQuote(
          [
            {
              productId: "product",
              quantity: 1,
              originalUnitAmountCents: 1_000,
            },
          ],
          shippingCents,
        ),
      ).toThrow();
    },
  );

  it("rejects an empty cart", () => {
    expect(() => calculateDiscountQuote([], 0)).toThrowError(
      /at least one product/i,
    );
  });

  it.each(["", "   "])("rejects invalid product identifier %j", (productId) => {
    expect(() =>
      calculateDiscountQuote(
        [{ productId, quantity: 1, originalUnitAmountCents: 1_000 }],
        0,
      ),
    ).toThrowError(/product ID/i);
  });

  it("rejects line total overflow", () => {
    expect(() =>
      calculateDiscountQuote(
        [
          {
            productId: "overflow",
            quantity: MAX_CART_ITEM_QUANTITY,
            originalUnitAmountCents: Number.MAX_SAFE_INTEGER,
          },
        ],
        0,
      ),
    ).toThrowError(/supported integer range/i);
  });

  it("rejects final total overflow", () => {
    expect(() =>
      calculateDiscountQuote(
        [
          {
            productId: "overflow",
            quantity: 1,
            originalUnitAmountCents: Number.MAX_SAFE_INTEGER,
          },
        ],
        1,
      ),
    ).toThrowError(/supported integer range/i);
  });
});

describe("assertDiscountQuoteInvariants", () => {
  const getValidQuote = () =>
    calculateDiscountQuote(
      [
        {
          productId: "product-a",
          quantity: 2,
          originalUnitAmountCents: 10_000,
          discountBasisPoints: 2_000,
        },
        {
          productId: "product-b",
          quantity: 1,
          originalUnitAmountCents: 5_000,
        },
      ],
      5_000,
    );

  it("accepts every invariant in a calculated quote", () => {
    const quote = getValidQuote();

    expect(
      quote.lines.reduce(
        (sum, line) => sum + line.originalLineTotalCents,
        0,
      ),
    ).toBe(quote.originalSubtotalCents);
    expect(
      quote.lines.reduce((sum, line) => sum + line.lineDiscountCents, 0),
    ).toBe(quote.discountTotalCents);
    expect(
      quote.lines.reduce(
        (sum, line) => sum + line.discountedLineTotalCents,
        0,
      ),
    ).toBe(quote.discountedSubtotalCents);
    expect(quote.originalSubtotalCents - quote.discountTotalCents).toBe(
      quote.discountedSubtotalCents,
    );
    expect(quote.discountedSubtotalCents + quote.shippingCents).toBe(
      quote.finalTotalCents,
    );
    expect(() => assertDiscountQuoteInvariants(quote)).not.toThrow();
  });

  it("rejects a failed line invariant", () => {
    const quote = getValidQuote();
    const invalidQuote = {
      ...quote,
      lines: [
        { ...quote.lines[0], discountedUnitAmountCents: 8_001 },
        quote.lines[1],
      ],
    };

    expect(() => assertDiscountQuoteInvariants(invalidQuote)).toThrowError(
      /line invariant/i,
    );
  });

  it("rejects a failed total invariant", () => {
    const quote = getValidQuote();

    expect(() =>
      assertDiscountQuoteInvariants({
        ...quote,
        discountTotalCents: quote.discountTotalCents + 1,
      }),
    ).toThrowError(/total invariant/i);
  });
});
