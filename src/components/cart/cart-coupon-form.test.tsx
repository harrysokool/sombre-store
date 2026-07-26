// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CartCouponForm } from "./cart-coupon-form";

describe("cart coupon form text contrast", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps the coupon instructions off the failing low-contrast class", () => {
    render(
      <CartCouponForm
        code=""
        onCodeChange={vi.fn()}
        onApply={vi.fn()}
        onRemove={vi.fn()}
        isLoading={false}
        appliedCoupon={null}
        errorMessage={null}
      />,
    );

    const instructions = screen.getByText(
      "Enter one code. Applying another replaces the current coupon.",
    );

    expect(instructions.className).not.toContain("text-stone-500");
    expect(instructions.className).toContain("text-stone-400");
  });
});
