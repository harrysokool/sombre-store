// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

import { ShopCategoryNav } from "./shop-category-nav";

describe("shop category nav text contrast", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps an inactive category link off the failing low-contrast class", () => {
    render(
      <ShopCategoryNav
        categoryLinks={[
          { label: "All", href: "/shop", isActive: true },
          { label: "Fragrance", href: "/shop/fragrance", isActive: false },
        ]}
        brandLinks={[]}
      />,
    );

    const inactiveCategory = screen.getByRole("link", { name: "Fragrance" });
    expect(inactiveCategory.className).not.toContain("text-stone-500");
    expect(inactiveCategory.className).toContain("text-stone-400");
  });

  it("keeps an inactive brand link off the failing low-contrast class", () => {
    render(
      <ShopCategoryNav
        categoryLinks={[{ label: "All", href: "/shop", isActive: true }]}
        brandLinks={[
          {
            label: "Maison Margiela",
            href: "/shop?brand=maison-margiela",
            isActive: false,
          },
        ]}
      />,
    );

    const inactiveBrand = screen.getByRole("link", {
      name: "Maison Margiela",
    });
    expect(inactiveBrand.className).not.toContain("text-stone-600");
    expect(inactiveBrand.className).toContain("text-stone-400");
  });
});
