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

// Which timestamps a target status should end up with. Existing values are
// preserved on the way forward and cleared on the way back, so repeating a
// status never rewrites when it happened.
export function getFulfilmentTimestampPlan(status: FulfilmentStatus) {
  switch (status) {
    case "unfulfilled":
    case "processing":
      return { clearShippedAt: true, clearDeliveredAt: true };
    case "shipped":
      return { clearShippedAt: false, clearDeliveredAt: true };
    case "delivered":
      return { clearShippedAt: false, clearDeliveredAt: false };
  }
}
