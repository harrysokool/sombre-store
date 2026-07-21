import Image from "next/image";
import Link from "next/link";

type ProductCardProps = {
  name: string;
  slug: string;
  brandName: string | null;
  formattedPrice: string;
  sizeLabel: string | null;
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
  stockQuantity,
  imageUrl,
  imageAlt,
}: ProductCardProps) {
  return (
    <Link href={`/products/${slug}`} className="group block h-full">
      <article className="flex h-full flex-col">
        <div className="relative overflow-hidden rounded-lg border border-white/10 bg-white">
          {stockQuantity <= 0 ? (
            <span className="absolute left-3 top-3 z-10 rounded-full bg-stone-950 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-stone-100">
              Sold out
            </span>
          ) : null}
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt ?? `${name} product image`}
              width={720}
              height={900}
              className="aspect-[4/5] w-full object-contain p-4 transition-transform duration-500 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center bg-white">
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                No image
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between gap-5 pt-5">
          <div className="space-y-3">
            {brandName ? (
              <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
                {brandName}
              </p>
            ) : null}
            <h2 className="text-xl font-medium leading-snug text-stone-100">
              {name}
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
              <p className="text-sm text-stone-400">
                {sizeLabel ?? "Fragrance"}
              </p>
              <p className="text-base font-medium text-stone-100">
                {formattedPrice}
              </p>
            </div>
            <p className="text-sm uppercase tracking-[0.2em] text-stone-500 transition-colors group-hover:text-stone-200">
              {stockQuantity > 0 ? "View Product" : "Sold out"}
            </p>
          </div>
        </div>
      </article>
    </Link>
  );
}
