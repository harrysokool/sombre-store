import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { formatPrice } from "@/lib/storefront/format-price";

type ProductInfoProps = {
  id: string;
  slug: string;
  name: string;
  price: number | string;
  sizeLabel: string | null;
  shortDescription: string | null;
  description: string | null;
  isFeatured: boolean;
  brandName: string | null;
  categoryName: string | null;
  imageUrl: string | null;
};

export function ProductInfo({
  id,
  slug,
  name,
  price,
  sizeLabel,
  shortDescription,
  description,
  isFeatured,
  brandName,
  categoryName,
  imageUrl,
}: ProductInfoProps) {
  return (
    <div className="space-y-10 lg:pt-6">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.34em] text-stone-500">
          <span>{brandName ?? "Unbranded"}</span>
          <span className="text-stone-700">/</span>
          <span>{categoryName ?? "Uncategorized"}</span>
        </div>

        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-4xl font-medium leading-tight tracking-[0.1em] text-stone-100 sm:text-5xl lg:text-[3.6rem]">
              {name}
            </h1>
            {isFeatured ? (
              <span className="text-[11px] uppercase tracking-[0.24em] text-stone-500">
                Featured
              </span>
            ) : null}
          </div>

          {shortDescription ? (
            <p className="max-w-xl text-lg leading-8 text-stone-300">
              {shortDescription}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-10 gap-y-5 border-y border-white/10 py-7">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
            Price
          </p>
          <p className="text-3xl font-medium text-stone-100">
            {formatPrice(price)}
          </p>
        </div>

        {sizeLabel ? (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
              Size
            </p>
            <p className="text-sm uppercase tracking-[0.18em] text-stone-300">
              {sizeLabel}
            </p>
          </div>
        ) : null}
      </div>

      <div className="pt-1">
        <AddToCartButton
          product={{
            id,
            slug,
            name,
            price,
            size_label: sizeLabel,
            image_url: imageUrl,
          }}
        />
      </div>

      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
          Product Details
        </p>
        <p className="max-w-2xl text-base leading-8 text-stone-400">
          {description ?? "Details for this selection are coming soon."}
        </p>
      </div>
    </div>
  );
}
