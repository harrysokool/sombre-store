// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Forwards the props the gallery's behaviour depends on, so ordering, alt text,
// LCP priority, and the responsive candidate hints are all assertable.
vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
    sizes,
    priority,
    className,
  }: {
    alt: string;
    src?: string;
    sizes?: string;
    priority?: boolean;
    className?: string;
  }) => (
    <span
      role="img"
      aria-label={alt || undefined}
      data-src={src}
      data-sizes={sizes}
      data-priority={priority ? "true" : "false"}
      className={className}
    />
  ),
}));

import { ProductGallery } from "./product-gallery";
import type { ProductImage } from "@/lib/storefront/products";

function image(
  url: string,
  sortOrder: number,
  isPrimary = false,
  altText: string | null = null,
): ProductImage {
  return {
    image_url: url,
    alt_text: altText,
    sort_order: sortOrder,
    is_primary: isPrimary,
  };
}

/** Rendered image layers, in DOM order. */
function renderedSources(container: HTMLElement) {
  return [...container.querySelectorAll("[data-src]")].map((el) =>
    el.getAttribute("data-src"),
  );
}

describe("product gallery ordering", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders every image the product has", () => {
    const { container } = render(
      <ProductGallery
        images={[
          image("/a.jpg", 0, true),
          image("/b.jpg", 1),
          image("/c.jpg", 2),
        ]}
        productName="Replica Jazz Club"
      />,
    );

    expect(renderedSources(container)).toEqual(["/a.jpg", "/b.jpg", "/c.jpg"]);
  });

  it("leads with the primary image even when it sorts late", () => {
    const { container } = render(
      <ProductGallery
        images={[
          image("/a.jpg", 0),
          image("/b.jpg", 1, true),
          image("/c.jpg", 2),
        ]}
        productName="Replica Jazz Club"
      />,
    );

    expect(renderedSources(container)).toEqual(["/b.jpg", "/a.jpg", "/c.jpg"]);
  });

  it("sorts unordered rows before rendering them", () => {
    const { container } = render(
      <ProductGallery
        images={[
          image("/c.jpg", 2),
          image("/a.jpg", 0, true),
          image("/b.jpg", 1),
        ]}
        productName="Replica Jazz Club"
      />,
    );

    expect(renderedSources(container)).toEqual(["/a.jpg", "/b.jpg", "/c.jpg"]);
  });

  // The existing fallback: nothing flagged means plain sort order.
  it("falls back to sort order when no image is flagged primary", () => {
    const { container } = render(
      <ProductGallery
        images={[image("/c.jpg", 2), image("/a.jpg", 0), image("/b.jpg", 1)]}
        productName="Replica Jazz Club"
      />,
    );

    expect(renderedSources(container)).toEqual(["/a.jpg", "/b.jpg", "/c.jpg"]);
  });

  // Only the first image is the LCP candidate; preloading the rest would fight
  // it for bandwidth.
  it("prioritises only the leading image", () => {
    const { container } = render(
      <ProductGallery
        images={[image("/a.jpg", 0, true), image("/b.jpg", 1)]}
        productName="Replica Jazz Club"
      />,
    );

    const priorities = [...container.querySelectorAll("[data-src]")].map((el) =>
      el.getAttribute("data-priority"),
    );

    expect(priorities).toEqual(["true", "false"]);
  });
});

describe("product gallery with one image", () => {
  afterEach(() => {
    cleanup();
  });

  const ONE_IMAGE = [image("/only.jpg", 0, true)];

  it("renders that image and nothing else", () => {
    const { container } = render(
      <ProductGallery images={ONE_IMAGE} productName="Replica Jazz Club" />,
    );

    expect(renderedSources(container)).toEqual(["/only.jpg"]);
  });

  // Nothing to swipe and nothing to choose between, so no gallery affordances.
  it("adds no scrollable region and no extra tab stop", () => {
    const { container } = render(
      <ProductGallery images={ONE_IMAGE} productName="Replica Jazz Club" />,
    );

    expect(screen.queryByRole("region")).toBeNull();
    expect(container.querySelector("[tabindex]")).toBeNull();
  });

  it("keeps the white panel and contain fit it has always had", () => {
    const { container } = render(
      <ProductGallery images={ONE_IMAGE} productName="Replica Jazz Club" />,
    );

    const panel = container.querySelector("div.bg-white");

    expect(panel?.className).toContain("aspect-square");
    expect(panel?.className).toContain("w-full");
    expect(
      container.querySelector("[data-src]")?.className,
    ).toContain("object-contain");
  });

  it("still prioritises the single image as the LCP candidate", () => {
    const { container } = render(
      <ProductGallery images={ONE_IMAGE} productName="Replica Jazz Club" />,
    );

    expect(container.querySelector("[data-src]")).toHaveAttribute(
      "data-priority",
      "true",
    );
  });
});

describe("product gallery with no images", () => {
  afterEach(() => {
    cleanup();
  });

  it("says so rather than rendering an empty panel", () => {
    const { container } = render(
      <ProductGallery images={null} productName="Replica Jazz Club" />,
    );

    expect(screen.getByText("No product image")).toBeInTheDocument();
    expect(renderedSources(container)).toEqual([]);
  });

  it("treats an empty list the same way", () => {
    render(<ProductGallery images={[]} productName="Replica Jazz Club" />);

    expect(screen.getByText("No product image")).toBeInTheDocument();
  });
});

describe("product gallery accessibility", () => {
  afterEach(() => {
    cleanup();
  });

  const TWO_IMAGES = [image("/a.jpg", 0, true), image("/b.jpg", 1)];

  it("names the scrollable region after the product", () => {
    render(
      <ProductGallery images={TWO_IMAGES} productName="Replica Jazz Club" />,
    );

    expect(
      screen.getByRole("region", { name: "Replica Jazz Club images" }),
    ).toBeInTheDocument();
  });

  // A region that scrolls has to be reachable and operable by keyboard.
  it("makes the scrollable region focusable", () => {
    render(
      <ProductGallery images={TWO_IMAGES} productName="Replica Jazz Club" />,
    );

    expect(
      screen.getByRole("region", { name: "Replica Jazz Club images" }),
    ).toHaveAttribute("tabindex", "0");
  });

  it("keeps a visible focus state on that region", () => {
    render(
      <ProductGallery images={TWO_IMAGES} productName="Replica Jazz Club" />,
    );

    const region = screen.getByRole("region", {
      name: "Replica Jazz Club images",
    });

    expect(region.className).toContain("focus-visible:ring-1");
    expect(region.className).toContain("focus-visible:ring-stone-300");
  });

  it("prefers authored alt text over any fallback", () => {
    render(
      <ProductGallery
        images={[
          image("/a.jpg", 0, true, "Jazz Club bottle on stone"),
          image("/b.jpg", 1, false, "Jazz Club carton and cap"),
        ]}
        productName="Replica Jazz Club"
      />,
    );

    expect(
      screen.getByRole("img", { name: "Jazz Club bottle on stone" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Jazz Club carton and cap" }),
    ).toBeInTheDocument();
  });

  // Every image here is a real view of the product, so all are announced — but
  // never with the same sentence, which would say nothing about what changed.
  it("distinguishes the fallback alt text of each view", () => {
    render(
      <ProductGallery
        images={[
          image("/a.jpg", 0, true),
          image("/b.jpg", 1),
          image("/c.jpg", 2),
        ]}
        productName="Replica Jazz Club"
      />,
    );

    const names = screen
      .getAllByRole("img")
      .map((el) => el.getAttribute("aria-label"));

    expect(names).toEqual([
      "Replica Jazz Club product image",
      "Replica Jazz Club product image, view 2",
      "Replica Jazz Club product image, view 3",
    ]);
    expect(new Set(names).size).toBe(names.length);
  });

  it("labels every image, leaving none unnamed", () => {
    render(
      <ProductGallery
        images={[image("/a.jpg", 0, true), image("/b.jpg", 1)]}
        productName="Replica Jazz Club"
      />,
    );

    for (const img of screen.getAllByRole("img")) {
      expect(img.getAttribute("aria-label")).toBeTruthy();
    }
  });

  // No arrows, dots, thumbnails, or lightbox triggers were introduced.
  it("adds no gallery buttons", () => {
    render(
      <ProductGallery images={TWO_IMAGES} productName="Replica Jazz Club" />,
    );

    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
