import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeProductRelation } from "@/lib/storefront/products";

export const dynamic = "force-dynamic";

type BrandRow = {
  name: string;
  slug: string;
  description: string | null;
};

type ActiveProductBrandRow = {
  id: string;
  brand: BrandRow | BrandRow[] | null;
};

type ActiveBrand = BrandRow & {
  activeProductCount: number;
};

async function getActiveBrands() {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("products")
      .select(
        `
          id,
          brand:brands (
            name,
            slug,
            description
          )
        `,
      )
      .eq("is_active", true)
      .returns<ActiveProductBrandRow[]>();

    if (error) {
      throw error;
    }

    const brandsBySlug = new Map<string, ActiveBrand>();

    (data ?? []).forEach((product) => {
      const brand = normalizeProductRelation(product.brand);

      if (!brand) {
        return;
      }

      const existingBrand = brandsBySlug.get(brand.slug);

      brandsBySlug.set(brand.slug, {
        ...brand,
        activeProductCount: (existingBrand?.activeProductCount ?? 0) + 1,
      });
    });

    return {
      brands: [...brandsBySlug.values()].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
      hasError: false,
    };
  } catch (error) {
    console.error("Failed to load brands for /brands:", error);

    return {
      brands: [] as ActiveBrand[],
      hasError: true,
    };
  }
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950";

export default async function BrandsPage() {
  const { brands, hasError } = await getActiveBrands();

  return (
    <section className="overflow-x-clip px-6 py-20 sm:px-10 sm:py-28 lg:px-12">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-500 sm:text-xs">
            The Houses
          </p>
          <h1 className="mt-5 font-display text-4xl font-light leading-[1.1] text-stone-100 sm:text-5xl lg:text-6xl">
            Brands
          </h1>
          <p className="mt-6 text-sm leading-8 text-stone-400 sm:text-base">
            Discover the houses represented in the current Sombre edit.
          </p>
        </header>

        {brands.length > 0 ? (
          <ul className="mt-14 border-t border-white/10 sm:mt-16">
            {brands.map((brand, index) => (
              <li key={brand.slug}>
                <Link
                  href={`/shop?brand=${encodeURIComponent(brand.slug)}`}
                  aria-label={`Shop ${brand.name}`}
                  className={`group grid min-w-0 gap-5 border-b border-white/10 py-8 transition-colors hover:bg-white/[0.025] sm:px-5 sm:py-10 md:grid-cols-[3rem_minmax(11rem,0.8fr)_minmax(0,1.2fr)_auto] md:items-start md:gap-8 ${focusRing}`}
                >
                  <p
                    aria-hidden="true"
                    className="text-[0.65rem] tracking-[0.24em] text-stone-600"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </p>

                  <div className="min-w-0">
                    <h2 className="break-words font-display text-3xl font-light leading-tight text-stone-100 transition-colors group-hover:text-white sm:text-4xl">
                      {brand.name}
                    </h2>
                    <p className="mt-3 text-[0.65rem] uppercase tracking-[0.2em] text-stone-600">
                      {brand.activeProductCount} active{" "}
                      {brand.activeProductCount === 1 ? "product" : "products"}
                    </p>
                  </div>

                  {brand.description ? (
                    <p className="min-w-0 break-words text-sm leading-7 text-stone-400 [overflow-wrap:anywhere] sm:text-base sm:leading-8">
                      {brand.description}
                    </p>
                  ) : (
                    <div aria-hidden="true" />
                  )}

                  <span className="inline-flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-stone-300 transition-colors group-hover:text-white">
                    Explore brand
                    <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div
            role={hasError ? "alert" : undefined}
            className="mx-auto mt-20 max-w-xl text-center sm:mt-24"
          >
            <h2 className="font-display text-2xl font-light text-stone-200 sm:text-3xl">
              {hasError ? "The brand directory is unavailable" : "No brands yet"}
            </h2>
            <p className="mt-5 text-sm leading-8 text-stone-500">
              {hasError
                ? "We could not load the current brands right now. Please try again shortly."
                : "There are no brands with active products in the Sombre edit right now."}
            </p>
            <Link
              href="/shop"
              className={`mt-9 inline-block border-b border-stone-600 pb-1 text-xs uppercase tracking-[0.28em] text-stone-200 transition-colors hover:border-stone-300 hover:text-white ${focusRing}`}
            >
              View all products
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
