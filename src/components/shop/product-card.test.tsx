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

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

import { ProductCard } from "./product-card";

const BASE_PROPS = {
  name: "Replica Jazz Club",
  slug: "replica-jazz-club",
  brandName: "Maison Margiela",
  priceDisplay: {
    kind: "single",
    formattedPrice: "HK$1,200.00",
  } as const,
  sizeLabel: "100 mL",
  notes: "Tobacco, rum, vanilla",
  stockQuantity: 5,
  imageAlt: "Replica Jazz Club bottle",
};

describe("product card text contrast", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps brand, notes, and size off the failing low-contrast class when an image is present", () => {
    render(<ProductCard {...BASE_PROPS} imageUrl="/bottle.jpg" />);

    const brand = screen.getByText("Maison Margiela");
    const notes = screen.getByText("Tobacco, rum, vanilla");
    const size = screen.getByText("100 mL");

    for (const el of [brand, notes, size]) {
      expect(el.className).not.toContain("text-stone-500");
      expect(el.className).toContain("text-stone-400");
    }
  });

  it("keeps the missing-image placeholder on its original class, since it renders on a white tile", () => {
    render(<ProductCard {...BASE_PROPS} imageUrl={null} />);

    const placeholder = screen.getByText("Image coming soon");
    // bg-white gives stone-500 ~4.8:1 here, so this one is correct as-is —
    // switching it to stone-400 would actually fail against a light tile.
    expect(placeholder.className).toContain("text-stone-500");
  });
});
