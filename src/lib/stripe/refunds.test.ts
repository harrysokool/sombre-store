import { describe, expect, it } from "vitest";

import { isFullRefundAmount } from "./refunds";

describe("isFullRefundAmount", () => {
  it("recognizes a full refund from a discounted decimal order total", () => {
    expect(isFullRefundAmount(215_025, "2150.25")).toBe(true);
    expect(isFullRefundAmount(215_024, "2150.25")).toBe(false);
  });
});
