import { getAdminUser } from "@/lib/supabase/admin-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export type AdminOrderListItem = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  total: number | string;
  currency: string;
  payment_status: string;
  order_status: string;
};

export type AdminOrderDetail = AdminOrderListItem & {
  customer_phone: string | null;
  address_line_1: string;
  address_line_2: string | null;
  district: string | null;
  city: string;
  postal_code: string | null;
  country: string;
  subtotal: number | string;
  shipping_fee: number | string;
  refund_status: string | null;
  refund_id: string | null;
  refunded_at: string | null;
};

export type AdminOrderItem = {
  id: string;
  product_name: string;
  size_label: string | null;
  unit_price: number | string;
  quantity: number;
};

const ORDER_LIST_COLUMNS =
  "id, created_at, customer_name, customer_email, total, currency, payment_status, order_status";

const ORDER_DETAIL_COLUMNS = `${ORDER_LIST_COLUMNS}, customer_phone, address_line_1, address_line_2, district, city, postal_code, country, subtotal, shipping_fee, refund_status, refund_id, refunded_at`;

// Orders hold private customer data, so every read here re-checks the admin
// gate itself rather than trusting the caller to have done it. Throws instead of
// redirecting so a page's error handling cannot swallow a redirect signal.
async function assertAdmin() {
  const adminUser = await getAdminUser();

  if (!adminUser) {
    throw new Error("Admin order data requested without an approved session.");
  }
}

export async function listAdminOrders(): Promise<AdminOrderListItem[]> {
  await assertAdmin();

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<AdminOrderListItem[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getAdminOrder(orderId: string) {
  await assertAdmin();

  const supabase = createSupabaseServiceRoleClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(ORDER_DETAIL_COLUMNS)
    .eq("id", orderId)
    .maybeSingle<AdminOrderDetail>();

  if (orderError) {
    throw orderError;
  }

  if (!order) {
    return null;
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id, product_name, size_label, unit_price, quantity")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true })
    .returns<AdminOrderItem[]>();

  if (itemsError) {
    throw itemsError;
  }

  return { order, items: items ?? [] };
}
