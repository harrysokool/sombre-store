// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/actions", () => ({
  updateOrderFulfilment: vi.fn(),
}));

import { OrderFulfilmentPanel } from "./order-fulfilment-panel";

describe("order fulfilment panel", () => {
  afterEach(() => {
    cleanup();
  });

  it("wraps a long tracking number instead of letting it overflow", () => {
    const longTrackingNumber =
      "SF1234567890123456789012345678901234567890123456789012345678901234567890";

    render(
      <OrderFulfilmentPanel
        orderId="11111111-1111-4111-8111-111111111111"
        status="unfulfilled"
        courier="SF Express"
        trackingNumber={longTrackingNumber}
        shippedAtLabel={null}
        deliveredAtLabel={null}
        updatedAtLabel={null}
        lockedReason={null}
      />,
    );

    const trackingValue = screen.getByText(longTrackingNumber);
    expect(trackingValue.className).toContain("break-words");
    expect(trackingValue.className).toContain("overflow-wrap:anywhere");
  });
});
