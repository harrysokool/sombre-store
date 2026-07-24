import {
  addSafeNonNegativeIntegers,
  assertSafeNonNegativeInteger,
  multiplySafeNonNegativeIntegers,
} from "./money";
import { MAX_CART_ITEM_QUANTITY } from "../cart/limits";

const BASIS_POINTS_SCALE = BigInt(10_000);
const HALF_UP_INCREMENT = BigInt(5_000);
const MAX_DISCOUNT_BASIS_POINTS = 10_000;

export type DiscountQuoteInputLine = {
  productId: string;
  quantity: number;
  originalUnitAmountCents: number;
  discountBasisPoints?: number;
};

export type DiscountQuoteLine = {
  productId: string;
  quantity: number;
  originalUnitAmountCents: number;
  discountBasisPoints: number;
  unitDiscountCents: number;
  discountedUnitAmountCents: number;
  originalLineTotalCents: number;
  lineDiscountCents: number;
  discountedLineTotalCents: number;
};

export type DiscountQuote = {
  lines: DiscountQuoteLine[];
  originalSubtotalCents: number;
  discountTotalCents: number;
  discountedSubtotalCents: number;
  shippingCents: number;
  finalTotalCents: number;
};

function assertProductId(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RangeError("Product ID must be a non-empty string.");
  }
}

function assertQuantity(value: unknown) {
  assertSafeNonNegativeInteger(value, "Quantity");

  if (value < 1 || value > MAX_CART_ITEM_QUANTITY) {
    throw new RangeError(
      `Quantity must be between 1 and ${MAX_CART_ITEM_QUANTITY}.`,
    );
  }
}

function normalizeDiscountBasisPoints(value: number | undefined) {
  if (value === undefined) {
    return 0;
  }

  assertSafeNonNegativeInteger(value, "Discount basis points");

  if (value < 1 || value > MAX_DISCOUNT_BASIS_POINTS) {
    throw new RangeError(
      "Configured discount basis points must be between 1 and 10000.",
    );
  }

  return value;
}

export function calculateUnitDiscountCents(
  originalUnitAmountCents: number,
  discountBasisPoints: number,
) {
  assertSafeNonNegativeInteger(
    originalUnitAmountCents,
    "Original unit amount",
  );
  assertSafeNonNegativeInteger(discountBasisPoints, "Discount basis points");

  if (discountBasisPoints > MAX_DISCOUNT_BASIS_POINTS) {
    throw new RangeError(
      "Discount basis points must be between 0 and 10000.",
    );
  }

  const roundedDiscount =
    (BigInt(originalUnitAmountCents) * BigInt(discountBasisPoints) +
      HALF_UP_INCREMENT) /
    BASIS_POINTS_SCALE;

  const unitDiscountCents = Number(roundedDiscount);
  assertSafeNonNegativeInteger(unitDiscountCents, "Unit discount");

  return unitDiscountCents;
}

export function assertDiscountQuoteInvariants(quote: DiscountQuote) {
  assertSafeNonNegativeInteger(
    quote.originalSubtotalCents,
    "Original subtotal",
  );
  assertSafeNonNegativeInteger(quote.discountTotalCents, "Discount total");
  assertSafeNonNegativeInteger(
    quote.discountedSubtotalCents,
    "Discounted subtotal",
  );
  assertSafeNonNegativeInteger(quote.shippingCents, "Shipping");
  assertSafeNonNegativeInteger(quote.finalTotalCents, "Final total");

  const productIds = new Set<string>();

  for (const line of quote.lines) {
    assertProductId(line.productId);

    if (productIds.has(line.productId)) {
      throw new RangeError("Discount quote contains a duplicate product ID.");
    }

    productIds.add(line.productId);
    assertQuantity(line.quantity);
    assertSafeNonNegativeInteger(
      line.originalUnitAmountCents,
      "Original unit amount",
    );
    assertSafeNonNegativeInteger(
      line.discountBasisPoints,
      "Discount basis points",
    );
    assertSafeNonNegativeInteger(line.unitDiscountCents, "Unit discount");
    assertSafeNonNegativeInteger(
      line.discountedUnitAmountCents,
      "Discounted unit amount",
    );
    assertSafeNonNegativeInteger(
      line.originalLineTotalCents,
      "Original line total",
    );
    assertSafeNonNegativeInteger(line.lineDiscountCents, "Line discount");
    assertSafeNonNegativeInteger(
      line.discountedLineTotalCents,
      "Discounted line total",
    );

    if (line.discountBasisPoints > MAX_DISCOUNT_BASIS_POINTS) {
      throw new RangeError("Discount quote has invalid basis points.");
    }

    const expectedUnitDiscount = calculateUnitDiscountCents(
      line.originalUnitAmountCents,
      line.discountBasisPoints,
    );
    const expectedOriginalLine = multiplySafeNonNegativeIntegers(
      line.originalUnitAmountCents,
      line.quantity,
      "Original line total",
    );
    const expectedLineDiscount = multiplySafeNonNegativeIntegers(
      line.unitDiscountCents,
      line.quantity,
      "Line discount",
    );
    const expectedDiscountedLine = multiplySafeNonNegativeIntegers(
      line.discountedUnitAmountCents,
      line.quantity,
      "Discounted line total",
    );

    if (
      line.unitDiscountCents !== expectedUnitDiscount ||
      line.discountedUnitAmountCents !==
        line.originalUnitAmountCents - line.unitDiscountCents ||
      line.originalLineTotalCents !== expectedOriginalLine ||
      line.lineDiscountCents !== expectedLineDiscount ||
      line.discountedLineTotalCents !== expectedDiscountedLine
    ) {
      throw new RangeError("Discount quote line invariant failed.");
    }
  }

  const originalSubtotal = addSafeNonNegativeIntegers(
    quote.lines.map((line) => line.originalLineTotalCents),
    "Original subtotal",
  );
  const discountTotal = addSafeNonNegativeIntegers(
    quote.lines.map((line) => line.lineDiscountCents),
    "Discount total",
  );
  const discountedSubtotal = addSafeNonNegativeIntegers(
    quote.lines.map((line) => line.discountedLineTotalCents),
    "Discounted subtotal",
  );
  const finalTotal = addSafeNonNegativeIntegers(
    [quote.discountedSubtotalCents, quote.shippingCents],
    "Final total",
  );

  if (
    originalSubtotal !== quote.originalSubtotalCents ||
    discountTotal !== quote.discountTotalCents ||
    discountedSubtotal !== quote.discountedSubtotalCents ||
    quote.originalSubtotalCents - quote.discountTotalCents !==
      quote.discountedSubtotalCents ||
    finalTotal !== quote.finalTotalCents
  ) {
    throw new RangeError("Discount quote total invariant failed.");
  }
}

export function calculateDiscountQuote(
  inputLines: readonly DiscountQuoteInputLine[],
  shippingCents: number,
): DiscountQuote {
  if (inputLines.length === 0) {
    throw new RangeError("Discount quote requires at least one product.");
  }

  assertSafeNonNegativeInteger(shippingCents, "Shipping");

  const productIds = new Set<string>();
  const lines = inputLines.map((input): DiscountQuoteLine => {
    assertProductId(input.productId);

    if (productIds.has(input.productId)) {
      throw new RangeError("Discount quote contains a duplicate product ID.");
    }

    productIds.add(input.productId);
    assertQuantity(input.quantity);
    assertSafeNonNegativeInteger(
      input.originalUnitAmountCents,
      "Original unit amount",
    );

    const discountBasisPoints = normalizeDiscountBasisPoints(
      input.discountBasisPoints,
    );
    const unitDiscountCents = calculateUnitDiscountCents(
      input.originalUnitAmountCents,
      discountBasisPoints,
    );
    const discountedUnitAmountCents =
      input.originalUnitAmountCents - unitDiscountCents;
    const originalLineTotalCents = multiplySafeNonNegativeIntegers(
      input.originalUnitAmountCents,
      input.quantity,
      "Original line total",
    );
    const lineDiscountCents = multiplySafeNonNegativeIntegers(
      unitDiscountCents,
      input.quantity,
      "Line discount",
    );
    const discountedLineTotalCents = multiplySafeNonNegativeIntegers(
      discountedUnitAmountCents,
      input.quantity,
      "Discounted line total",
    );

    return {
      productId: input.productId,
      quantity: input.quantity,
      originalUnitAmountCents: input.originalUnitAmountCents,
      discountBasisPoints,
      unitDiscountCents,
      discountedUnitAmountCents,
      originalLineTotalCents,
      lineDiscountCents,
      discountedLineTotalCents,
    };
  });

  const originalSubtotalCents = addSafeNonNegativeIntegers(
    lines.map((line) => line.originalLineTotalCents),
    "Original subtotal",
  );
  const discountTotalCents = addSafeNonNegativeIntegers(
    lines.map((line) => line.lineDiscountCents),
    "Discount total",
  );
  const discountedSubtotalCents = addSafeNonNegativeIntegers(
    lines.map((line) => line.discountedLineTotalCents),
    "Discounted subtotal",
  );
  const finalTotalCents = addSafeNonNegativeIntegers(
    [discountedSubtotalCents, shippingCents],
    "Final total",
  );

  const quote = {
    lines,
    originalSubtotalCents,
    discountTotalCents,
    discountedSubtotalCents,
    shippingCents,
    finalTotalCents,
  };

  assertDiscountQuoteInvariants(quote);

  return quote;
}
