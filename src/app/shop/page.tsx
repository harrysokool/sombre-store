import Link from "next/link";

import { ProductCard } from "@/components/shop/product-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/storefront/format-price";

export const dynamic = "force-dynamic";

type ProductImage = {
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
};

type RelationName = {
  name: string;
  slug: string;
};

type ProductListItemRow = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  price: number | string;
  size_label: string | null;
  is_featured: boolean;
  created_at: string;
  brand: RelationName | RelationName[] | null;
  category: RelationName | RelationName[] | null;
  product_images: ProductImage[] | null;
};

type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  price: number | string;
  size_label: string | null;
  is_featured: boolean;
  created_at: string;
  brand: RelationName | null;
  category: RelationName | null;
  primaryImage: ProductImage | null;
};

type ShopSearchParams = {
  category?: string | string[];
  collection?: string | string[];
  view?: string | string[];
  brand?: string | string[];
};

type ShopPageProps = {
  searchParams?: Promise<ShopSearchParams>;
};

type ShopView =
  | {
      type: "all";
      eyebrow: string;
      title: string;
      description: string;
    }
  | {
      type: "category";
      categoryParam: string;
      categorySlug: string;
      eyebrow: string;
      title: string;
      description: string;
    }
  | {
      type: "collection";
      collection: "new-arrivals" | "best-sellers";
      eyebrow: string;
      title: string;
      description: string;
    };

const defaultShopView: ShopView = {
  type: "all",
  eyebrow: "Curated Edit",
  title: "All Products",
  description:
    "A focused selection of perfume, body care, and home fragrance from luxury and independent brands.",
};

const categoryViews: Record<string, ShopView & { type: "category" }> = {
  perfume: {
    type: "category",
    categoryParam: "perfume",
    categorySlug: "perfume",
    eyebrow: "Category",
    title: "Perfume",
    description:
      "Perfume from luxury and independent brands, selected for depth, balance, and daily wear.",
  },
  "body-care": {
    type: "category",
    categoryParam: "body-care",
    categorySlug: "bath-and-body",
    eyebrow: "Category",
    title: "Body Care",
    description:
      "Body care selected for refined scent, texture, and everyday use.",
  },
  "home-fragrance": {
    type: "category",
    categoryParam: "home-fragrance",
    categorySlug: "home-fragrance",
    eyebrow: "Category",
    title: "Home Fragrance",
    description:
      "Candles and home scent pieces selected for calm, considered spaces.",
  },
};

const collectionViews: Record<string, ShopView & { type: "collection" }> = {
  "new-arrivals": {
    type: "collection",
    collection: "new-arrivals",
    eyebrow: "Collection",
    title: "New Arrivals",
    description:
      "The latest additions to the Sombre edit, shown newest first.",
  },
  "best-sellers": {
    type: "collection",
    collection: "best-sellers",
    eyebrow: "Collection",
    title: "Best Sellers",
    description:
      "A focused view of the current Sombre edit.",
  },
};

function getPrimaryImage(images: ProductImage[] | null) {
  const sortedImages = [...(images ?? [])].sort(
    (left, right) => left.sort_order - right.sort_order,
  );

  return sortedImages.find((image) => image.is_primary) ?? sortedImages[0] ?? null;
}

function normalizeRelation(
  relation: RelationName | RelationName[] | null,
): RelationName | null {
  if (!relation) {
    return null;
  }

  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

function normalizeProductListItem(row: ProductListItemRow): ProductListItem {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    short_description: row.short_description,
    price: row.price,
    size_label: row.size_label,
    is_featured: row.is_featured,
    created_at: row.created_at,
    brand: normalizeRelation(row.brand),
    category: normalizeRelation(row.category),
    primaryImage: getPrimaryImage(row.product_images),
  };
}

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getShopView(params: ShopSearchParams): ShopView {
  const category = getSearchParamValue(params.category);

  if (category && categoryViews[category]) {
    return categoryViews[category];
  }

  const collection = getSearchParamValue(params.collection);

  if (collection && collectionViews[collection]) {
    return collectionViews[collection];
  }

  return defaultShopView;
}

function getCategoryProducts(
  products: ProductListItem[],
  view: ShopView & { type: "category" },
) {
  return products.filter((product) => product.category?.slug === view.categorySlug);
}

function getBrandsForProducts(products: ProductListItem[]) {
  const brands = new Map<string, RelationName>();

  products.forEach((product) => {
    if (product.brand) {
      brands.set(product.brand.slug, product.brand);
    }
  });

  return [...brands.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function getVisibleProducts(
  products: ProductListItem[],
  view: ShopView,
  params: ShopSearchParams,
) {
  if (view.type === "category") {
    const categoryProducts = getCategoryProducts(products, view);
    const brandSlug = getSearchParamValue(params.brand);

    if (brandSlug) {
      return categoryProducts.filter(
        (product) => product.brand?.slug === brandSlug,
      );
    }

    return categoryProducts;
  }

  if (view.type === "collection" && view.collection === "new-arrivals") {
    return [...products].sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    );
  }

  if (view.type === "collection" && view.collection === "best-sellers") {
    // The current schema has no sales count or bestseller flag, so this view
    // displays the full edit instead of inventing sales ranking.
    return products;
  }

  return products;
}

function getShopPageCopy(
  view: ShopView,
  params: ShopSearchParams,
  brandOptions: RelationName[],
) {
  if (view.type !== "category") {
    return view;
  }

  const brandSlug = getSearchParamValue(params.brand);
  const selectedBrand = brandOptions.find((brand) => brand.slug === brandSlug);

  if (selectedBrand) {
    return {
      eyebrow: view.title,
      title: selectedBrand.name,
      description: `${view.title} selected from ${selectedBrand.name}.`,
    };
  }

  if (getSearchParamValue(params.view) === "all") {
    return {
      eyebrow: "Category",
      title: `All ${view.title}`,
      description: `Browse every ${view.title.toLowerCase()} selection in the Sombre edit.`,
    };
  }

  return view;
}

function CategoryBrandSelection({
  view,
  brands,
}: {
  view: ShopView & { type: "category" };
  brands: RelationName[];
}) {
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
  const shouldShowBrandSelection =
    !hasError &&
    shopView.type === "category" &&
    !getSearchParamValue(params.brand) &&
    getSearchParamValue(params.view) !== "all";

  return (
    <section className="px-6 py-24 sm:px-10 sm:py-32 lg:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-16">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div className="space-y-5">
            <p className="text-xs uppercase tracking-[0.38em] text-stone-500">
              {pageCopy.eyebrow}
            </p>
            <h1 className="text-4xl font-medium tracking-[0.12em] text-stone-100 sm:text-6xl">
              {pageCopy.title}
            </h1>
          </div>

          <div className="space-y-4 border-t border-white/10 pt-6 lg:border-t-0 lg:pt-0">
            <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
              Sombre
            </p>
            <p className="text-base leading-8 text-stone-400">
              {pageCopy.description}
            </p>
          </div>
        </div>

        {shouldShowBrandSelection ? (
          <CategoryBrandSelection view={shopView} brands={categoryBrands} />
        ) : visibleProducts.length > 0 ? (
          <div className="grid gap-x-8 gap-y-14 md:grid-cols-2 xl:grid-cols-3">
            {visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                name={product.name}
                slug={product.slug}
                shortDescription={product.short_description}
                formattedPrice={formatPrice(product.price)}
                sizeLabel={product.size_label}
                isFeatured={product.is_featured}
                imageUrl={product.primaryImage?.image_url ?? null}
                imageAlt={product.primaryImage?.alt_text ?? null}
              />
            ))}
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
