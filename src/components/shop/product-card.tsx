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
      className="group flex h-full flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
    >
      <div className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-stone-900/80">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt ?? `${name} product image`}
              width={720}
              height={900}
              className="aspect-[4/5] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center bg-white/[0.02]">
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                No image
              </p>
            </div>
          )}
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-xl font-medium tracking-[0.08em] text-stone-100">
              {name}
            </h2>
            {shortDescription ? (
              <p className="max-w-xs text-sm leading-6 text-stone-400">
                {shortDescription}
              </p>
            ) : null}
          </div>

          {isFeatured ? (
            <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-stone-300">
              Featured
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-10 flex items-end justify-between gap-4">
        <p className="text-lg font-medium text-stone-100">{formattedPrice}</p>
        {sizeLabel ? (
          <p className="text-sm uppercase tracking-[0.18em] text-stone-500">
            {sizeLabel}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
