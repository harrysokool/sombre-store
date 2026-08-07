import "server-only";

import {
  getReorderedImageIds,
  isProductImageMoveDirection,
  validateProductImageAltText,
  validateProductImageSubmission,
  type AdminProductImageSubmission,
} from "@/lib/admin/product-image-rules";
import {
  getSortedProductImages,
  type ProductImage,
} from "@/lib/storefront/products";
import { getAdminUser } from "@/lib/supabase/admin-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

// Trusted-server management of the rows the storefront gallery already reads.
// Nothing here changes how those rows are consumed: sort_order keeps its single
// meaning of display position, and is_primary keeps its single meaning of the
// image a product leads with.

export type AdminProductImage = {
  id: string;
  imageUrl: string;
  altText: string;
  sortOrder: number;
  isPrimary: boolean;
};

export type AdminProductImageResult =
  | { ok: true }
  | { ok: false; error: string };

const IMAGE_COLUMNS = "id, image_url, alt_text, sort_order, is_primary";

const INVALID_REFERENCE_MESSAGE = "That image reference is not valid.";
const MISSING_IMAGE_MESSAGE =
  "That image is not part of this product. Reload the page and try again.";
const LOAD_FAILED_MESSAGE = "Product images could not be loaded.";
const ORDER_FAILED_MESSAGE = "Image order could not be saved. Try again.";
const CONFLICT_MESSAGE =
  "The images changed while you were editing. Reload the page and try again.";

// PostgreSQL unique violation, covering both product_images_product_id_sort_order_unique
// and the partial one-primary-per-product index.
const UNIQUE_VIOLATION = "23505";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The stored row: the storefront's own image shape plus its id. */
type AdminProductImageRow = ProductImage & { id: string };

type SupabaseClient = ReturnType<typeof createSupabaseServiceRoleClient>;

async function assertAdmin() {
  const adminUser = await getAdminUser();

  if (!adminUser) {
    throw new Error(
      "Admin product image data requested without an approved session.",
    );
  }
}

function toAdminProductImage(row: AdminProductImageRow): AdminProductImage {
  return {
    id: row.id,
    imageUrl: row.image_url,
    altText: row.alt_text ?? "",
    sortOrder: row.sort_order,
    isPrimary: row.is_primary === true,
  };
}

/**
 * Every image for one product, in the order the storefront shows them.
 *
 * The rows are handed to `getSortedProductImages` — the same helper the product
 * page sorts with — rather than sorted again here, so the admin can never
 * disagree with the gallery about what order these are in. The cast back is
 * sound because that helper only reorders the array it is given; it never
 * reshapes the objects, so the `id` each row carries survives.
 */
async function loadOrderedImages(
  supabase: SupabaseClient,
  productId: string,
): Promise<AdminProductImageRow[] | null> {
  const { data, error } = await supabase
    .from("product_images")
    .select(IMAGE_COLUMNS)
    .eq("product_id", productId)
    .returns<AdminProductImageRow[]>();

  if (error) {
    console.error("Failed to read product images", error);
    return null;
  }

  return (getSortedProductImages(data ?? []) ?? []) as AdminProductImageRow[];
}

/**
 * Writes `orderedIds` as sort_order 0, 1, 2, … in that order.
 *
 * Two passes, because (product_id, sort_order) is unique and every row is
 * updated by its own statement: assigning a final number directly would collide
 * with whichever row still holds it. The first pass parks every row above the
 * current maximum, which frees the whole 0..n-1 range for the second.
 *
 * These statements are not one transaction, so a failure between the passes
 * leaves the images parked in the high range. That degrades safely — the
 * relative order is intact and the storefront sorts by sort_order regardless —
 * and the next successful change renumbers them cleanly.
 *
 * Each update carries the product id as well as the row id, so a mismatched
 * pair touches nothing even if it reached this far.
 */
async function writeImageOrder(
  supabase: SupabaseClient,
  productId: string,
  orderedIds: readonly string[],
  currentMaxSortOrder: number,
): Promise<boolean> {
  const parkingOffset = currentMaxSortOrder + 1;

  for (const passOffset of [parkingOffset, 0]) {
    for (const [index, imageId] of orderedIds.entries()) {
      const { error } = await supabase
        .from("product_images")
        .update({ sort_order: passOffset + index })
        .eq("id", imageId)
        .eq("product_id", productId);

      if (error) {
        console.error("Failed to write product image order", error);
        return false;
      }
    }
  }

  return true;
}

function getMaxSortOrder(images: readonly AdminProductImageRow[]): number {
  return images.reduce((max, image) => Math.max(max, image.sort_order), -1);
}

/**
 * Loads the images and locates one of them, which is also the ownership check:
 * the query is scoped to the product, so an image belonging to anything else is
 * simply not in the list.
 */
async function loadImagesAndTarget(
  supabase: SupabaseClient,
  productId: string,
  imageId: string,
) {
  const images = await loadOrderedImages(supabase, productId);

  if (!images) {
    return { error: LOAD_FAILED_MESSAGE } as const;
  }

  const target = images.find((image) => image.id === imageId);

  if (!target) {
    return { error: MISSING_IMAGE_MESSAGE } as const;
  }

  return { images, target } as const;
}

function getReferenceError(productId: string, imageId?: string) {
  if (!UUID_PATTERN.test(productId)) {
    return "That product reference is not valid.";
  }

  if (imageId !== undefined && !UUID_PATTERN.test(imageId)) {
    return INVALID_REFERENCE_MESSAGE;
  }

  return null;
}

export async function listAdminProductImages(
  productId: string,
): Promise<AdminProductImage[]> {
  await assertAdmin();

  if (!UUID_PATTERN.test(productId)) {
    return [];
  }

  const supabase = createSupabaseServiceRoleClient();
  const images = await loadOrderedImages(supabase, productId);

  if (!images) {
    throw new Error(LOAD_FAILED_MESSAGE);
  }

  return images.map(toAdminProductImage);
}

/**
 * Appends one image to the end of a product's gallery.
 *
 * The first image a product gets becomes its primary, so a product is never
 * left with images but nothing to lead with. Later images are added unflagged
 * and are promoted only when an administrator chooses them.
 */
export async function addAdminProductImage(
  productId: string,
  input: AdminProductImageSubmission,
): Promise<AdminProductImageResult> {
  await assertAdmin();

  const referenceError = getReferenceError(productId);

  if (referenceError) {
    return { ok: false, error: referenceError };
  }

  const validated = validateProductImageSubmission(input);

  if (!validated.ok) {
    return validated;
  }

  const supabase = createSupabaseServiceRoleClient();
  const images = await loadOrderedImages(supabase, productId);

  if (!images) {
    return { ok: false, error: LOAD_FAILED_MESSAGE };
  }

  const { error } = await supabase.from("product_images").insert({
    product_id: productId,
    image_url: validated.value.image_url,
    alt_text: validated.value.alt_text,
    // max + 1 rather than the count, so a legacy gap in the sequence still
    // yields a free position.
    sort_order: getMaxSortOrder(images) + 1,
    is_primary: images.length === 0,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, error: CONFLICT_MESSAGE };
    }

    console.error("Failed to add product image", error);
    return { ok: false, error: "Image could not be added. Try again." };
  }

  return { ok: true };
}

export async function updateAdminProductImageAltText(
  productId: string,
  imageId: string,
  altText: unknown,
): Promise<AdminProductImageResult> {
  await assertAdmin();

  const referenceError = getReferenceError(productId, imageId);

  if (referenceError) {
    return { ok: false, error: referenceError };
  }

  const validated = validateProductImageAltText(altText);

  if (!validated.ok) {
    return validated;
  }

  const supabase = createSupabaseServiceRoleClient();
  // Scoped to both ids, so an image belonging to another product matches no row
  // and is reported as missing rather than quietly edited.
  const { data, error } = await supabase
    .from("product_images")
    .update({ alt_text: validated.value })
    .eq("id", imageId)
    .eq("product_id", productId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    console.error("Failed to update product image alt text", error);
    return { ok: false, error: "Alt text could not be saved. Try again." };
  }

  if (!data) {
    return { ok: false, error: MISSING_IMAGE_MESSAGE };
  }

  return { ok: true };
}

/**
 * Makes one image the product's primary.
 *
 * Cleared before set, never both at once: a partial unique index allows only
 * one is_primary row per product, so flagging the new one first would collide
 * with the old one.
 */
export async function setAdminPrimaryProductImage(
  productId: string,
  imageId: string,
): Promise<AdminProductImageResult> {
  await assertAdmin();

  const referenceError = getReferenceError(productId, imageId);

  if (referenceError) {
    return { ok: false, error: referenceError };
  }

  const supabase = createSupabaseServiceRoleClient();
  const loaded = await loadImagesAndTarget(supabase, productId, imageId);

  if ("error" in loaded) {
    return { ok: false, error: loaded.error };
  }

  if (loaded.target.is_primary) {
    return { ok: true };
  }

  const { error: clearError } = await supabase
    .from("product_images")
    .update({ is_primary: false })
    .eq("product_id", productId)
    .eq("is_primary", true);

  if (clearError) {
    console.error("Failed to clear the previous primary image", clearError);
    return { ok: false, error: "Primary image could not be changed. Try again." };
  }

  const { error: setError } = await supabase
    .from("product_images")
    .update({ is_primary: true })
    .eq("id", imageId)
    .eq("product_id", productId);

  if (setError) {
    console.error("Failed to set the primary image", setError);
    return { ok: false, error: "Primary image could not be changed. Try again." };
  }

  return { ok: true };
}

/**
 * Moves one image a single place earlier or later.
 *
 * Reaching the end of the gallery is an ordinary outcome, not an error: the
 * controls disable those buttons, so a request that runs off the end means a
 * stale page and is answered by leaving the order alone.
 */
export async function moveAdminProductImage(
  productId: string,
  imageId: string,
  direction: unknown,
): Promise<AdminProductImageResult> {
  await assertAdmin();

  const referenceError = getReferenceError(productId, imageId);

  if (referenceError) {
    return { ok: false, error: referenceError };
  }

  if (!isProductImageMoveDirection(direction)) {
    return { ok: false, error: "That move direction is not recognised." };
  }

  const supabase = createSupabaseServiceRoleClient();
  const loaded = await loadImagesAndTarget(supabase, productId, imageId);

  if ("error" in loaded) {
    return { ok: false, error: loaded.error };
  }

  const reordered = getReorderedImageIds(
    loaded.images.map((image) => image.id),
    imageId,
    direction,
  );

  // Already at the end it was asked to move toward. Nothing changed, which is
  // not a failure.
  if (!reordered) {
    return { ok: true };
  }

  const wrote = await writeImageOrder(
    supabase,
    productId,
    reordered,
    getMaxSortOrder(loaded.images),
  );

  return wrote ? { ok: true } : { ok: false, error: ORDER_FAILED_MESSAGE };
}

/**
 * Removes one image row and leaves the rest in a clean 0..n-1 sequence.
 *
 * Only the image row is deleted. The product itself is never touched here — the
 * cascade runs the other way, from a deleted product down to its images.
 *
 * Removing the primary promotes whatever now leads the gallery, so a product
 * with images always has one to lead with. Removing the last image leaves no
 * primary at all, which is a legitimate state.
 */
export async function removeAdminProductImage(
  productId: string,
  imageId: string,
): Promise<AdminProductImageResult> {
  await assertAdmin();

  const referenceError = getReferenceError(productId, imageId);

  if (referenceError) {
    return { ok: false, error: referenceError };
  }

  const supabase = createSupabaseServiceRoleClient();
  const loaded = await loadImagesAndTarget(supabase, productId, imageId);

  if ("error" in loaded) {
    return { ok: false, error: loaded.error };
  }

  const { error: deleteError } = await supabase
    .from("product_images")
    .delete()
    .eq("id", imageId)
    .eq("product_id", productId);

  if (deleteError) {
    console.error("Failed to remove product image", deleteError);
    return { ok: false, error: "Image could not be removed. Try again." };
  }

  const remaining = loaded.images.filter((image) => image.id !== imageId);

  if (remaining.length === 0) {
    return { ok: true };
  }

  const wrote = await writeImageOrder(
    supabase,
    productId,
    remaining.map((image) => image.id),
    getMaxSortOrder(loaded.images),
  );

  if (!wrote) {
    return { ok: false, error: ORDER_FAILED_MESSAGE };
  }

  if (!loaded.target.is_primary) {
    return { ok: true };
  }

  // The only primary was just deleted, so nothing else is flagged and the new
  // leader can be set without clearing anything first.
  const { error: primaryError } = await supabase
    .from("product_images")
    .update({ is_primary: true })
    .eq("id", remaining[0].id)
    .eq("product_id", productId);

  if (primaryError) {
    console.error(
      "Failed to promote a new primary image after removal",
      primaryError,
    );
    return {
      ok: false,
      error:
        "The image was removed, but a new primary could not be chosen. Set one and try again.",
    };
  }

  return { ok: true };
}
