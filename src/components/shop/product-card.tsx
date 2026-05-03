import Image from "next/image";
import Link from "next/link";

type ProductCardProps = {
  name: string;
  slug: string;
  shortDescription: string | null;
  formattedPrice: string;
  sizeLabel: string | null;
  isFeatured: boolean;
  imageUrl: string | null;
  imageAlt: string | null;
};

export function ProductCard({
  name,
  slug,
  shortDescription,
  formattedPrice,
  sizeLabel,
  isFeatured,
  imageUrl,
  imageAlt,
}: ProductCardProps) {
  return (
    <Link
      href={`/products/${slug}`}
      className="group block"
    >
      <article className="space-y-6">
        <div className="overflow-hidden rounded-[2rem] bg-white/[0.02]">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt ?? `${name} product image`}
              width={720}
              height={900}
              className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center bg-white/[0.02]">
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                No image
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-medium tracking-[0.06em] text-stone-100">
                {name}
              </h2>
              {sizeLabel ? (
                <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                  {sizeLabel}
                </p>
              ) : null}
            </div>

            {isFeatured ? (
              <span className="text-[11px] uppercase tracking-[0.24em] text-stone-500">
                Featured
              </span>
            ) : null}
          </div>

          {shortDescription ? (
            <p className="max-w-sm text-sm leading-7 text-stone-400">
              {shortDescription}
            </p>
          ) : null}

          <div className="flex items-end justify-between gap-4 pt-2">
            <p className="text-base font-medium text-stone-100">{formattedPrice}</p>
            <p className="text-sm uppercase tracking-[0.22em] text-stone-500 transition-colors group-hover:text-stone-300">
              View Product
            </p>
          </div>
        </div>
      </article>
    </Link>
  );
}
