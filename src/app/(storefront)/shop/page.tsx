import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/shop/product-card";
import { ShopCategoryNav } from "@/components/shop/shop-category-nav";
import { getShopCanonicalPath } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadPromotionDiscounts } from "@/lib/storefront/promotion-discounts";
import { getProductPriceDisplay } from "@/lib/storefront/promotion-display";
import {
  getBrandFilteredProducts,
  getBrandsForProducts,
  getScopedProducts,
  getShopBrandLinks,
  getShopCategoryLinks,
  getShopPageCopy,
  getShopView,
  getValidBrandSlug,
  normalizeProductListItem,
  type ProductListItem,
  type ProductListItemRow,
  type ShopSearchParams,
} from "@/lib/storefront/shop";

export const dynamic = "force-dynamic";

type ShopPageProps = {
  searchParams?: Promise<ShopSearchParams>;
};

/**
 * Title, description, and canonical follow the current view.
 *
 * The canonical is the whole duplicate-content defence for this route: every
 * brand filter, collection sort, `?view=all`, and arbitrary query string points
 * back at either `/shop` or the one canonical URL for a recognised category.
 * See `getShopCanonicalPath` for the policy itself.
 */
export async function generateMetadata({
  searchParams,
}: ShopPageProps): Promise<Metadata> {
  const params = searchParams ? await searchParams : {};
  const view = getShopView(params);
  const canonical = getShopCanonicalPath(params);

  // Only a recognised category earns its own title. Everything else keeps the
  // shop's own title, matching the canonical it points at.
  const isCanonicalCategory = view.type === "category";

  return {
    title: isCanonicalCategory ? view.title : "Shop",
    description: isCanonicalCategory
      ? view.description
      : "Browse the full Sombre edit: fragrance, skincare, makeup, and bath and body from luxury and independent brands.",
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: isCanonicalCategory ? view.title : "Shop",
      description: isCanonicalCategory
        ? view.description
        : "Browse the full Sombre edit: fragrance, skincare, makeup, and bath and body from luxury and independent brands.",
      url: canonical,
    },
  };
}

async function getActiveProducts() {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("products")
      .select(
        `
          id,
          name,
          slug,
          short_description,
          price,
          retail_price,
          size_label,
          stock_quantity,
          is_featured,
          created_at,
          brand:brands (
            name,
            slug
          ),
          category:categories (
            name,
            slug
          ),
          product_images (
            image_url,
            alt_text,
            sort_order,
            is_primary
          )
        `,
      )
      .eq("is_active", true)
      // Without this the grid renders in whatever order Postgres happens to
      // return rows, which can change after any update to a product.
      //
      // `is_featured` is the curation signal an admin already controls, so the
      // shop leads with whatever is currently being pushed without needing a
      // new column or a sort control. `name` breaks the tie, which keeps the
      // remainder stable and predictable rather than merely deterministic.
      //
      // Deliberately not `created_at`: that is the New Arrivals ordering, and
      // reusing it here would make that collection a duplicate of the default
      // view. See `getScopedProducts`, which still re-sorts for that one case.
      .order("is_featured", { ascending: false })
      .order("name", { ascending: true })
      .returns<ProductListItemRow[]>();

    if (error) {
      throw error;
    }

    return {
      products: (data ?? []).map(normalizeProductListItem),
      hasError: false,
    };
  } catch (error) {
    console.error("Failed to load products for /shop:", error);

    return {
      products: [] as ProductListItem[],
      hasError: true,
    };
  }
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = searchParams ? await searchParams : {};
  const { products, hasError } = await getActiveProducts();
  const shopView = getShopView(params);
  // Brands are derived from the active products in the current scope: a
  // category's products on a category page, the whole active edit on All. So a
  // brand only appears where it currently has an active product to show.
  const scopedProducts = getScopedProducts(products, shopView);
  const scopedBrands = getBrandsForProducts(scopedProducts);
  const selectedBrandSlug = getValidBrandSlug(params.brand, scopedBrands);
  const visibleProducts = getBrandFilteredProducts(
    scopedProducts,
    selectedBrandSlug,
  );
  const pageCopy = getShopPageCopy(shopView, params, scopedBrands);
  const categoryLinks = getShopCategoryLinks(products, shopView);
  const brandLinks = getShopBrandLinks(scopedBrands, shopView, selectedBrandSlug);
  // Whether anything is narrowing the catalog right now, which decides if the
  // empty state has somewhere useful to send the reader.
  const isFiltered = shopView.type !== "all" || selectedBrandSlug !== null;
  // One call for the whole grid, after filtering, so exactly the products being
  // rendered are asked about and the page makes a single promotion request
  // however many tiles it shows.
  const promotionDiscounts = await loadPromotionDiscounts(
    visibleProducts.map((product) => product.id),
  );

  return (
    // 16px gutters below `sm` rather than 24px: it is the standard mobile
    // measure, it widens every tile by 8px, and that width is what lets the
    // promotional price hold one line at 12px in the two-column grid.
    <section className="px-4 py-12 sm:px-10 sm:py-16 lg:px-12">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-400 sm:text-xs">
            {pageCopy.eyebrow}
          </p>
          <h1 className="mt-4 font-display text-3xl font-light leading-[1.1] text-stone-100 sm:text-4xl lg:text-5xl">
            {pageCopy.title}
          </h1>
          <p className="mt-4 text-sm leading-7 text-stone-400 sm:text-base">
            {pageCopy.description}
          </p>
        </header>

        {hasError ? null : (
          // The rule closes the header and opens the grid, so the nav reads as
          // the page's control rather than as a footnote under the title.
          <div className="mt-10 border-b border-stone-800 pb-8 sm:mt-12 sm:pb-10">
            <ShopCategoryNav
              categoryLinks={categoryLinks}
              brandLinks={brandLinks}
            />
          </div>
        )}

        {visibleProducts.length > 0 ? (
          <div className="mt-12 sm:mt-14">
            {/* Two up from 360px, where a tile is still wide enough to hold the
                brand line without breaking it mid-phrase. Narrower than that
                goes single column rather than cramped.

                Narrow column gutters and generous row gaps: the air belongs
                between rows, where it separates products, rather than beside
                them, where it only shrinks the photography. */}
            <div className="grid grid-cols-1 gap-x-2 gap-y-16 min-[360px]:grid-cols-2 sm:gap-x-4 sm:gap-y-20 md:grid-cols-3 xl:grid-cols-4">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  name={product.name}
                  slug={product.slug}
                  brandName={product.brand?.name ?? null}
                  priceDisplay={getProductPriceDisplay({
                    price: product.price,
                    retailPrice: product.retail_price,
                    discountBasisPoints: promotionDiscounts.get(product.id),
                  })}
                  sizeLabel={product.size_label}
                  notes={product.short_description}
                  stockQuantity={product.stock_quantity}
                  imageUrl={product.primaryImage?.image_url ?? null}
                  imageAlt={product.primaryImage?.alt_text ?? null}
                  hoverImageUrl={product.secondaryImage?.image_url ?? null}
                />
              ))}
            </div>

            <p className="mt-16 text-center text-[0.65rem] uppercase tracking-[0.24em] text-stone-400">
              {visibleProducts.length}{" "}
              {visibleProducts.length === 1 ? "Product" : "Products"}
            </p>
          </div>
        ) : hasError ? (
          // The catalog itself could not be loaded. No "view all" link here: it
          // would re-run the query that just failed and land back on this page.
          <div className="mx-auto mt-20 max-w-xl text-center sm:mt-24">
            <h2 className="font-display text-2xl font-light text-stone-200 sm:text-3xl">
              The collection is unavailable
            </h2>
            <p className="mt-5 text-sm leading-8 text-stone-400">
              We could not load the collection right now. Please try again
              shortly.
            </p>
          </div>
        ) : (
          // A genuinely empty result: the query worked, this view simply has
          // nothing in it. Usually a direct or bookmarked URL for a category or
          // brand that is empty right now.
          <div className="mx-auto mt-20 max-w-xl text-center sm:mt-24">
            <h2 className="font-display text-2xl font-light text-stone-200 sm:text-3xl">
              Nothing in this view
            </h2>
            <p className="mt-5 text-sm leading-8 text-stone-400">
              No products match the current selection.
            </p>
            {/* Only offered when something is actually filtering the view —
                otherwise the link points back at the page already being read. */}
            {isFiltered ? (
              <Link
                href="/shop"
                className="mt-9 inline-block border-b border-stone-600 pb-1 text-xs uppercase tracking-[0.28em] text-stone-200 transition-colors hover:border-stone-300 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950"
              >
                View all products
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
