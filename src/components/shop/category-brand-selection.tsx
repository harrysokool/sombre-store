import Link from "next/link";

import type {
  CategoryShopView,
  RelationName,
} from "@/lib/storefront/shop";

type CategoryBrandSelectionProps = {
  view: CategoryShopView;
  brands: RelationName[];
};

export function CategoryBrandSelection({
  view,
  brands,
}: CategoryBrandSelectionProps) {
  const categoryName = view.title.toLowerCase();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.32em] text-stone-500">
            Browse by Brand
          </p>
          <h2 className="text-2xl font-medium tracking-[0.08em] text-stone-100 sm:text-3xl">
            Shop {view.title}
          </h2>
        </div>

        <p className="max-w-md text-sm leading-7 text-stone-400">
          View the full category or narrow the edit by brand.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Link
          href={`/shop?category=${view.categoryParam}&view=all`}
          className="group flex min-h-56 flex-col justify-between border border-white/15 bg-[linear-gradient(145deg,rgba(68,64,60,0.28),rgba(255,255,255,0.03),rgba(12,10,9,0.5))] p-7 transition-colors hover:border-white/30 sm:p-8"
        >
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
              Full Category
            </p>
            <p className="text-3xl font-medium tracking-[0.08em] text-stone-100 transition-colors group-hover:text-white sm:text-4xl">
              All {view.title}
            </p>
          </div>

          <div className="mt-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <p className="text-sm leading-6 text-stone-400">
              Browse every {categoryName} selection in the Sombre edit.
            </p>
            <span className="w-fit border-b border-white/30 pb-1 text-xs uppercase tracking-[0.28em] text-stone-200 transition-colors group-hover:border-white/60 group-hover:text-white">
              View All
            </span>
          </div>
        </Link>

        <div className="grid gap-4 sm:grid-cols-2">
          {brands.map((brand) => (
            <Link
              key={brand.slug}
              href={`/shop?category=${view.categoryParam}&brand=${brand.slug}`}
              className="group flex min-h-40 flex-col justify-between border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-white/25"
            >
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.28em] text-stone-500">
                  Brand
                </p>
                <p className="text-2xl font-medium tracking-[0.06em] text-stone-100 transition-colors group-hover:text-white">
                  {brand.name}
                </p>
              </div>

              <p className="mt-8 text-sm uppercase tracking-[0.22em] text-stone-500 transition-colors group-hover:text-stone-300">
                View Selection
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
