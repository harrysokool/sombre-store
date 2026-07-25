import Link from "next/link";

import { ProductCard } from "@/components/shop/product-card";
import { ShopCategoryNav } from "@/components/shop/shop-category-nav";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/storefront/format-price";
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

  return (
    <section className="px-6 py-20 sm:px-10 sm:py-28 lg:px-12">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-500 sm:text-xs">
            {pageCopy.eyebrow}
          </p>
          <h1 className="mt-5 font-display text-4xl font-light leading-[1.1] text-stone-100 sm:text-5xl lg:text-6xl">
            {pageCopy.title}
          </h1>
          <p className="mt-6 text-sm leading-8 text-stone-400 sm:text-base">
            {pageCopy.description}
          </p>
        </header>

        {hasError ? null : (
          <div className="mt-14 sm:mt-16">
            <ShopCategoryNav
              categoryLinks={categoryLinks}
              brandLinks={brandLinks}
            />
          </div>
        )}

        {visibleProducts.length > 0 ? (
          <div className="mt-14 sm:mt-16">
            {/* Two up from 360px, where a tile is still wide enough to hold the
                brand line without breaking it mid-phrase. Narrower than that
                goes single column rather than cramped. */}
            <div className="grid grid-cols-1 gap-x-4 gap-y-14 min-[360px]:grid-cols-2 sm:gap-x-6 sm:gap-y-16 md:grid-cols-3 xl:grid-cols-4">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  name={product.name}
                  slug={product.slug}
                  brandName={product.brand?.name ?? null}
                  formattedPrice={formatPrice(product.price)}
                  sizeLabel={product.size_label}
                  notes={product.short_description}
                  stockQuantity={product.stock_quantity}
                  imageUrl={product.primaryImage?.image_url ?? null}
                  imageAlt={product.primaryImage?.alt_text ?? null}
                />
              ))}
            </div>

            <p className="mt-16 text-center text-[0.65rem] uppercase tracking-[0.24em] text-stone-600">
              {visibleProducts.length}{" "}
              {visibleProducts.length === 1 ? "Product" : "Products"}
            </p>
          </div>
        ) : (
          // Reached by a direct or bookmarked URL for a category that is empty,
          // or when the catalog itself could not be loaded.
          <div className="mx-auto mt-20 max-w-xl text-center sm:mt-24">
            <h2 className="font-display text-2xl font-light text-stone-200 sm:text-3xl">
              {hasError ? "The collection is unavailable" : "Nothing here yet"}
            </h2>
            <p className="mt-5 text-sm leading-8 text-stone-500">
              {hasError
                ? "We could not load the collection right now. Please try again shortly."
                : "This part of the edit is still being composed. The rest of the collection is waiting."}
            </p>
            <Link
              href="/shop"
              className="mt-9 inline-block border-b border-stone-600 pb-1 text-xs uppercase tracking-[0.28em] text-stone-200 transition-colors hover:border-stone-300 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950"
            >
              View all products
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
