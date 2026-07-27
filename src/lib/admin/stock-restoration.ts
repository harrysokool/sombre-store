import "server-only";

import { getAdminUser } from "@/lib/supabase/admin-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REASON_LENGTH = 1000;

export type RestoreOrderItemStockInput = {
  requestId: string;
  orderId: string;
  orderItemId: string;
  quantity: number | string;
  reason: string;
};

export type RestoredOrderItemStock = {
  restorationId: string;
  quantityRestored: number;
  totalRestored: number | null;
  remainingQuantity: number | null;
  newStockQuantity: number | null;
  alreadyApplied: boolean;
};

export type RestoreOrderItemStockResult =
  | { restoration: RestoredOrderItemStock; error?: undefined }
  | { restoration?: undefined; error: string };

type StockRestorationRpcResult = {
  ok: boolean;
  reason?: string;
  restoration_id?: string;
  quantity_restored?: number;
  total_restored?: number;
  remaining_quantity?: number;
  new_stock_quantity?: number;
  already_applied?: boolean;
  purchased_quantity?: number;
  already_restored?: number;
};

function describeRefusal(result: StockRestorationRpcResult) {
  switch (result.reason) {
    case "order_not_found":
      return "That order could not be found.";
    case "order_not_refunded":
      return "Stock can only be restored after the full refund has succeeded.";
    case "stock_not_reduced":
      return "This order did not reduce sellable stock, so there is nothing to restore.";
    case "legacy_stock_already_restored":
      return "This older order already had all stock restored automatically.";
    case "order_item_not_found":
      return "That purchased item does not belong to this order.";
    case "product_not_available":
      return "The catalog product no longer exists, so its stock cannot be restored.";
    case "quantity_exceeds_purchased":
      return `Only ${Math.max(result.remaining_quantity ?? 0, 0)} unit(s) remain eligible for restoration.`;
    case "idempotency_conflict":
      return "That restoration request was already used with different details. Refresh the page and try again.";
    case "invalid_request_id":
      return "That restoration request is not valid. Refresh the page and try again.";
    case "invalid_quantity":
      return "Enter a whole-number quantity greater than zero.";
    case "invalid_reason":
      return `Enter a reason between 1 and ${MAX_REASON_LENGTH} characters.`;
    case "missing_administrator_identity":
      return "The administrator identity could not be recorded.";
    default:
      return "That stock restoration was refused.";
  }
}

export async function restoreOrderItemStock(
  input: RestoreOrderItemStockInput,
): Promise<RestoreOrderItemStockResult> {
  const adminUser = await getAdminUser();

  if (!adminUser) {
    throw new Error(
      "Order-item stock restoration requested without an approved session.",
    );
  }

  const requestId = input.requestId.trim();
  const orderId = input.orderId.trim();
  const orderItemId = input.orderItemId.trim();
  const reason = input.reason.trim();
  const quantity = Number(input.quantity);

  if (!UUID_PATTERN.test(requestId)) {
    return {
      error: "That restoration request is not valid. Refresh the page and try again.",
    };
  }

  if (!UUID_PATTERN.test(orderId)) {
    return { error: "That order reference is not valid." };
  }

  if (!UUID_PATTERN.test(orderItemId)) {
    return { error: "That purchased item reference is not valid." };
  }

  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    return { error: "Enter a whole-number quantity greater than zero." };
  }

  if (!reason || reason.length > MAX_REASON_LENGTH) {
    return {
      error: `Enter a reason between 1 and ${MAX_REASON_LENGTH} characters.`,
    };
  }

  if (!UUID_PATTERN.test(adminUser.id)) {
    throw new Error(
      "The approved administrator account does not have a valid user identifier.",
    );
  }

  const administratorEmail = adminUser.email?.trim().toLowerCase() || null;
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc(
    "restore_order_item_sellable_stock",
    {
      p_request_id: requestId,
      p_order_id: orderId,
      p_order_item_id: orderItemId,
      p_quantity: quantity,
      p_reason: reason,
      p_administrator_user_id: adminUser.id,
      p_administrator_email: administratorEmail,
    },
  );

  if (error) {
    throw error;
  }

  const result = data as StockRestorationRpcResult | null;

  if (
    !result?.ok ||
    !result.restoration_id ||
    !Number.isSafeInteger(result.quantity_restored)
  ) {
    return { error: describeRefusal(result ?? { ok: false }) };
  }

  return {
    restoration: {
      restorationId: result.restoration_id,
      quantityRestored: result.quantity_restored!,
      totalRestored: result.total_restored ?? null,
      remainingQuantity: result.remaining_quantity ?? null,
      newStockQuantity: result.new_stock_quantity ?? null,
      alreadyApplied: result.already_applied === true,
    },
  };
}
