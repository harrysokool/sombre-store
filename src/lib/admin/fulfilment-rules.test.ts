import { describe, expect, it } from "vitest";

import {
  getFulfilmentBlockReason,
  isSettledPaymentStatus,
  SETTLED_PAYMENT_STATUSES,
} from "./fulfilment-rules";

describe("settled payment rules", () => {
  it("exports the two payment states already accepted by fulfilment", () => {
    expect(SETTLED_PAYMENT_STATUSES).toEqual([
      "paid",
      "no_payment_required",
    ]);
    expect(isSettledPaymentStatus("paid")).toBe(true);
    expect(isSettledPaymentStatus("no_payment_required")).toBe(true);
  });

  it.each(["unpaid", "failed", "canceled", "pending", ""])(
    "does not consider %j settled",
    (status) => {
      expect(isSettledPaymentStatus(status)).toBe(false);
      expect(
        getFulfilmentBlockReason({
          paymentStatus: status,
          orderStatus: "confirmed",
          refundStatus: null,
          refundId: null,
          hasUnresolvedRefundReview: false,
        }),
      ).toMatch(/has not been paid/i);
    },
  );
});
