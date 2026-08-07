"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminProduct } from "@/lib/admin/products";
import { getAdminUser } from "@/lib/supabase/admin-auth";

export type ProductActionState = {
  error: string | null;
};

const EXPIRED_SESSION_ERROR =
  "Your admin session has ended. Sign in again to create a product.";

function readProductSubmission(formData: FormData) {
  return {
    name: formData.get("name"),
    slug: formData.get("slug"),
    brandId: formData.get("brandId"),
    categoryId: formData.get("categoryId"),
    sizeLabel: formData.get("sizeLabel"),
    shortDescription: formData.get("shortDescription"),
    description: formData.get("description"),
    price: formData.get("price"),
    retailPrice: formData.get("retailPrice"),
    stockQuantity: formData.get("stockQuantity"),
    // An unchecked checkbox is not submitted at all, so an absent value is what
    // "inactive" looks like here.
    isActive: formData.get("isActive") === "on",
  };
}

export async function createProductAction(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  // A Server Action is its own endpoint: anyone can post to it without ever
  // rendering the admin page, so the gate is re-checked here. createAdminProduct
  // checks again and throws, which is the real backstop — this branch only
  // turns an expired session into a message instead of a crash.
  if (!(await getAdminUser())) {
    return { error: EXPIRED_SESSION_ERROR };
  }

  let result: Awaited<ReturnType<typeof createAdminProduct>>;

  try {
    result = await createAdminProduct(readProductSubmission(formData));
  } catch (error) {
    // Nothing from Supabase or PostgreSQL reaches the administrator: the detail
    // goes to the server log and the form gets one generic message.
    console.error("Admin product creation failed", error);
    return { error: "Product could not be created. Try again." };
  }

  // A refusal keeps the administrator on the form with their input intact.
  if (!result.ok) {
    return { error: result.error };
  }

  // Inventory is where the new product is listed, and where the administrator
  // is sent below to see it.
  revalidatePath("/admin/inventory");

  // Only after a confirmed write. redirect() throws to signal, so it must run
  // outside the try/catch above, which would otherwise swallow it.
  redirect("/admin/inventory");
}
