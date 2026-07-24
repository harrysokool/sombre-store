import {
  getPrimaryProductImage,
  normalizeProductRelation,
  type ProductImage,
  type ProductRelationWithSlug,
} from "@/lib/storefront/products";

export type RelationName = ProductRelationWithSlug;

export type ProductListItemRow = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  price: number | string;
  size_label: string | null;
  stock_quantity: number;
  is_featured: boolean;
  created_at: string;
  brand: RelationName | RelationName[] | null;
  category: RelationName | RelationName[] | null;
  product_images: ProductImage[] | null;
};

export type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  price: number | string;
  size_label: string | null;
  stock_quantity: number;
  is_featured: boolean;
  created_at: string;
  brand: RelationName | null;
  category: RelationName | null;
  primaryImage: ProductImage | null;
};

export type ShopSearchParams = {
  category?: string | string[];
  collection?: string | string[];
  view?: string | string[];
  brand?: string | string[];
};

export type ShopView =
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

export type CategoryShopView = ShopView & { type: "category" };

const defaultShopView: ShopView = {
  type: "all",
  eyebrow: "Curated Edit",
  title: "All Products",
  description:
    "A focused selection of fragrance, skincare, makeup, and bath and body from luxury and independent brands.",
};

const categoryViews: Record<string, CategoryShopView> = {
  fragrance: {
    type: "category",
    categoryParam: "fragrance",
    categorySlug: "fragrance",
    eyebrow: "Category",
    title: "Fragrance",
    description:
      "Fragrance from luxury and independent brands, selected for depth, balance, and daily wear.",
  },
  skincare: {
    type: "category",
    categoryParam: "skincare",
    categorySlug: "skincare",
    eyebrow: "Category",
    title: "Skincare",
    description:
      "Skincare selected for gentle, effective everyday care.",
  },
  makeup: {
    type: "category",
    categoryParam: "makeup",
    categorySlug: "makeup",
    eyebrow: "Category",
    title: "Makeup",
    description:
      "Makeup and colour cosmetics, coming to the Sombre edit.",
  },
  "bath-and-body": {
    type: "category",
    categoryParam: "bath-and-body",
    categorySlug: "bath-and-body",
    eyebrow: "Category",
    title: "Bath and Body",
    description:
      "Bath and body essentials selected for refined scent, texture, and everyday use.",
  },
};

// Old category URLs from before the rebrand still resolve to the right view, so
// a bookmarked or shared /shop?category=… link keeps its filter instead of
// silently falling back to All Products.
const categoryParamAliases: Record<string, string> = {
  perfume: "fragrance",
  "home-fragrance": "skincare",
  "body-care": "bath-and-body",
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
    description: "A focused view of the current Sombre edit.",
  },
};

export function normalizeProductListItem(
  row: ProductListItemRow,
): ProductListItem {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    short_description: row.short_description,
    price: row.price,
    size_label: row.size_label,
    stock_quantity: row.stock_quantity,
    is_featured: row.is_featured,
    created_at: row.created_at,
    brand: normalizeProductRelation(row.brand),
    category: normalizeProductRelation(row.category),
    primaryImage: getPrimaryProductImage(row.product_images),
  };
}

export function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function getShopView(params: ShopSearchParams): ShopView {
  const category = getSearchParamValue(params.category);

  if (category) {
    const resolvedCategory = categoryParamAliases[category] ?? category;

    if (categoryViews[resolvedCategory]) {
      return categoryViews[resolvedCategory];
    }
  }

  const collection = getSearchParamValue(params.collection);

  if (collection && collectionViews[collection]) {
    return collectionViews[collection];
  }

  return defaultShopView;
}

export function getCategoryProducts(
  products: ProductListItem[],
  view: CategoryShopView,
) {
  return products.filter((product) => product.category?.slug === view.categorySlug);
}

export function getBrandsForProducts(products: ProductListItem[]) {
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

// The products a view shows before any brand filter is applied, in the order
// that view uses: catalog order for a category or the full edit, newest-first
// for New Arrivals. Best Sellers has no sales/ranking data yet, so it shows the
// full edit in catalog order rather than inventing an order.
export function getScopedProducts(
  products: ProductListItem[],
  view: ShopView,
): ProductListItem[] {
  if (view.type === "category") {
    return getCategoryProducts(products, view);
  }

  if (view.type === "collection" && view.collection === "new-arrivals") {
    return [...products].sort(
      (left, right) =>
        new Date(right.created_at).getTime() -
        new Date(left.created_at).getTime(),
    );
  }

  return products;
}

// A brand filter is honoured only when the slug names a brand that actually has
// an active product in the current scope. An unknown or out-of-scope slug — an
// arbitrary value, or a real brand with nothing in the selected category — is
// cleared to null, so the page falls back to all brands for the scope instead
// of dead-ending, and no arbitrary query value is ever trusted.
export function getValidBrandSlug(
  brandParam: string | string[] | undefined,
  scopedBrands: RelationName[],
): string | null {
  const brandSlug = getSearchParamValue(brandParam);

  if (!brandSlug) {
    return null;
  }

  return scopedBrands.some((brand) => brand.slug === brandSlug)
    ? brandSlug
    : null;
}

// Applies a validated brand filter to a scoped product list, preserving order.
export function getBrandFilteredProducts(
  scopedProducts: ProductListItem[],
  brandSlug: string | null,
): ProductListItem[] {
  if (!brandSlug) {
    return scopedProducts;
  }

  return scopedProducts.filter((product) => product.brand?.slug === brandSlug);
}

export function getShopPageCopy(
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

export type ShopCategoryLink = {
  label: string;
  categoryParam: string;
  href: string;
  isActive: boolean;
};

/**
 * The category row shown above the grid. A category with nothing in it is left
 * out rather than offering a link to an empty page, except when it is the view
 * currently being looked at — a direct or bookmarked URL still needs its own
 * entry to stay highlighted.
 */
export function getShopCategoryLinks(
  products: ProductListItem[],
  view: ShopView,
): ShopCategoryLink[] {
  const populatedSlugs = new Set(
    products
      .map((product) => product.category?.slug)
      .filter((slug): slug is string => Boolean(slug)),
  );
  const activeCategoryParam =
    view.type === "category" ? view.categoryParam : null;

  const categoryLinks = Object.values(categoryViews)
    .filter(
      (categoryView) =>
        populatedSlugs.has(categoryView.categorySlug) ||
        categoryView.categoryParam === activeCategoryParam,
    )
    .map((categoryView) => ({
      label: categoryView.title,
      categoryParam: categoryView.categoryParam,
      href: `/shop?category=${categoryView.categoryParam}`,
      isActive: categoryView.categoryParam === activeCategoryParam,
    }));

  return [
    {
      label: "All",
      categoryParam: "all",
      href: "/shop",
      isActive: view.type === "all",
    },
    ...categoryLinks,
  ];
}

// The URL for a view with no brand filter, used both for the "All Brands" reset
// and as the base every brand link extends. Keeping the current view's own
// parameter means clearing the brand never clears the category or collection.
function getViewBaseHref(view: ShopView): string {
  if (view.type === "category") {
    return `/shop?category=${view.categoryParam}`;
  }

  if (view.type === "collection") {
    return `/shop?collection=${view.collection}`;
  }

  return "/shop";
}

/**
 * Brand links for the current view. `brands` is already scoped to the view — the
 * brands with an active product in the selected category, or every brand in the
 * catalog on the All view — so a brand is shown only where it has stock to show.
 * The row is omitted when the scope has no brands. "All Brands" clears just the
 * brand while keeping the current category or collection.
 */
export function getShopBrandLinks(
  brands: RelationName[],
  view: ShopView,
  selectedBrandSlug: string | null,
) {
  if (brands.length === 0) {
    return [];
  }

  const baseHref = getViewBaseHref(view);
  const brandHref = (slug: string) =>
    `${baseHref}${baseHref.includes("?") ? "&" : "?"}brand=${slug}`;

  return [
    {
      label: "All Brands",
      href: baseHref,
      isActive: !selectedBrandSlug,
    },
    ...brands.map((brand) => ({
      label: brand.name,
      href: brandHref(brand.slug),
      isActive: brand.slug === selectedBrandSlug,
    })),
  ];
}
