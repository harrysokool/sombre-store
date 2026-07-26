import "server-only";

import {
  normalizeInventoryProduct,
  type AdminInventoryProduct,
  type AdminInventoryProductRow,
} from "@/lib/admin/inventory";
import { getAdminUser } from "@/lib/supabase/admin-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const INVENTORY_COLUMNS = `
  id,
  name,
  price,
  stock_quantity,
  is_active,
  brand:brands (
    name
  ),
  category:categories (
    name
  ),
  product_images (
    image_url,
    alt_text
  )
`;

async function assertAdmin() {
  const adminUser = await getAdminUser();

  if (!adminUser) {
    throw new Error(
      "Admin inventory data requested without an approved session.",
    );
  }
}

/**
 * Reads the complete active and inactive catalog in one request.
 *
 * The embedded image relation is ordered and limited inside the same PostgREST
 * query. That returns one primary-first thumbnail per product without loading
 * every gallery image or issuing a follow-up query for each row.
 */
export async function listAdminInventory(): Promise<AdminInventoryProduct[]> {
  await assertAdmin();

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("products")
    .select(INVENTORY_COLUMNS)
    .order("name", { ascending: true })
    .order("is_primary", {
      ascending: false,
      referencedTable: "product_images",
    })
    .order("sort_order", {
      ascending: true,
      referencedTable: "product_images",
    })
    .limit(1, { referencedTable: "product_images" })
    .returns<AdminInventoryProductRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(normalizeInventoryProduct);
}
