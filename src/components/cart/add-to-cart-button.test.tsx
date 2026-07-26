// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AddToCartButton } from "./add-to-cart-button";

const BASE_PRODUCT = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "replica-jazz-club",
  name: "Replica Jazz Club",
  price: 1200,
  size_label: "100 mL",
  image_url: null,
};

describe("add to cart button text contrast", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps the Quantity label off the failing low-contrast class", () => {
    render(
      <AddToCartButton product={{ ...BASE_PRODUCT, stock_quantity: 5 }} />,
    );

    const label = screen.getByText("Quantity");
    expect(label.className).not.toContain("text-stone-500");
    expect(label.className).toContain("text-stone-400");
  });

  it("leaves the disabled sold-out button on its original (WCAG-exempt) disabled class", () => {
    render(
      <AddToCartButton product={{ ...BASE_PRODUCT, stock_quantity: 0 }} />,
    );

    const button = screen.getByRole("button", { name: "Sold out" });
    expect(button).toBeDisabled();
    // Disabled controls have no WCAG contrast requirement, so this one is
    // deliberately left untouched.
    expect(button.className).toContain("disabled:text-stone-500");
  });
});
