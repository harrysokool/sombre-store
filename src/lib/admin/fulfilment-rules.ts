// Pure fulfilment rules. No database, no auth, no imports — so the rules that
// decide which transitions are legal can be reasoned about, and probed, alone.
// The same rules are enforced again inside set_order_fulfilment, which is the
// authority; this copy exists so the future admin UI can disable buttons
// instead of round-tripping to find out a move was refused.

export const FULFILMENT_STATUSES = [
  "unfulfilled",
  "processing",
  "shipped",
  "delivered",
] as const;

export type FulfilmentStatus = (typeof FULFILMENT_STATUSES)[number];

const FULFILMENT_RANK: Record<FulfilmentStatus, number> = {
  unfulfilled: 0,
  processing: 1,
  shipped: 2,
  delivered: 3,
};

export function isFulfilmentStatus(value: unknown): value is FulfilmentStatus {
  return (
    typeof value === "string" &&
    (FULFILMENT_STATUSES as readonly string[]).includes(value)
  );
}

// Forward moves advance exactly one step. Repeating the current status is a
// safe no-op, and any backward move is allowed so a mistake can be corrected.
export function isFulfilmentTransitionAllowed(
  from: FulfilmentStatus,
  to: FulfilmentStatus,
) {
  return FULFILMENT_RANK[to] <= FULFILMENT_RANK[from] + 1;
}

// A parcel cannot be shipped or delivered without a way to trace it.
export function requiresCourierAndTracking(status: FulfilmentStatus) {
  return status === "shipped" || status === "delivered";
}

export type FulfilmentEligibility = {
  paymentStatus: string;
  orderStatus: string;
  refundStatus: string | null;
  refundId: string | null;
  // A partial refund leaves the order row untouched, so it shows up only as an
  // unresolved refund webhook failure recorded against the order.
  hasUnresolvedRefundReview: boolean;
};

const SETTLED_PAYMENT_STATUSES = ["paid", "no_payment_required"];

const LOCKED_ORDER_STATUS_REASONS: Record<string, string> = {
  refunded: "This order was refunded, so fulfilment is locked.",
  refund_pending:
    "A refund is pending on this order. Fulfilment stays locked until it settles.",
  refund_failed:
    "A refund on this order failed. Settle it before fulfilling this order.",
  unfulfillable:
    "This order was marked unfulfillable because stock ran out after payment, so fulfilment is locked.",
};

// Why this order cannot be fulfilled right now, or null when it can be. Mirrors
// the eligibility gate at the top of set_order_fulfilment, which stays the
// authority; this copy exists so the admin UI can explain a locked order rather
// than offer controls the database would refuse.
export function getFulfilmentBlockReason(order: FulfilmentEligibility) {
  if (!SETTLED_PAYMENT_STATUSES.includes(order.paymentStatus)) {
    return "This order has not been paid, so it cannot be fulfilled.";
  }

  if (order.orderStatus !== "confirmed") {
    return (
      LOCKED_ORDER_STATUS_REASONS[order.orderStatus] ??
      "Only confirmed orders can be fulfilled."
    );
  }

  if (order.refundStatus || order.refundId) {
    return "A refund is recorded against this order, so fulfilment is locked.";
  }

  if (order.hasUnresolvedRefundReview) {
    return "This order has an unresolved partial refund that needs review. Settle it and mark the webhook failure resolved before fulfilling.";
  }

  return null;
}

// What a target status should leave behind. Existing values are preserved on
// the way forward and cleared on the way back, so repeating a status never
// rewrites when it happened. Below 'shipped' there is no parcel, so the courier
// and tracking reference are dropped along with the timestamps.
export function getFulfilmentResetPlan(status: FulfilmentStatus) {
  switch (status) {
    case "unfulfilled":
    case "processing":
      return {
        clearShippedAt: true,
        clearDeliveredAt: true,
        clearShipmentDetails: true,
      };
    case "shipped":
      return {
        clearShippedAt: false,
        clearDeliveredAt: true,
        clearShipmentDetails: false,
      };
    case "delivered":
      return {
        clearShippedAt: false,
        clearDeliveredAt: false,
        clearShipmentDetails: false,
      };
  }
}
