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

  it("keeps field labels off the failing low-contrast class", () => {
    render(
      <OrderFulfilmentPanel
        orderId="11111111-1111-4111-8111-111111111111"
        status="unfulfilled"
        courier={null}
        trackingNumber={null}
        shippedAtLabel={null}
        deliveredAtLabel={null}
        updatedAtLabel={null}
        lockedReason={null}
      />,
    );

    // "Shipped"/"Delivered" only ever appear as read-only summary labels —
    // "Courier"/"Tracking number" also label the editable inputs below, so
    // asserting on those would match twice.
    const label = screen.getByText("Shipped");
    expect(label.className).not.toContain("text-stone-500");
    expect(label.className).toContain("text-stone-400");
  });

  it("leaves a disabled fulfilment control on its original (WCAG-exempt) disabled class when the order is locked", () => {
    render(
      <OrderFulfilmentPanel
        orderId="11111111-1111-4111-8111-111111111111"
        status="processing"
        courier={null}
        trackingNumber={null}
        shippedAtLabel={null}
        deliveredAtLabel={null}
        updatedAtLabel={null}
        lockedReason="This order was refunded, so fulfilment is locked."
      />,
    );

    const backButton = screen.getByRole("button", {
      name: "Move back to unfulfilled",
    });
    expect(backButton).toBeDisabled();
    expect(backButton.className).toContain("disabled:text-stone-600");
  });
});
