import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { formatPrice } from "@/lib/storefront/format-price";

type ProductInfoProps = {
  id: string;
  slug: string;
  name: string;
  price: number | string;
  sizeLabel: string | null;
  stockQuantity: number;
  shortDescription: string | null;
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
  stockQuantity,
  shortDescription,
  brandName,
  categoryName,
  imageUrl,
}: ProductInfoProps) {
  const isSoldOut = stockQuantity <= 0;

  return (
    <div>
      <div className="space-y-8">
        <div className="space-y-5">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.65rem] uppercase tracking-[0.34em] text-stone-500">
            {brandName ? <span>{brandName}</span> : null}
            {brandName && categoryName ? (
              <span aria-hidden="true" className="text-stone-700">
                /
              </span>
            ) : null}
            {categoryName ? <span>{categoryName}</span> : null}
          </p>

          <h1 className="font-display text-4xl font-light leading-[1.05] text-stone-100 sm:text-5xl lg:text-[3.4rem]">
            {name}
          </h1>

          {shortDescription ? (
            <p className="max-w-md text-base leading-8 text-stone-400">
              {shortDescription}
            </p>
          ) : null}
        </div>

        {/* Price / size / availability — plain columns with hairline rules
            rather than a boxed card. */}
        <dl className="flex flex-wrap items-baseline gap-x-10 gap-y-4 border-y border-white/10 py-6">
          <div className="space-y-1.5">
            <dt className="text-[0.65rem] uppercase tracking-[0.24em] text-stone-500">
              Price
            </dt>
            <dd className="text-2xl font-light text-stone-100">
              {formatPrice(price)}
            </dd>
          </div>

          {sizeLabel ? (
            <div className="space-y-1.5">
              <dt className="text-[0.65rem] uppercase tracking-[0.24em] text-stone-500">
                Size
              </dt>
              <dd className="text-sm uppercase tracking-[0.16em] text-stone-300">
                {sizeLabel}
              </dd>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <dt className="text-[0.65rem] uppercase tracking-[0.24em] text-stone-500">
              Availability
            </dt>
            {/* Text carries the meaning; the dot is a redundant cue, never the
                only one. */}
            <dd className="flex items-center gap-2 text-sm uppercase tracking-[0.16em] text-stone-300">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  isSoldOut ? "bg-stone-600" : "bg-stone-300"
                }`}
              />
              {isSoldOut ? "Sold out" : "In stock"}
            </dd>
          </div>
        </dl>

        <AddToCartButton
          product={{
            id,
            slug,
            name,
            price,
            size_label: sizeLabel,
            image_url: imageUrl,
            stock_quantity: stockQuantity,
          }}
        />
      </div>
    </div>
  );
}
