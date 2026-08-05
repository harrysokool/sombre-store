import {
  formatHkdCentsForDatabase,
  parseHkdDecimalToCents,
} from "@/lib/checkout/money";

import { formatPrice } from "./format-price";
import { PROMOTION_COUPON_CODE } from "./promotion";
import { calculatePromotionalPrice } from "./promotion-price";

/**
 * What a product's price area should show.
 *
 * Two shapes, never three prices. When the promotion applies, the normal Sombre
 * selling price is deliberately absent: it is the base the discount is computed
 * from, not something a customer is shown, so the pair reads as retail versus
 * what they will actually pay.
 */
export type ProductPriceDisplay =
  | { kind: "single"; formattedPrice: string }
  | {
      kind: "promotional";
      formattedRetailPrice: string;
      formattedPromotionalPrice: string;
      couponCode: string;
    };

export type ProductPriceDisplayInput = {
  /** The normal Sombre selling price, and the only base the discount uses. */
  price: number | string;
  /** The official retail price, or null when none is published. */
  retailPrice: number | string | null;
  /** Configured basis points, or undefined when the product is not assigned. */
  discountBasisPoints: number | undefined;
};

/**
 * Decides between the promotional pair and the single price already on the site.
 *
 * The promotional pair needs everything to line up: a published retail price, an
 * assignment under the live coupon, and figures that parse. Anything missing
 * falls back to the unchanged single price rather than a partial promotion, so a
 * product with half its data configured looks exactly as it does today.
 *
 * Falls back rather than throwing when a figure cannot be parsed. The money
 * parser is strict, and a single malformed row should cost that one product its
 * promotional display, not take down the whole shop page.
 */
export function getProductPriceDisplay({
  price,
  retailPrice,
  discountBasisPoints,
}: ProductPriceDisplayInput): ProductPriceDisplay {
  const singlePrice: ProductPriceDisplay = {
    kind: "single",
    formattedPrice: formatPrice(price),
  };

  if (retailPrice === null || discountBasisPoints === undefined) {
    return singlePrice;
  }

  try {
    const promotionalPrice = calculatePromotionalPrice(
      price,
      discountBasisPoints,
    );
    const retailPriceCents = parseHkdDecimalToCents(String(retailPrice));

    // A retail price at or below what we are asking for it would render as a
    // struck-through number smaller than the one beside it. That is bad data
    // rather than a promotion, so it shows as an ordinary price instead.
    if (retailPriceCents <= promotionalPrice.discountedUnitAmountCents) {
      return singlePrice;
    }

    return {
      kind: "promotional",
      formattedRetailPrice: formatPrice(retailPrice),
      formattedPromotionalPrice: formatPrice(
        // Back to a decimal string for the shared HKD formatter. Named for its
        // first caller, but it is simply the inverse of parseHkdDecimalToCents:
        // BigInt division and a padded remainder, so the whole path from stored
        // price to displayed price stays on integers and never touches a float.
        formatHkdCentsForDatabase(promotionalPrice.discountedUnitAmountCents),
      ),
      couponCode: PROMOTION_COUPON_CODE,
    };
  } catch {
    return singlePrice;
  }
}
