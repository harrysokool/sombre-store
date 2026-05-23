import { CategoryBrandSelection } from "@/components/shop/category-brand-selection";
import { ProductCard } from "@/components/shop/product-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/storefront/format-price";
import {
  getBrandsForProducts,
  getCategoryProducts,
  getShopPageCopy,
  getShopView,
  getVisibleProducts,
  normalizeProductListItem,
  shouldShowCategoryBrandSelection,
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
  const categoryProducts =
    shopView.type === "category" ? getCategoryProducts(products, shopView) : [];
  const categoryBrands =
    shopView.type === "category" ? getBrandsForProducts(categoryProducts) : [];
  const visibleProducts = getVisibleProducts(products, shopView, params);
  const pageCopy = getShopPageCopy(shopView, params, categoryBrands);
  const shouldShowBrandSelection = shouldShowCategoryBrandSelection(
    hasError,
    shopView,
    params,
  );

  return (
    <section className="px-6 py-16 sm:px-10 sm:py-24 lg:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-12">
        <div className="max-w-3xl space-y-5">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.28em] text-stone-500">
              {pageCopy.eyebrow}
            </p>
            <h1 className="text-4xl font-medium leading-tight text-stone-100 sm:text-5xl">
              {pageCopy.title}
            </h1>
          </div>
          <p className="max-w-2xl text-base leading-8 text-stone-400">
            {pageCopy.description}
          </p>
        </div>

        {shouldShowBrandSelection && shopView.type === "category" ? (
          <CategoryBrandSelection view={shopView} brands={categoryBrands} />
        ) : visibleProducts.length > 0 ? (
          <div className="space-y-6 border-t border-white/10 pt-8">
            <p className="text-sm text-stone-500">
              {visibleProducts.length}{" "}
              {visibleProducts.length === 1 ? "product" : "products"}
            </p>

            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  name={product.name}
                  slug={product.slug}
                  brandName={product.brand?.name ?? null}
                  formattedPrice={formatPrice(product.price)}
                  sizeLabel={product.size_label}
                  imageUrl={product.primaryImage?.image_url ?? null}
                  imageAlt={product.primaryImage?.alt_text ?? null}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="border-t border-white/10 px-6 py-14 text-center">
            <h2 className="text-xl font-medium text-stone-100">
              {hasError ? "Catalog unavailable" : "No products found"}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-stone-400">
              {hasError
                ? "We could not load the collection right now. Please try again soon."
                : "New selections will appear in this view soon."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
