// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/coupons/actions", () => ({
  createCouponAction: vi.fn(),
  updateCouponAction: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { CouponForm } from "./coupon-form";

const PRODUCT_A = "22222222-2222-4222-8222-222222222222";
const PRODUCT_B = "33333333-3333-4333-8333-333333333333";

const products = [
  {
    id: PRODUCT_A,
    name: "Product A",
    slug: "product-a",
    price: "1000.00",
  },
  {
    id: PRODUCT_B,
    name: "Product B",
    slug: "product-b",
    price: "500.00",
  },
];

describe("admin coupon form", () => {
  afterEach(() => {
    cleanup();
  });

  it("adds active products, accepts different percentages, and removes assignments", async () => {
    const user = userEvent.setup();

    render(
      <CouponForm
        mode="edit"
        couponId="11111111-1111-4111-8111-111111111111"
        code="SOMBRE"
        products={products}
        initialAssignments={[
          { product_id: PRODUCT_A, discount_percent: "20.00" },
        ]}
      />,
    );

    expect(screen.getByText("1 product assigned")).toBeInTheDocument();
    expect(screen.getByDisplayValue("20.00")).toBeInTheDocument();
    expect(screen.getByText("Current price HK$1,000.00")).toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Active product to add" }),
      PRODUCT_B,
    );
    await user.click(screen.getByRole("button", { name: "Add product" }));

    expect(screen.getByText("2 products assigned")).toBeInTheDocument();
    const percentageInputs = screen.getAllByRole("spinbutton");
    await user.clear(percentageInputs[1]);
    await user.type(percentageInputs[1], "5.25");
    expect(percentageInputs[1]).toHaveValue(5.25);

    await user.click(
      screen.getByRole("button", {
        name: "Remove Product A assignment",
      }),
    );

    expect(screen.getByText("1 product assigned")).toBeInTheDocument();
    expect(screen.queryByText("Product A")).toBeNull();
    expect(screen.getByDisplayValue("5.25")).toBeInTheDocument();
  });
});
