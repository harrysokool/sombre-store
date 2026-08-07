import Image from "next/image";
import Link from "next/link";

import { ProductPrice } from "@/components/product/product-price";
import type { ProductPriceDisplay } from "@/lib/storefront/promotion-display";

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
            <Image
              src={imageUrl}
              alt={imageAlt ?? `${name} product image`}
              fill
              // Matches the 1 / 2 / 3 / 4 column grid below at its current
              // gutters, so a phone never downloads a desktop-width candidate —
              // and the sub-360px single column is described at its true width
              // (~85vw) rather than the two-column 46vw, which would pick a
              // too-small, soft candidate. `object-contain` fits a squarish
              // source to the width of the 4/5 box, so these stay width-based.
              sizes="(min-width: 1280px) 23vw, (min-width: 768px) 30vw, (min-width: 360px) 46vw, 85vw"
              className={`object-contain p-3 transition-transform duration-700 ease-out sm:p-4 md:group-hover:scale-[1.04] ${
                isSoldOut ? "opacity-60" : ""
              }`}
            />
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

          <h2 className="mt-2 font-display text-lg font-normal leading-snug text-stone-100 transition-colors group-hover:text-white sm:text-xl">
            {name}
          </h2>

          {detailLine ? (
            // Clamped so a long note cannot push one tile's price out of line
            // with its neighbours across a row.
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-stone-400">
              {detailLine}
            </p>
          ) : null}

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
