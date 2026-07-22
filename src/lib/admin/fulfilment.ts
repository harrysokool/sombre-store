import {
  isFulfilmentStatus,
  requiresCourierAndTracking,
  type FulfilmentStatus,
} from "@/lib/admin/fulfilment-rules";
import { getAdminUser } from "@/lib/supabase/admin-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_COURIER_LENGTH = 100;
const MAX_TRACKING_LENGTH = 100;

export type OrderFulfilment = {
  fulfilment_status: FulfilmentStatus;
  courier: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  fulfilment_updated_at: string | null;
};

export type SetOrderFulfilmentInput = {
  orderId: string;
  status: string;
  courier?: string | null;
  trackingNumber?: string | null;
};

export type SetOrderFulfilmentResult =
  | { fulfilment: OrderFulfilment; error?: undefined }
  | { fulfilment?: undefined; error: string };

type FulfilmentRpcResult = {
  ok: boolean;
  reason?: string;
  from?: string;
  to?: string;
  fulfilment?: OrderFulfilment;
};

// Fulfilment reads and writes order rows, which hold private customer data, so
// the admin gate is re-checked here rather than trusting the caller. Throws
// instead of returning, so a security failure cannot be mistaken for a
// validation message and quietly rendered to a page.
async function assertAdmin() {
  const adminUser = await getAdminUser();

  if (!adminUser) {
    throw new Error("Order fulfilment requested without an approved session.");
  }

  return adminUser;
}

function describeRefusal(result: FulfilmentRpcResult) {
  switch (result.reason) {
    case "not_found":
      return "That order could not be found.";
    case "not_eligible":
      return "Only paid, confirmed orders with no refund can be updated.";
    case "partial_refund_review_required":
      return "This order has an unresolved partial refund that needs review. Settle it and mark the webhook failure resolved before fulfilling.";
    case "invalid_transition":
      return `Cannot move an order from ${result.from} straight to ${result.to}.`;
    case "missing_tracking":
      return "Add a courier and tracking number before marking an order shipped.";
    default:
      return "That fulfilment update was refused.";
  }
}

/**
 * Sets an order's fulfilment state. Intended entry point for the future admin
 * UI: validate here, then let the database make the change atomically.
 *
 * Writes only fulfilment columns. Payment, refund, and stock fields are never
 * touched, by this function or by the RPC it calls.
 */
export async function setOrderFulfilment(
  input: SetOrderFulfilmentInput,
): Promise<SetOrderFulfilmentResult> {
  await assertAdmin();

  if (!UUID_PATTERN.test(input.orderId.trim())) {
    return { error: "That order reference is not valid." };
  }

  if (!isFulfilmentStatus(input.status)) {
    return { error: "That fulfilment status is not recognised." };
  }

  const courier = input.courier?.trim() || null;
  const trackingNumber = input.trackingNumber?.trim() || null;

  if (courier && courier.length > MAX_COURIER_LENGTH) {
    return { error: `Courier must be ${MAX_COURIER_LENGTH} characters or fewer.` };
  }

  if (trackingNumber && trackingNumber.length > MAX_TRACKING_LENGTH) {
    return {
      error: `Tracking number must be ${MAX_TRACKING_LENGTH} characters or fewer.`,
    };
  }

  // Checked again inside the RPC against the order's stored values, which is
  // the authority. This early check only saves a round trip when the caller
  // supplied neither value.
  if (
    requiresCourierAndTracking(input.status) &&
    !courier &&
    !trackingNumber
  ) {
    return {
      error: "Add a courier and tracking number before marking an order shipped.",
    };
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("set_order_fulfilment", {
    p_order_id: input.orderId.trim(),
    p_fulfilment_status: input.status,
    p_courier: courier,
    p_tracking_number: trackingNumber,
  });

  if (error) {
    throw error;
  }

  const result = data as FulfilmentRpcResult | null;

  if (!result?.ok || !result.fulfilment) {
    return { error: describeRefusal(result ?? { ok: false }) };
  }

  return { fulfilment: result.fulfilment };
}

/** Reads the current fulfilment state of one order. */
export async function getOrderFulfilment(
  orderId: string,
): Promise<OrderFulfilment | null> {
  await assertAdmin();

  if (!UUID_PATTERN.test(orderId.trim())) {
    return null;
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "fulfilment_status, courier, tracking_number, shipped_at, delivered_at, fulfilment_updated_at",
    )
    .eq("id", orderId.trim())
    .maybeSingle<OrderFulfilment>();

  if (error) {
    throw error;
  }

  return data;
}
