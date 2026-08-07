// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ShopLoading from "./loading";

/** The grid the skeleton tiles sit in. */
function skeletonGrid(container: HTMLElement) {
  const grid = container.querySelector("div.grid");

  if (!grid) {
    throw new Error("skeleton grid not found");
  }

  return grid;
}

describe("shop loading state", () => {
  afterEach(() => {
    cleanup();
  });

  it("announces itself once to assistive technology", () => {
    render(<ShopLoading />);

    const status = screen.getByRole("status");

    expect(status).toHaveTextContent("Loading products");
    expect(status.className).toContain("sr-only");
  });

  // The blocks carry no information; read out one by one they would be noise.
  it("hides the decorative blocks from assistive technology", () => {
    const { container } = render(<ShopLoading />);

    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
    expect(skeletonGrid(container).closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("renders portrait card skeletons", () => {
    render(<ShopLoading />);

    const tiles = screen.getAllByTestId("product-card-skeleton");

    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      expect(tile.className).toContain("aspect-[4/5]");
    }
  });

  // The point of the skeleton is that the real content lands on it rather than
  // shifting it, so these have to track `page.tsx` exactly.
  it("uses the same responsive column counts as the real grid", () => {
    const { container } = render(<ShopLoading />);

    const gridClasses = skeletonGrid(container).className;

    expect(gridClasses).toContain("grid-cols-1");
    expect(gridClasses).toContain("min-[360px]:grid-cols-2");
    expect(gridClasses).toContain("md:grid-cols-3");
    expect(gridClasses).toContain("xl:grid-cols-4");
  });

  it("uses the same gutters as the real grid", () => {
    const { container } = render(<ShopLoading />);

    const gridClasses = skeletonGrid(container).className;

    expect(gridClasses).toContain("gap-x-2");
    expect(gridClasses).toContain("gap-y-16");
    expect(gridClasses).toContain("sm:gap-x-4");
    expect(gridClasses).toContain("sm:gap-y-20");
  });

  it("stands in for the header and the navigation divider", () => {
    const { container } = render(<ShopLoading />);

    // The rule that closes the header on the real page.
    expect(container.querySelector(".border-b.border-stone-800")).not.toBeNull();
  });

  // A reader who has asked for less motion gets flat blocks, not a pulse.
  it("gates every animation behind the reduced-motion preference", () => {
    const { container } = render(<ShopLoading />);

    const animated = container.querySelectorAll("[class*='animate-']");

    expect(animated.length).toBeGreaterThan(0);
    for (const element of animated) {
      expect(element.className).toContain("motion-safe:animate-pulse");
      // Never an unguarded `animate-*`, which would ignore the preference.
      expect(element.className).not.toMatch(/(^|\s)animate-/);
    }
  });
});
