import "server-only";

import {
  formatProductPriceInput,
  validateAdminProductSubmission,
  validateAdminProductUpdate,
  type AdminProductSubmission,
} from "@/lib/admin/product-rules";
import { normalizeStockQuantity } from "@/lib/admin/inventory";
import {
  listAdminProductImages,
  type AdminProductImage,
} from "@/lib/admin/product-images";
import { getAdminUser } from "@/lib/supabase/admin-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

// Trusted-server access to the product catalog for the admin. The storefront
// reads products with the anonymous client under an RLS policy that exposes
// only active rows and no writes at all, so every catalog write goes through
// the service role here, behind the same admin gate as the other admin data.

export type AdminProductOption = {
  id: string;
  name: string;
};

export type AdminProductFormOptions = {
  brands: AdminProductOption[];
  categories: AdminProductOption[];
};

export type AdminProductMutationResult =
  | { ok: true; productId: string }
  | { ok: false; error: string };

/** One product's editable values, already shaped for the form's inputs. */
export type AdminProductDetail = {
  id: string;
  name: string;
  slug: string;
  brandId: string;
  categoryId: string;
  sizeLabel: string;
  shortDescription: string;
  description: string;
  price: string;
  retailPrice: string;
  /** Shown read-only. Never written by an edit. */
  stockQuantity: number;
  isActive: boolean;
};

export type AdminProductEditorData = AdminProductFormOptions & {
  product: AdminProductDetail;
  /** In storefront display order, ready for the images section. */
  images: AdminProductImage[];
};

const CREATE_FAILED_MESSAGE = "Product could not be created. Try again.";
const UPDATE_FAILED_MESSAGE = "Product could not be saved. Try again.";
const DUPLICATE_SLUG_MESSAGE =
  "A product with that slug already exists. Choose a different slug.";
const STALE_RELATION_MESSAGE =
  "That brand or category no longer exists. Reload the form and try again.";
const INVALID_REFERENCE_MESSAGE = "That product reference is not valid.";
const MISSING_PRODUCT_MESSAGE =
  "That product no longer exists. Reload the inventory list.";

// PostgreSQL error codes. The unique violation covers products_slug_unique and
// the foreign key violation covers brand_id and category_id.
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PRODUCT_EDITOR_COLUMNS =
  "id, name, slug, brand_id, category_id, size_label, short_description, description, price, retail_price, stock_quantity, is_active";

type AdminProductRow = {
  id: string;
  name: string | null;
  slug: string | null;
  brand_id: string | null;
  category_id: string | null;
  size_label: string | null;
  short_description: string | null;
  description: string | null;
  price: number | string | null;
  retail_price: number | string | null;
  stock_quantity: unknown;
  is_active: boolean | null;
};

/**
 * Turns one stored row into the strings the form's inputs bind to.
 *
 * A controlled input cannot be given null without React treating it as
 * uncontrolled, so every absent text column becomes "" here — which is also
 * exactly what the validation layer reads back as "not set".
 */
function toProductDetail(row: AdminProductRow): AdminProductDetail {
  return {
    id: row.id,
    name: row.name ?? "",
    slug: row.slug ?? "",
    brandId: row.brand_id ?? "",
    categoryId: row.category_id ?? "",
    sizeLabel: row.size_label ?? "",
    shortDescription: row.short_description ?? "",
    description: row.description ?? "",
    price: formatProductPriceInput(row.price),
    retailPrice: formatProductPriceInput(row.retail_price),
    stockQuantity: normalizeStockQuantity(row.stock_quantity),
    isActive: row.is_active === true,
  };
}

async function assertAdmin() {
  const adminUser = await getAdminUser();

  if (!adminUser) {
    throw new Error(
      "Admin product data requested without an approved session.",
    );
  }
}

/**
 * The brands and categories a new product can be assigned to.
 *
 * Both lists are read whole because neither table is large and the form needs
 * every option. Creating a brand or a category is deliberately not offered
 * here: a product must be filed under one that already exists.
 */
export async function listAdminProductFormOptions(): Promise<AdminProductFormOptions> {
  await assertAdmin();

  const supabase = createSupabaseServiceRoleClient();
  const [brandsResult, categoriesResult] = await Promise.all([
    supabase
      .from("brands")
      .select("id, name")
      .order("name", { ascending: true })
      .returns<AdminProductOption[]>(),
    supabase
      .from("categories")
      .select("id, name")
      .order("name", { ascending: true })
      .returns<AdminProductOption[]>(),
  ]);

  if (brandsResult.error || categoriesResult.error) {
    throw new Error("Brands and categories could not be loaded.");
  }

  return {
    brands: brandsResult.data ?? [],
    categories: categoriesResult.data ?? [],
  };
}

/**
 * Confirms the submitted brand and category still exist.
 *
 * The foreign keys would refuse a missing one anyway, so this exists purely to
 * turn that into a message naming which of the two is gone. Returns null when
 * both are present.
 */
async function findStaleRelationError(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  brandId: string,
  categoryId: string,
): Promise<string | null> {
  const [brandResult, categoryResult] = await Promise.all([
    supabase
      .from("brands")
      .select("id")
      .eq("id", brandId)
      .maybeSingle<{ id: string }>(),
    supabase
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .maybeSingle<{ id: string }>(),
  ]);

  if (brandResult.error || categoryResult.error) {
    console.error(
      "Failed to check the product brand and category",
      brandResult.error ?? categoryResult.error,
    );
    return "The brand and category could not be checked. Try again.";
  }

  if (!brandResult.data) {
    return "That brand no longer exists. Reload the form and try again.";
  }

  if (!categoryResult.data) {
    return "That category no longer exists. Reload the form and try again.";
  }

  return null;
}

/**
 * Creates one product from a validated submission.
 *
 * Stock is written as a plain column value on the insert. The stock RPCs are
 * deliberately not involved: they exist to move inventory for an order that
 * already exists, and a product being created has no order history to reconcile
 * against.
 */
export async function createAdminProduct(
  input: AdminProductSubmission,
): Promise<AdminProductMutationResult> {
  await assertAdmin();

  const validated = validateAdminProductSubmission(input);

  if (!validated.ok) {
    return validated;
  }

  const supabase = createSupabaseServiceRoleClient();
  const staleRelationError = await findStaleRelationError(
    supabase,
    validated.value.brand_id,
    validated.value.category_id,
  );

  if (staleRelationError) {
    return { ok: false, error: staleRelationError };
  }

  // products.slug is unique. This look-up turns the ordinary case into a clear
  // message; the unique-violation branch below still covers two creates racing
  // for the same slug, which no look-up can prevent.
  const { data: duplicate, error: duplicateError } = await supabase
    .from("products")
    .select("id")
    .eq("slug", validated.value.slug)
    .maybeSingle<{ id: string }>();

  if (duplicateError) {
    console.error(
      "Failed to check for a duplicate product slug",
      duplicateError,
    );
    return {
      ok: false,
      error: "The slug could not be checked. Try again.",
    };
  }

  if (duplicate) {
    return { ok: false, error: DUPLICATE_SLUG_MESSAGE };
  }

  const { data, error } = await supabase
    .from("products")
    .insert(validated.value)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !data) {
    if (error?.code === UNIQUE_VIOLATION) {
      return { ok: false, error: DUPLICATE_SLUG_MESSAGE };
    }

    if (error?.code === FOREIGN_KEY_VIOLATION) {
      return { ok: false, error: STALE_RELATION_MESSAGE };
    }

    // Nothing from Supabase or PostgreSQL reaches the administrator: the detail
    // goes to the server log and the form gets one generic message.
    console.error("Failed to create product", error);
    return { ok: false, error: CREATE_FAILED_MESSAGE };
  }

  return { ok: true, productId: data.id };
}

/**
 * One product plus the dropdown options its editor needs.
 *
 * Returns null both for a reference that is not a UUID and for a product that
 * does not exist, so a malformed URL produces the ordinary not-found page
 * instead of a query error. Reads the product whether or not it is active: the
 * public RLS policy hides inactive rows, which is exactly the product an
 * administrator most needs to open.
 */
export async function getAdminProductEditorData(
  productId: string,
): Promise<AdminProductEditorData | null> {
  await assertAdmin();

  if (!UUID_PATTERN.test(productId)) {
    return null;
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_EDITOR_COLUMNS)
    .eq("id", productId)
    .maybeSingle<AdminProductRow>();

  if (error) {
    throw new Error("Product details could not be loaded.");
  }

  if (!data) {
    return null;
  }

  // Both read only after the product is known to exist, so a missing product
  // never triggers work for rows that cannot be shown.
  const [options, images] = await Promise.all([
    listAdminProductFormOptions(),
    listAdminProductImages(productId),
  ]);

  return {
    product: toProductDetail(data),
    brands: options.brands,
    categories: options.categories,
    images,
  };
}

/**
 * Rewrites one product's editable columns.
 *
 * The update payload is the allowlist `validateAdminProductUpdate` produces, so
 * only those columns are ever written. Stock is not among them: it is moved by
 * the paid-order and restoration RPCs against real orders, and an edit form has
 * no way to know what those have recorded since the page was opened.
 */
export async function updateAdminProduct(
  productId: string,
  input: AdminProductSubmission,
): Promise<AdminProductMutationResult> {
  await assertAdmin();

  if (!UUID_PATTERN.test(productId)) {
    return { ok: false, error: INVALID_REFERENCE_MESSAGE };
  }

  const validated = validateAdminProductUpdate(input);

  if (!validated.ok) {
    return validated;
  }

  const supabase = createSupabaseServiceRoleClient();
  const staleRelationError = await findStaleRelationError(
    supabase,
    validated.value.brand_id,
    validated.value.category_id,
  );

  if (staleRelationError) {
    return { ok: false, error: staleRelationError };
  }

  // Any *other* product holding this slug. Excluding this product by id is what
  // lets an edit that leaves the slug alone save normally, while still refusing
  // a slug that belongs to something else.
  const { data: duplicate, error: duplicateError } = await supabase
    .from("products")
    .select("id")
    .eq("slug", validated.value.slug)
    .neq("id", productId)
    .maybeSingle<{ id: string }>();

  if (duplicateError) {
    console.error(
      "Failed to check for a duplicate product slug",
      duplicateError,
    );
    return { ok: false, error: "The slug could not be checked. Try again." };
  }

  if (duplicate) {
    return { ok: false, error: DUPLICATE_SLUG_MESSAGE };
  }

  const { data, error } = await supabase
    .from("products")
    .update(validated.value)
    .eq("id", productId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, error: DUPLICATE_SLUG_MESSAGE };
    }

    if (error.code === FOREIGN_KEY_VIOLATION) {
      return { ok: false, error: STALE_RELATION_MESSAGE };
    }

    // Nothing from Supabase or PostgreSQL reaches the administrator: the detail
    // goes to the server log and the form gets one generic message.
    console.error("Failed to update product", error);
    return { ok: false, error: UPDATE_FAILED_MESSAGE };
  }

  // An update matching no row means the product was removed between opening the
  // form and saving it, which is worth saying plainly rather than reporting a
  // success that changed nothing.
  if (!data) {
    return { ok: false, error: MISSING_PRODUCT_MESSAGE };
  }

  return { ok: true, productId: data.id };
}
