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
    "A focused selection of perfume, body care, and home fragrance from luxury and independent brands.",
};

const categoryViews: Record<string, CategoryShopView> = {
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

  if (category && categoryViews[category]) {
    return categoryViews[category];
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

export function getVisibleProducts(
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

export function shouldShowCategoryBrandSelection(
  hasError: boolean,
  view: ShopView,
  params: ShopSearchParams,
) {
  return (
    !hasError &&
    view.type === "category" &&
    !getSearchParamValue(params.brand) &&
    getSearchParamValue(params.view) !== "all"
  );
}
