import Image from "next/image";
import Link from "next/link";

type ProductCardProps = {
  name: string;
  slug: string;
  brandName: string | null;
  formattedPrice: string;
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
  formattedPrice,
  sizeLabel,
  notes,
  stockQuantity,
  imageUrl,
  imageAlt,
}: ProductCardProps) {
  const isSoldOut = stockQuantity <= 0;

  return (
    <Link
      href={`/products/${slug}`}
      className="group block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950"
    >
      <article>
        {/* The bottle photography is shot on white, so the panel matches it and
            the tile reads as one surface rather than a bordered card. */}
        <div className="relative aspect-square overflow-hidden bg-white">
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
              // Matches the 1 / 2 / 3 / 4 column grid below, so a phone never
              // downloads a desktop-width candidate — and the sub-360px single
              // column is described at its true width (~85vw) rather than the
              // two-column 45vw, which would pick a too-small, soft candidate.
              sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, (min-width: 360px) 45vw, 85vw"
              className={`object-contain p-5 transition-transform duration-700 ease-out sm:p-7 md:group-hover:scale-[1.04] ${
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

        <div className="px-1 pt-5 text-center sm:pt-6">
          {brandName ? (
            <p className="text-[0.6rem] uppercase tracking-[0.24em] text-stone-500">
              {brandName}
            </p>
          ) : null}

          <h2 className="mt-2 font-display text-lg font-normal leading-snug text-stone-100 transition-colors group-hover:text-white sm:text-xl">
            {name}
          </h2>

          {notes ? (
            <p className="mt-2 text-xs leading-6 text-stone-500">{notes}</p>
          ) : null}

          {sizeLabel ? (
            <p className="mt-2 text-[0.65rem] uppercase tracking-[0.2em] text-stone-500">
              {sizeLabel}
            </p>
          ) : null}

          <p className="mt-3 text-sm text-stone-300">
            {isSoldOut ? "Sold out" : formattedPrice}
          </p>
        </div>
      </article>
    </Link>
  );
}
