import type { FulfilmentStatus } from "@/lib/admin/fulfilment-rules";
import {
  addSafeNonNegativeIntegers,
  parseHkdDecimalToCents,
} from "@/lib/checkout/money";

export const ADMIN_HOME_RECENT_LIMIT = 5;

export const AWAITING_FULFILMENT_STATUSES = [
  "unfulfilled",
  "processing",
] as const satisfies readonly FulfilmentStatus[];

export type AdminHomeRevenueOrder = {
  id: string;
  total: number | string;
};

export type AdminHomeRecentOrder = {
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

export type AdminHomeRecentFailure = {
  source: "webhook" | "email";
  id: string;
  orderId: string | null;
  title: string;
  status: string;
  occurredAt: string;
};

function toExcludedOrderIds(orderIds: Iterable<string>) {
  return orderIds instanceof Set ? orderIds : new Set(orderIds);
}

/**
 * Sums normal, recorded HKD sales exactly in cents.
 *
 * The data query applies the shared paid/confirmed/HKD/refund filters before
 * selecting only IDs and totals. Orders with any linked refund failure are
 * excluded because a partial refund's retained amount is not represented in
 * the orders table.
 */
export function calculateAdminHomeRevenueCents(
  orders: readonly AdminHomeRevenueOrder[],
  excludedOrderIds: Iterable<string> = [],
) {
  const excluded = toExcludedOrderIds(excludedOrderIds);
  const totals = orders
    .filter((order) => !excluded.has(order.id))
    .map((order) => parseHkdDecimalToCents(String(order.total)));

  return addSafeNonNegativeIntegers(totals, "Admin revenue");
}

function timestampValue(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

export function selectRecentAdminHomeFailures(
  failures: readonly AdminHomeRecentFailure[],
  limit = ADMIN_HOME_RECENT_LIMIT,
) {
  const safeLimit =
    Number.isSafeInteger(limit) && limit >= 0 ? limit : ADMIN_HOME_RECENT_LIMIT;

  return [...failures]
    .sort(
      (left, right) =>
        timestampValue(right.occurredAt) -
          timestampValue(left.occurredAt) ||
        left.source.localeCompare(right.source) ||
        left.id.localeCompare(right.id),
    )
    .slice(0, safeLimit);
}
