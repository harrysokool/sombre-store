import type { ProductPriceDisplay } from "@/lib/storefront/promotion-display";

type ProductPriceProps = {
  display: ProductPriceDisplay;
  /**
   * "compact" for the product cards on the shop grid and the homepage row;
   * "detail" for the product page, where the price sits on its own line and
   * carries more weight.
   */
  variant?: "compact" | "detail";
};

// Renders content only, no wrapper, so each caller keeps its existing element
// and spacing: a <p> in the cards, a <dd> on the product page. Only spans are
// used, which stays valid inside a <p>.
const VARIANT_CLASSES = {
  compact: {
    retail: "text-[0.7rem] uppercase tracking-[0.16em] text-stone-400",
    promotional: "mt-1 text-sm text-stone-200",
  },
  detail: {
    retail: "text-xs uppercase tracking-[0.16em] text-stone-400",
    promotional: "mt-1.5 text-2xl font-light text-stone-100",
  },
} as const;

/**
 * A product's price area: either the single price the site has always shown, or
 * the promotional pair.
 *
 * The pair is deliberately only two figures. The normal selling price is the
 * base the discount was computed from and is not shown, so a customer compares
 * the official retail price against what they will actually pay.
 *
 * The coupon is not applied automatically, so the code stays on screen beside
 * the lower figure — it is the instruction for how to reach that price, not a
 * decoration.
 */
export function ProductPrice({
  display,
  variant = "compact",
}: ProductPriceProps) {
  if (display.kind === "single") {
    return <>{display.formattedPrice}</>;
  }

  const classes = VARIANT_CLASSES[variant];

  return (
    <>
      <span className={`block ${classes.retail}`}>
        Retail{" "}
        {/* <s> carries "no longer accurate" to a screen reader; the class
            guarantees the rule is drawn regardless of any CSS reset. */}
        <s className="line-through decoration-stone-500">
          {display.formattedRetailPrice}
        </s>
      </span>
      <span className={`block ${classes.promotional}`}>
        {display.formattedPromotionalPrice} w/ {display.couponCode}
      </span>
    </>
  );
}
