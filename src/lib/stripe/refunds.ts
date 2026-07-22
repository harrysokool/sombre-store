import type Stripe from "stripe";

// Pure refund decision helpers. Kept free of database and network access so the
// rules that decide whether inventory moves can be reasoned about, and probed,
// on their own.

export function getRefundPaymentIntentId(refund: Stripe.Refund) {
  return typeof refund.payment_intent === "string"
    ? refund.payment_intent
    : refund.payment_intent?.id ?? null;
}

// Stripe reports refund amounts in the currency's smallest unit, while an order
// total is stored in major units. An unknown or unusable amount is deliberately
// reported as NOT full: the safe failure is to leave stock alone and flag the
// refund for a human, never to hand inventory back on a guess.
export function isFullRefundAmount(
  refundAmountMinorUnits: number | null | undefined,
  orderTotalMajorUnits: number | string,
) {
  if (
    typeof refundAmountMinorUnits !== "number" ||
    !Number.isFinite(refundAmountMinorUnits)
  ) {
    return false;
  }

  const orderTotal = Math.round(Number(orderTotalMajorUnits) * 100);

  if (!Number.isFinite(orderTotal) || orderTotal <= 0) {
    return false;
  }

  // A refund can never exceed the charge, so treat an equal-or-greater amount as
  // covering the whole order.
  return refundAmountMinorUnits >= orderTotal;
}

export function describeRefundAmounts(
  refundAmountMinorUnits: number | null | undefined,
  orderTotalMajorUnits: number | string,
) {
  const refundAmount =
    typeof refundAmountMinorUnits === "number"
      ? (refundAmountMinorUnits / 100).toFixed(2)
      : "unknown";

  return `refunded ${refundAmount} of order total ${Number(
    orderTotalMajorUnits,
  ).toFixed(2)}`;
}
