import "server-only";

import {
  validateAdminProductSubmission,
  type AdminProductSubmission,
} from "@/lib/admin/product-rules";
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

const CREATE_FAILED_MESSAGE = "Product could not be created. Try again.";
const DUPLICATE_SLUG_MESSAGE =
  "A product with that slug already exists. Choose a different slug.";
const STALE_RELATION_MESSAGE =
  "That brand or category no longer exists. Reload the form and try again.";

// PostgreSQL error codes. The unique violation covers products_slug_unique and
// the foreign key violation covers brand_id and category_id.
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

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
