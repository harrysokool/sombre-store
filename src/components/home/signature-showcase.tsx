import Image from "next/image";
import Link from "next/link";

import { formatPrice } from "@/lib/storefront/format-price";
import type { ProductListItem } from "@/lib/storefront/shop";

type SignatureShowcaseProps = {
  eyebrow: string;
  heading: string;
  products: ProductListItem[];
  viewAllHref: string;
};

export function SignatureShowcase({
  eyebrow,
  heading,
  products,
  viewAllHref,
}: SignatureShowcaseProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="overflow-hidden">
      <div className="px-6 text-center sm:px-10 lg:px-12">
        <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-500 sm:text-xs">
          {eyebrow}
        </p>
        <h2 className="mt-5 font-display text-4xl font-light leading-none text-stone-100 sm:text-5xl">
          {heading}
        </h2>
      </div>

      {/* One row that reads as a grid on desktop and a snapping carousel on
          phones. The trailing spacer lets the last card centre itself. */}
      <div className="mt-12 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-10 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:pb-0 lg:grid-cols-5 lg:px-12 [&::-webkit-scrollbar]:hidden">
        {products.map((product) => (
          <Link
            key={product.slug}
            href={`/products/${product.slug}`}
            className="group w-[72%] shrink-0 snap-center md:w-auto md:shrink"
          >
            <article>
              {/* The bottle photography is shot on pure white, so the panel
                  matches it exactly - a warmer tone leaves a visible seam where
                  the photo's own background meets the tile. */}
              <div className="relative aspect-square overflow-hidden bg-white">
                {product.primaryImage ? (
                  <Image
                    src={product.primaryImage.image_url}
                    alt={
                      product.primaryImage.alt_text ??
                      `${product.name} fragrance bottle`
                    }
                    fill
                    sizes="(min-width: 768px) 20vw, 72vw"
                    className="object-contain p-6 transition-transform duration-700 ease-out group-hover:scale-[1.04] sm:p-8"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-[0.65rem] uppercase tracking-[0.24em] text-stone-500">
                      Image coming soon
                    </p>
                  </div>
                )}
              </div>

              <div className="px-2 pt-6 text-center">
                <h3 className="font-display text-xl font-normal leading-snug text-stone-100">
                  {product.name}
                </h3>
                <p className="mt-2 text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
                  {product.size_label ?? "Eau de Toilette"}
                </p>
                <p className="mt-3 text-sm text-stone-300">
                  {product.stock_quantity > 0
                    ? formatPrice(product.price)
                    : "Sold out"}
                </p>
              </div>
            </article>
          </Link>
        ))}
        <div className="w-3 shrink-0 md:hidden" aria-hidden="true" />
      </div>

      <div className="mt-14 text-center">
        <Link
          href={viewAllHref}
          className="inline-block border-b border-stone-600 pb-1 text-xs uppercase tracking-[0.28em] text-stone-200 transition-colors hover:border-stone-300 hover:text-white"
        >
          View the collection
        </Link>
      </div>
    </section>
  );
}
