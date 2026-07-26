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

const PRODUCT_C_INACTIVE = "44444444-4444-4444-8444-444444444444";

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
          {
            product_id: PRODUCT_A,
            discount_percent: "20.00",
            product_name: "Product A",
            product_slug: "product-a",
            product_price: "1000.00",
            is_active: true,
          },
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

  it("shows an assignment to a since-deactivated product, labeled and counted, and preserves it in the submitted form", () => {
    render(
      <CouponForm
        mode="edit"
        couponId="11111111-1111-4111-8111-111111111111"
        code="SOMBRE"
        products={products}
        initialAssignments={[
          {
            product_id: PRODUCT_A,
            discount_percent: "20.00",
            product_name: "Product A",
            product_slug: "product-a",
            product_price: "1000.00",
            is_active: true,
          },
          {
            product_id: PRODUCT_C_INACTIVE,
            discount_percent: "15.00",
            product_name: "Discontinued Product",
            product_slug: "discontinued-product",
            product_price: "750.00",
            is_active: false,
          },
        ]}
      />,
    );

    // Both assignments count, including the inactive one.
    expect(screen.getByText("2 products assigned")).toBeInTheDocument();
    expect(screen.getByText("Discontinued Product")).toBeInTheDocument();
    expect(screen.getByText("Inactive product")).toBeInTheDocument();

    // Its product ID and discount percentage are still submitted.
    const hiddenInputs = document.querySelectorAll(
      'input[type="hidden"][name="productId"]',
    );
    expect(
      Array.from(hiddenInputs).map((input) => (input as HTMLInputElement).value),
    ).toContain(PRODUCT_C_INACTIVE);
    expect(
      screen.getByRole("spinbutton", {
        name: "Discount percentage for Discontinued Product",
      }),
    ).toHaveValue(15);

    // An inactive product can never appear in the "add a product" picker.
    expect(
      screen.queryByRole("option", { name: /Discontinued Product/ }),
    ).toBeNull();
  });

  it("only removes the inactive assignment the admin explicitly removes", async () => {
    const user = userEvent.setup();

    render(
      <CouponForm
        mode="edit"
        couponId="11111111-1111-4111-8111-111111111111"
        code="SOMBRE"
        products={products}
        initialAssignments={[
          {
            product_id: PRODUCT_A,
            discount_percent: "20.00",
            product_name: "Product A",
            product_slug: "product-a",
            product_price: "1000.00",
            is_active: true,
          },
          {
            product_id: PRODUCT_C_INACTIVE,
            discount_percent: "15.00",
            product_name: "Discontinued Product",
            product_slug: "discontinued-product",
            product_price: "750.00",
            is_active: false,
          },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Remove Discontinued Product assignment",
      }),
    );

    expect(screen.getByText("1 product assigned")).toBeInTheDocument();
    expect(screen.queryByText("Discontinued Product")).toBeNull();
    expect(screen.getByText("Product A")).toBeInTheDocument();
  });

  it("shows a message when every active product is already assigned", () => {
    render(
      <CouponForm
        mode="edit"
        couponId="11111111-1111-4111-8111-111111111111"
        code="SOMBRE"
        products={products}
        initialAssignments={products.map((product) => ({
          product_id: product.id,
          discount_percent: "10.00",
          product_name: product.name,
          product_slug: product.slug,
          product_price: product.price,
          is_active: true,
        }))}
      />,
    );

    expect(
      screen.getByText(
        "Every active product is already assigned to this coupon.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("gives every discount input a unique accessible label", () => {
    render(
      <CouponForm
        mode="edit"
        couponId="11111111-1111-4111-8111-111111111111"
        code="SOMBRE"
        products={products}
        initialAssignments={products.map((product) => ({
          product_id: product.id,
          discount_percent: "10.00",
          product_name: product.name,
          product_slug: product.slug,
          product_price: product.price,
          is_active: true,
        }))}
      />,
    );

    expect(
      screen.getByRole("spinbutton", {
        name: "Discount percentage for Product A",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", {
        name: "Discount percentage for Product B",
      }),
    ).toBeInTheDocument();
  });

  it("keeps field labels off the failing low-contrast class, while leaving the placeholder untouched", () => {
    render(
      <CouponForm
        mode="create"
        code=""
        products={products}
        initialAssignments={[]}
      />,
    );

    const label = screen.getByText("Coupon code");
    expect(label.className).not.toContain("text-stone-500");
    expect(label.className).toContain("text-stone-400");

    const codeInput = screen.getByPlaceholderText("SOMBRE");
    // Placeholder text is a WCAG-exempt state and is left as-is.
    expect(codeInput.className).toContain("placeholder:text-stone-600");
  });
});
