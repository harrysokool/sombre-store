// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CartItem } from "@/lib/cart/cart";

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

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

import { CartLineItem } from "./cart-line-item";

function cartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "replica-jazz-club",
    name: "Replica Jazz Club",
    price: 1200,
    size_label: "100 mL",
    image_url: null,
    stock_quantity: 5,
    quantity: 2,
    ...overrides,
  };
}

describe("cart line item text contrast", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps size label, remove control, and the per-unit price off the failing low-contrast class", () => {
    render(
      <CartLineItem
        item={cartItem({ quantity: 2 })}
        onIncrement={vi.fn()}
        onDecrement={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const sizeLabel = screen.getByText("100 mL");
    expect(sizeLabel.className).not.toContain("text-stone-500");
    expect(sizeLabel.className).toContain("text-stone-400");

    const removeButton = screen.getByRole("button", {
      name: "Remove Replica Jazz Club from cart",
    });
    expect(removeButton.className).not.toContain("text-stone-500");
    expect(removeButton.className).toContain("text-stone-400");
    // Hover must still read differently from the resting state.
    expect(removeButton.className).toContain("hover:text-stone-200");

    const perUnitPrice = screen.getByText("HK$1,200.00 each");
    expect(perUnitPrice.className).not.toContain("text-stone-500");
    expect(perUnitPrice.className).toContain("text-stone-400");
  });

  it("keeps the availability note off the failing low-contrast class", () => {
    render(
      <CartLineItem
        item={cartItem({ stock_quantity: 0, quantity: 1 })}
        onIncrement={vi.fn()}
        onDecrement={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const note = screen.getByText("Currently unavailable");
    expect(note.className).not.toContain("text-stone-500");
    expect(note.className).toContain("text-stone-400");
  });

  it("keeps the missing-image placeholder on its original class, since it renders on a white tile", () => {
    render(
      <CartLineItem
        item={cartItem({ image_url: null })}
        onIncrement={vi.fn()}
        onDecrement={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const placeholder = screen.getByText("No image");
    expect(placeholder.className).toContain("text-stone-500");
  });
});
