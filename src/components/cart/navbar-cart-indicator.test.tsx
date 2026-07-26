// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { act, cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCartItemCount: vi.fn(),
}));

vi.mock("@/lib/cart/cart", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cart/cart")>();

  return {
    ...actual,
    getCartItemCount: mocks.getCartItemCount,
  };
});

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

import { NavbarCartIndicator } from "./navbar-cart-indicator";

function mount() {
  render(<NavbarCartIndicator />);

  // The indicator defers its first read to a same-tick timeout so it never
  // renders a mismatched count while hydrating.
  act(() => {
    vi.advanceTimersByTime(0);
  });
}

describe("navbar cart indicator accessible label", () => {
  beforeEach(() => {
    mocks.getCartItemCount.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("uses singular wording for exactly one item", () => {
    mocks.getCartItemCount.mockReturnValue(1);

    mount();

    expect(
      screen.getByRole("link", { name: "Cart with 1 item" }),
    ).toBeInTheDocument();
  });

  it("uses plural wording for more than one item", () => {
    mocks.getCartItemCount.mockReturnValue(3);

    mount();

    expect(
      screen.getByRole("link", { name: "Cart with 3 items" }),
    ).toBeInTheDocument();
  });

  it("falls back to a plain label when the cart is empty", () => {
    mocks.getCartItemCount.mockReturnValue(0);

    mount();

    expect(screen.getByRole("link", { name: "Cart" })).toBeInTheDocument();
  });
});
