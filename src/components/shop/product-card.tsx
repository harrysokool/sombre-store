import Image from "next/image";
import Link from "next/link";

import { ProductPrice } from "@/components/product/product-price";
import type { ProductPriceDisplay } from "@/lib/storefront/promotion-display";

// Matches the 1 / 2 / 3 / 4 column grid on the shop page at its current
// gutters, so a phone never downloads a desktop-width candidate — and the
// sub-360px single column is described at its true width (~90vw) rather than
// the two-column 47vw, which would pick a too-small, soft candidate.
// `object-contain` fits a squarish source to the width of the 4/5 box, so
// these stay width-based.
const MEDIA_SIZES =
  "(min-width: 1280px) 23vw, (min-width: 768px) 30vw, (min-width: 360px) 47vw, 90vw";

// Shared by both layers, so a crossfading pair scales together and reads as one
// image changing rather than as two stacked ones.
const MEDIA_BASE = "object-contain p-3 ease-out sm:p-4 md:group-hover:scale-[1.04]";

// `md:` keeps the swap off phones, matching the zoom beside it, and
// `motion-safe:` drops it entirely for a reader who has asked for less motion —
// leaving them the primary image, held still.
const CROSSFADE = "transition-[opacity,transform] duration-700";

type ProductCardProps = {
  name: string;
  slug: string;
  brandName: string | null;
  priceDisplay: ProductPriceDisplay;
  sizeLabel: string | null;
  /** Fragrance notes, shown between the name and the size when present. */
  notes: string | null;
  stockQuantity: number;
  imageUrl: string | null;
  imageAlt: string | null;
  /**
   * A second view of the product, crossfaded in on hover. Null whenever the
   * product has only one image, which leaves the tile exactly as it was.
   *
   * No alt text travels with it: it is only ever reachable by hovering a
   * pointer, so it is decorative here and is hidden from assistive technology
   * rather than announced a second time. See the render below.
   */
  hoverImageUrl?: string | null;
};

export function ProductCard({
  name,
  slug,
  brandName,
  priceDisplay,
  sizeLabel,
  notes,
  stockQuantity,
  imageUrl,
  imageAlt,
  hoverImageUrl = null,
}: ProductCardProps) {
  const isSoldOut = stockQuantity <= 0;
  // Notes and size share one muted line — "Spiced warmth · 100 mL" — rather
  // than taking a row each. Either half may be missing, so the separator is
  // only drawn when both are actually present.
  //
  // Notes are authored as sentences ("Spiced warmth and polished woods."), so
  // the full stop is dropped when a size follows it: mid-line it reads as a
  // stray mark rather than as punctuation. A note standing on its own keeps it.
  const detailLine = [
    notes && sizeLabel ? notes.replace(/\.\s*$/, "") : notes,
    sizeLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/products/${slug}`}
      className="group block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950"
    >
      <article>
        {/* The bottle photography is shot on white, so the panel matches it and
            the tile reads as one surface rather than a bordered card. Portrait
            rather than square: bottles are taller than they are wide, so 4/5
            gives the product more of the tile without widening the column. */}
        <div className="relative aspect-[4/5] overflow-hidden bg-white">
          {isSoldOut ? (
            <span className="absolute left-3 top-3 z-10 bg-stone-950 px-3 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-stone-100">
              Sold out
            </span>
          ) : null}

          {imageUrl ? (
            <>
              <Image
                src={imageUrl}
                alt={imageAlt ?? `${name} product image`}
                fill
                sizes={MEDIA_SIZES}
                className={`${MEDIA_BASE} ${
                  hoverImageUrl
                    ? `${CROSSFADE} motion-safe:md:group-hover:opacity-0`
                    : "transition-transform duration-700"
                } ${isSoldOut ? "opacity-60" : ""}`}
              />

              {/* Decorative: reachable only by hovering a pointer, so it is
                  hidden from assistive technology rather than announced as a
                  second image of a product already named by the tile. Empty
                  alt is the correct alt here, not a missing one. */}
              {hoverImageUrl ? (
                <Image
                  src={hoverImageUrl}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes={MEDIA_SIZES}
                  className={`${MEDIA_BASE} ${CROSSFADE} opacity-0 ${
                    // Sold-out dimming has to survive the swap, or the tile
                    // would brighten under the pointer as it changes image.
                    isSoldOut
                      ? "motion-safe:md:group-hover:opacity-60"
                      : "motion-safe:md:group-hover:opacity-100"
                  }`}
                />
              ) : null}
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-[0.6rem] uppercase tracking-[0.24em] text-stone-500">
                Image coming soon
              </p>
            </div>
          )}
        </div>

        {/* Full tile width, no inset: the text then aligns to the same edges as
            the photography above it, and the price line gets every pixel it can
            in the narrow two-column mobile grid. */}
        <div className="pt-5 text-center sm:pt-6">
          {brandName ? (
            <p className="text-[0.6rem] uppercase tracking-[0.24em] text-stone-400">
              {brandName}
            </p>
          ) : null}

          {/* Two lines, always: clamped so a long name cannot run away, and
              floored at the same two lines so a one-line name reserves the
              space a two-line one would take. Without the floor, "Jazz Club"
              and "By the Fireplace" sit side by side with their prices at
              different heights. `2lh` is exactly twice the computed line box,
              so it tracks the font size across the breakpoint on its own. */}
          <h2 className="mt-2 line-clamp-2 min-h-[2lh] font-display text-lg font-normal leading-snug text-stone-100 transition-colors group-hover:text-white sm:text-xl">
            {name}
          </h2>

          {/* Always rendered, for the same reason: the slot holds its two lines
              whether the copy fills them, half-fills them, or is missing
              entirely, so every tile in a row puts its price at one height. */}
          <p className="mt-2 line-clamp-2 min-h-[2lh] text-xs leading-5 text-stone-400">
            {detailLine}
          </p>

          <p className="mt-3 text-sm text-stone-300">
            {isSoldOut ? (
              "Sold out"
            ) : (
              <ProductPrice display={priceDisplay} variant="card" />
            )}
          </p>
        </div>
      </article>
    </Link>
  );
}
