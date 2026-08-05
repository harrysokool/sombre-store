import { calculateUnitDiscountCents } from "@/lib/checkout/discounts";
import { parseHkdDecimalToCents } from "@/lib/checkout/money";

/**
 * The promotional unit price for one product, in integer cents.
 *
 * This is display arithmetic only. Nothing here is written to Supabase or sent
 * to Stripe: checkout recalculates the charge from the same source data at
 * session creation, and that calculation remains the authority.
 *
 * It stays identical to the charged price by construction rather than by
 * agreement — the two call the same primitives on the same inputs:
 *
 *   - `parseHkdDecimalToCents` turns the stored `products.price` decimal into
 *     integer cents, exactly as `buildCouponPreviewQuote` does.
 *   - `calculateUnitDiscountCents` applies the basis points with half-up
 *     rounding at the cent, exactly as `calculateDiscountQuote` does per line.
 *
 * There is deliberately no second formula and no floating-point step: the whole
 * path is integer cents, so a rounding difference between what a customer is
 * shown and what Stripe charges cannot arise.
 *
 * Note the discount base is `products.price`, the normal Sombre selling price
 * that checkout charges from — never `products.retail_price`, which is
 * presentational only and is never an input to any charge.
 */
export type PromotionalPrice = {
  originalUnitAmountCents: number;
  discountBasisPoints: number;
  unitDiscountCents: number;
  discountedUnitAmountCents: number;
};

export function calculatePromotionalPrice(
  price: number | string,
  discountBasisPoints: number,
): PromotionalPrice {
  // Supabase returns numeric columns as decimal strings, and the column is
  // typed `number | string`. String() normalizes both, matching how the
  // checkout quote reads the same column.
  const originalUnitAmountCents = parseHkdDecimalToCents(String(price));
  const unitDiscountCents = calculateUnitDiscountCents(
    originalUnitAmountCents,
    discountBasisPoints,
  );

  return {
    originalUnitAmountCents,
    discountBasisPoints,
    unitDiscountCents,
    discountedUnitAmountCents: originalUnitAmountCents - unitDiscountCents,
  };
}
