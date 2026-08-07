"use server";

import { revalidatePath } from "next/cache";

import {
  addAdminProductImage,
  moveAdminProductImage,
  removeAdminProductImage,
  setAdminPrimaryProductImage,
  updateAdminProductImageAltText,
  uploadAdminProductImage,
  type AdminProductImageResult,
} from "@/lib/admin/product-images";
import { getAdminUser } from "@/lib/supabase/admin-auth";

export type ProductImageActionState = {
  error: string | null;
};

const EXPIRED_SESSION_ERROR =
  "Your admin session has ended. Sign in again to manage images.";
const INVALID_REFERENCE_ERROR = "That image reference is not valid.";

/**
 * Runs one image mutation behind its own admin gate.
 *
 * A Server Action is its own endpoint: anyone can post to it without ever
 * rendering the admin page, so every one of these re-checks the session here.
 * The data layer checks again and throws, which is the real backstop — this
 * only turns an expired session into a message instead of a crash.
 *
 * The product and image references come from the browser and are treated as
 * claims: the data layer scopes every read and write to both ids together, so a
 * pair that does not belong together matches no row.
 */
async function runImageAction(
  formData: FormData,
  mutate: (productId: string, imageId: string) => Promise<AdminProductImageResult>,
  options: { requiresImage: boolean },
): Promise<ProductImageActionState> {
  if (!(await getAdminUser())) {
    return { error: EXPIRED_SESSION_ERROR };
  }

  const productId = formData.get("productId");
  const imageId = formData.get("imageId");

  if (
    typeof productId !== "string" ||
    (options.requiresImage && typeof imageId !== "string")
  ) {
    return { error: INVALID_REFERENCE_ERROR };
  }

  let result: AdminProductImageResult;

  try {
    result = await mutate(
      productId.trim(),
      typeof imageId === "string" ? imageId.trim() : "",
    );
  } catch (error) {
    // Nothing from Supabase or PostgreSQL reaches the administrator: the detail
    // goes to the server log and the form gets one generic message.
    console.error("Admin product image action failed", error);
    return { error: "That change could not be saved. Try again." };
  }

  if (!result.ok) {
    return { error: result.error };
  }

  // Only after a confirmed write. The editor is re-rendered from the database,
  // so the new order, primary, and alt text all come back from the source
  // rather than from optimistic browser state.
  revalidatePath(`/admin/products/${productId.trim()}/edit`);
  revalidatePath("/admin/inventory");

  return { error: null };
}

export async function addProductImageAction(
  _previousState: ProductImageActionState,
  formData: FormData,
): Promise<ProductImageActionState> {
  return runImageAction(
    formData,
    (productId) =>
      addAdminProductImage(productId, {
        imageUrl: formData.get("imageUrl"),
        altText: formData.get("altText"),
      }),
    { requiresImage: false },
  );
}

/**
 * Stores an uploaded file and records it against a product.
 *
 * Takes FormData because the file arrives as one. Only the file and the alt
 * text are read from it: a storage path, a sort order, or a primary flag posted
 * alongside them is ignored, because the data layer derives all three itself.
 *
 * Shares the gated runner with every other image action, so the session check,
 * the generic error message, and the revalidation that follows a confirmed
 * write are the same here as everywhere else.
 */
export async function uploadProductImageAction(
  _previousState: ProductImageActionState,
  formData: FormData,
): Promise<ProductImageActionState> {
  return runImageAction(
    formData,
    (productId) =>
      uploadAdminProductImage(productId, {
        file: formData.get("file"),
        altText: formData.get("altText"),
      }),
    { requiresImage: false },
  );
}

export async function updateProductImageAltTextAction(
  _previousState: ProductImageActionState,
  formData: FormData,
): Promise<ProductImageActionState> {
  return runImageAction(
    formData,
    (productId, imageId) =>
      updateAdminProductImageAltText(
        productId,
        imageId,
        formData.get("altText"),
      ),
    { requiresImage: true },
  );
}

export async function setPrimaryProductImageAction(
  _previousState: ProductImageActionState,
  formData: FormData,
): Promise<ProductImageActionState> {
  return runImageAction(
    formData,
    (productId, imageId) => setAdminPrimaryProductImage(productId, imageId),
    { requiresImage: true },
  );
}

export async function moveProductImageAction(
  _previousState: ProductImageActionState,
  formData: FormData,
): Promise<ProductImageActionState> {
  return runImageAction(
    formData,
    (productId, imageId) =>
      moveAdminProductImage(productId, imageId, formData.get("direction")),
    { requiresImage: true },
  );
}

export async function removeProductImageAction(
  _previousState: ProductImageActionState,
  formData: FormData,
): Promise<ProductImageActionState> {
  return runImageAction(
    formData,
    (productId, imageId) => removeAdminProductImage(productId, imageId),
    { requiresImage: true },
  );
}
