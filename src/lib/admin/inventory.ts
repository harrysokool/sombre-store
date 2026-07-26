import { formatPrice } from "@/lib/storefront/format-price";

export const LOW_STOCK_THRESHOLD = 5;
export const OUT_OF_STOCK_QUANTITY = 0;
export const LOW_STOCK_MIN_QUANTITY = OUT_OF_STOCK_QUANTITY + 1;

export const ALL_INVENTORY_FILTER = "all";
export const MISSING_RELATION_FILTER = "__missing__";

export type InventoryStockStatus =
  | "in_stock"
  | "low_stock"
  | "out_of_stock";

export type InventoryStockFilter =
  | typeof ALL_INVENTORY_FILTER
  | "in-stock"
  | "low-stock"
  | "out-of-stock";

export type InventoryActiveFilter =
  | typeof ALL_INVENTORY_FILTER
  | "active"
  | "inactive";

export type InventorySort =
  | "name"
  | "brand"
  | "category"
  | "stock-asc"
  | "stock-desc";

export type InventorySearchParams = {
  q?: string | string[];
  brand?: string | string[];
  category?: string | string[];
  stock?: string | string[];
  active?: string | string[];
  sort?: string | string[];
};

export type AdminInventoryRelation = {
  name: string;
};

export type AdminInventoryImage = {
  imageUrl: string;
  altText: string | null;
};

export type AdminInventoryProduct = {
  id: string;
  name: string;
  price: number | string | null;
  stockQuantity: number;
  isActive: boolean;
  brand: AdminInventoryRelation | null;
  category: AdminInventoryRelation | null;
  primaryImage: AdminInventoryImage | null;
};

export type AdminInventoryRelationRow = {
  name: string;
};

export type AdminInventoryImageRow = {
  image_url: string;
  alt_text: string | null;
};

export type AdminInventoryProductRow = {
  id: string;
  name: string;
  price: number | string | null;
  stock_quantity: unknown;
  is_active: boolean;
  brand:
    | AdminInventoryRelationRow
    | AdminInventoryRelationRow[]
    | null;
  category:
    | AdminInventoryRelationRow
    | AdminInventoryRelationRow[]
    | null;
  product_images: AdminInventoryImageRow[] | null;
};

export type InventoryFilterOption = {
  value: string;
  label: string;
};

export type InventoryView = {
  search: string;
  brand: string;
  category: string;
  stock: InventoryStockFilter;
  active: InventoryActiveFilter;
  sort: InventorySort;
};

export type InventorySummary = {
  totalProducts: number;
  totalStockUnits: number;
  lowStockProducts: number;
  outOfStockProducts: number;
};

const STOCK_FILTERS = new Set<InventoryStockFilter>([
  ALL_INVENTORY_FILTER,
  "in-stock",
  "low-stock",
  "out-of-stock",
]);

const ACTIVE_FILTERS = new Set<InventoryActiveFilter>([
  ALL_INVENTORY_FILTER,
  "active",
  "inactive",
]);

const INVENTORY_SORTS = new Set<InventorySort>([
  "name",
  "brand",
  "category",
  "stock-asc",
  "stock-desc",
]);

const STOCK_FILTER_TO_STATUS: Partial<
  Record<InventoryStockFilter, InventoryStockStatus>
> = {
  "in-stock": "in_stock",
  "low-stock": "low_stock",
  "out-of-stock": "out_of_stock",
};

export const STOCK_STATUS_LABELS: Record<InventoryStockStatus, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
};

/**
 * Stock is an integer in the database, but this boundary still treats the
 * response as untrusted. Invalid values become zero, the conservative state:
 * they cannot inflate totals or make unavailable inventory look sellable.
 */
export function normalizeStockQuantity(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return 0;
  }

  // Canonicalize JavaScript's signed zero so a malformed "-0" value can never
  // render as a negative-looking quantity.
  return parsed === 0 ? 0 : parsed;
}

export function getInventoryStockStatus(
  stockQuantity: unknown,
): InventoryStockStatus {
  const quantity = normalizeStockQuantity(stockQuantity);

  if (quantity === OUT_OF_STOCK_QUANTITY) {
    return "out_of_stock";
  }

  return quantity >= LOW_STOCK_MIN_QUANTITY &&
    quantity <= LOW_STOCK_THRESHOLD
    ? "low_stock"
    : "in_stock";
}

function normalizeRelation(
  relation:
    | AdminInventoryRelationRow
    | AdminInventoryRelationRow[]
    | null,
): AdminInventoryRelation | null {
  const value = Array.isArray(relation) ? relation[0] : relation;
  const name = typeof value?.name === "string" ? value.name.trim() : "";

  return name ? { name } : null;
}

function normalizePrimaryImage(
  images: AdminInventoryImageRow[] | null,
): AdminInventoryImage | null {
  const image = Array.isArray(images) ? images[0] : null;
  const imageUrl =
    typeof image?.image_url === "string" ? image.image_url.trim() : "";

  if (!imageUrl) {
    return null;
  }

  const altText =
    typeof image?.alt_text === "string" && image.alt_text.trim()
      ? image.alt_text.trim()
      : null;

  return { imageUrl, altText };
}

export function normalizeInventoryProduct(
  row: AdminInventoryProductRow,
): AdminInventoryProduct {
  const name = typeof row.name === "string" ? row.name.trim() : "";

  return {
    id: row.id,
    name: name || "Unnamed product",
    price: row.price,
    stockQuantity: normalizeStockQuantity(row.stock_quantity),
    isActive: row.is_active === true,
    brand: normalizeRelation(row.brand),
    category: normalizeRelation(row.category),
    primaryImage: normalizePrimaryImage(row.product_images),
  };
}

export function formatInventoryPrice(value: unknown): string {
  const price =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(price) && price >= 0 ? formatPrice(price) : "—";
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, "en", { sensitivity: "base" });
}

function compareNullableText(left: string | null, right: string | null) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return compareText(left, right);
}

function compareByName(
  left: AdminInventoryProduct,
  right: AdminInventoryProduct,
) {
  return compareText(left.name, right.name) || compareText(left.id, right.id);
}

function getRelationFilterValue(
  product: AdminInventoryProduct,
  relation: "brand" | "category",
) {
  return product[relation]?.name ?? MISSING_RELATION_FILTER;
}

export function getInventoryRelationOptions(
  products: AdminInventoryProduct[],
  relation: "brand" | "category",
): InventoryFilterOption[] {
  const names = new Set<string>();
  let hasMissingRelation = false;

  for (const product of products) {
    const name = product[relation]?.name;

    if (name) {
      names.add(name);
    } else {
      hasMissingRelation = true;
    }
  }

  const options = [...names]
    .sort(compareText)
    .map((name) => ({ value: name, label: name }));

  if (hasMissingRelation) {
    options.push({
      value: MISSING_RELATION_FILTER,
      label: relation === "brand" ? "No brand" : "No category",
    });
  }

  return options;
}

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getValidatedRelationFilter(
  value: string | string[] | undefined,
  options: InventoryFilterOption[],
) {
  const requested = getSearchParamValue(value);

  if (
    !requested ||
    requested === ALL_INVENTORY_FILTER ||
    !options.some((option) => option.value === requested)
  ) {
    return ALL_INVENTORY_FILTER;
  }

  return requested;
}

function getAllowedValue<Value extends string>(
  value: string | string[] | undefined,
  allowed: Set<Value>,
  fallback: Value,
): Value {
  const requested = getSearchParamValue(value);

  return requested && allowed.has(requested as Value)
    ? (requested as Value)
    : fallback;
}

export function normalizeInventoryView(
  params: InventorySearchParams,
  products: AdminInventoryProduct[],
): InventoryView {
  const rawSearch = getSearchParamValue(params.q);
  const search =
    typeof rawSearch === "string" ? rawSearch.trim().slice(0, 120) : "";
  const brandOptions = getInventoryRelationOptions(products, "brand");
  const categoryOptions = getInventoryRelationOptions(products, "category");

  return {
    search,
    brand: getValidatedRelationFilter(params.brand, brandOptions),
    category: getValidatedRelationFilter(params.category, categoryOptions),
    stock: getAllowedValue(
      params.stock,
      STOCK_FILTERS,
      ALL_INVENTORY_FILTER,
    ),
    active: getAllowedValue(
      params.active,
      ACTIVE_FILTERS,
      ALL_INVENTORY_FILTER,
    ),
    sort: getAllowedValue(params.sort, INVENTORY_SORTS, "name"),
  };
}

export function getVisibleInventoryProducts(
  products: AdminInventoryProduct[],
  view: InventoryView,
): AdminInventoryProduct[] {
  const normalizedSearch = view.search.toLocaleLowerCase("en");
  const expectedStockStatus = STOCK_FILTER_TO_STATUS[view.stock];

  const filtered = products.filter((product) => {
    if (
      normalizedSearch &&
      !product.name.toLocaleLowerCase("en").includes(normalizedSearch)
    ) {
      return false;
    }

    if (
      view.brand !== ALL_INVENTORY_FILTER &&
      getRelationFilterValue(product, "brand") !== view.brand
    ) {
      return false;
    }

    if (
      view.category !== ALL_INVENTORY_FILTER &&
      getRelationFilterValue(product, "category") !== view.category
    ) {
      return false;
    }

    if (
      expectedStockStatus &&
      getInventoryStockStatus(product.stockQuantity) !== expectedStockStatus
    ) {
      return false;
    }

    if (
      (view.active === "active" && !product.isActive) ||
      (view.active === "inactive" && product.isActive)
    ) {
      return false;
    }

    return true;
  });

  return [...filtered].sort((left, right) => {
    switch (view.sort) {
      case "brand":
        return (
          compareNullableText(
            left.brand?.name ?? null,
            right.brand?.name ?? null,
          ) || compareByName(left, right)
        );
      case "category":
        return (
          compareNullableText(
            left.category?.name ?? null,
            right.category?.name ?? null,
          ) || compareByName(left, right)
        );
      case "stock-asc":
        return (
          left.stockQuantity - right.stockQuantity ||
          compareByName(left, right)
        );
      case "stock-desc":
        return (
          right.stockQuantity - left.stockQuantity ||
          compareByName(left, right)
        );
      default:
        return compareByName(left, right);
    }
  });
}

export function summarizeInventory(
  products: AdminInventoryProduct[],
): InventorySummary {
  let totalStockUnits = 0;
  let lowStockProducts = 0;
  let outOfStockProducts = 0;

  for (const product of products) {
    const stockQuantity = normalizeStockQuantity(product.stockQuantity);
    const status = getInventoryStockStatus(stockQuantity);

    totalStockUnits += stockQuantity;

    if (status === "low_stock") {
      lowStockProducts += 1;
    } else if (status === "out_of_stock") {
      outOfStockProducts += 1;
    }
  }

  return {
    totalProducts: products.length,
    totalStockUnits,
    lowStockProducts,
    outOfStockProducts,
  };
}
