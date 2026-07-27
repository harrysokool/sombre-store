import type { FulfilmentStatus } from "@/lib/admin/fulfilment-rules";
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
  fulfilment_status: FulfilmentStatus;
};

export type AdminOrderDetail = AdminOrderListItem & {
  customer_phone: string | null;
  address_line_1: string;
  address_line_2: string | null;
  district: string | null;
  city: string;
  postal_code: string | null;
  country: string;
  coupon_code: string | null;
  original_subtotal: number | string | null;
  discount_total: number | string | null;
  subtotal: number | string;
  shipping_fee: number | string;
  refund_status: string | null;
  refund_id: string | null;
  refunded_at: string | null;
  stock_reduced_at: string | null;
  stock_restored_at: string | null;
  courier: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  fulfilment_updated_at: string | null;
};

export type AdminOrderItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  size_label: string | null;
  unit_price: number | string;
  original_unit_price: number | string | null;
  discount_percent: number | string | null;
  quantity: number;
  original_line_total: number | string | null;
  discount_amount: number | string | null;
  discounted_line_total: number | string | null;
};

export type AdminStockRestoration = {
  id: string;
  request_id: string;
  order_id: string;
  order_item_id: string;
  product_id: string;
  quantity_restored: number;
  reason: string;
  administrator_user_id: string | null;
  administrator_email: string | null;
  source: "administrator" | "legacy_automatic";
  restored_at: string;
};

const ORDER_LIST_COLUMNS =
  "id, created_at, customer_name, customer_email, total, currency, payment_status, order_status, fulfilment_status";

const ORDER_DETAIL_COLUMNS = `${ORDER_LIST_COLUMNS}, customer_phone, address_line_1, address_line_2, district, city, postal_code, country, coupon_code, original_subtotal, discount_total, subtotal, shipping_fee, refund_status, refund_id, refunded_at, stock_reduced_at, stock_restored_at, courier, tracking_number, shipped_at, delivered_at, fulfilment_updated_at`;

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
    .select(
      "id, product_id, product_name, size_label, unit_price, original_unit_price, discount_percent, quantity, original_line_total, discount_amount, discounted_line_total",
    )
    .eq("order_id", order.id)
    .order("created_at", { ascending: true })
    .returns<AdminOrderItem[]>();

  if (itemsError) {
    throw itemsError;
  }

  // set_order_fulfilment refuses to run while one of these is outstanding, so
  // the page reads it too and can say why the controls are locked.
  const { data: refundReview, error: refundReviewError } = await supabase
    .from("webhook_failures")
    .select("id")
    .eq("order_id", order.id)
    .eq("is_resolved", false)
    .like("stripe_event_type", "refund.%")
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (refundReviewError) {
    throw refundReviewError;
  }

  const { data: stockRestorations, error: stockRestorationsError } =
    await supabase
      .from("order_item_stock_restorations")
      .select(
        "id, request_id, order_id, order_item_id, product_id, quantity_restored, reason, administrator_user_id, administrator_email, source, restored_at",
      )
      .eq("order_id", order.id)
      .order("restored_at", { ascending: false })
      .returns<AdminStockRestoration[]>();

  if (stockRestorationsError) {
    throw stockRestorationsError;
  }

  return {
    order,
    items: items ?? [],
    hasUnresolvedRefundReview: Boolean(refundReview),
    stockRestorations: stockRestorations ?? [],
  };
}
