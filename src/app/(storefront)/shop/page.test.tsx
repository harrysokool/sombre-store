// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  loadPromotionDiscounts: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("@/lib/storefront/promotion-discounts", () => ({
  loadPromotionDiscounts: mocks.loadPromotionDiscounts,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
    "aria-hidden": ariaHidden,
  }: {
    alt: string;
    src?: string;
    "aria-hidden"?: boolean | "true" | "false";
  }) => (
    <span
      role="img"
      aria-label={alt || undefined}
      aria-hidden={ariaHidden}
      data-src={src}
    />
  ),
}));

import ShopPage from "./page";

const PRODUCT_A = "11111111-1111-4111-8111-111111111111";

function listRow(id: string, name: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    short_description: "Spiced warmth",
    price: "800.00",
    retail_price: "1000.00",
    size_label: "100 mL",
    stock_quantity: 5,
    is_featured: false,
    created_at: "2026-08-05T00:00:00.000Z",
    brand: { name: "Maison Margiela", slug: "maison-margiela" },
    category: { name: "Fragrance", slug: "fragrance" },
    product_images: null,
    ...overrides,
  };
}

/**
 * Stands in for the Supabase query builder, recording every chained call so the
 * ordering the page asks for can be asserted.
 */
function supabaseReturning(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: result.data ?? null, error: result.error ?? null };
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  for (const method of ["select", "eq", "order"]) {
    builder[method] = vi.fn(() => builder);
  }

  builder.returns = vi.fn(async () => resolved);
  builder.maybeSingle = vi.fn(async () => resolved);

  mocks.createSupabaseServerClient.mockReturnValue({
    from: vi.fn(() => builder),
  });

  return builder;
}

describe("shop page product ordering", () => {
  beforeEach(() => {
    mocks.createSupabaseServerClient.mockReset();
    mocks.loadPromotionDiscounts.mockReset();
    mocks.loadPromotionDiscounts.mockResolvedValue(new Map());
  });

  afterEach(() => {
    cleanup();
  });

  // Without an explicit order the grid renders in whatever order Postgres
  // happens to return rows, which can shift after any product update.
  it("orders by the curation flag first, then by name", async () => {
    const builder = supabaseReturning({ data: [listRow(PRODUCT_A, "Jazz Club")] });

    render(await ShopPage({ searchParams: Promise.resolve({}) }));

    expect(builder.order).toHaveBeenCalledTimes(2);
    expect(builder.order).toHaveBeenNthCalledWith(1, "is_featured", {
      ascending: false,
    });
    expect(builder.order).toHaveBeenNthCalledWith(2, "name", {
      ascending: true,
    });
  });

  it("asks for the same order on a filtered view", async () => {
    const builder = supabaseReturning({ data: [listRow(PRODUCT_A, "Jazz Club")] });

    render(
      await ShopPage({
        searchParams: Promise.resolve({ category: "fragrance" }),
      }),
    );

    expect(builder.order).toHaveBeenNthCalledWith(1, "is_featured", {
      ascending: false,
    });
    expect(builder.order).toHaveBeenNthCalledWith(2, "name", {
      ascending: true,
    });
  });

  // New Arrivals still re-sorts by recency in `getScopedProducts`. The query
  // order is deliberately not `created_at`, so that collection stays distinct
  // from the default view rather than duplicating it.
  it("leaves New Arrivals to its own recency ordering", async () => {
    const older = "22222222-2222-4222-8222-222222222222";
    const newer = "33333333-3333-4333-8333-333333333333";

    supabaseReturning({
      data: [
        listRow(older, "Alpha", { created_at: "2026-01-01T00:00:00.000Z" }),
        listRow(newer, "Zulu", { created_at: "2026-08-01T00:00:00.000Z" }),
      ],
    });

    render(
      await ShopPage({
        searchParams: Promise.resolve({ collection: "new-arrivals" }),
      }),
    );

    // Newest first, which is the opposite of the name ordering above — proof
    // the collection is still applying its own rule on top of the query.
    const names = screen.getAllByRole("heading", { level: 2 }).map(
      (heading) => heading.textContent,
    );

    expect(names).toEqual(["Zulu", "Alpha"]);
  });
});

// Closes the loop the unit tests leave open: a row carrying several images has
// to arrive at the tile as exactly two layers, in the right order.
describe("shop page product images", () => {
  beforeEach(() => {
    mocks.createSupabaseServerClient.mockReset();
    mocks.loadPromotionDiscounts.mockReset();
    mocks.loadPromotionDiscounts.mockResolvedValue(new Map());
  });

  afterEach(() => {
    cleanup();
  });

  function productImage(url: string, sortOrder: number, isPrimary = false) {
    return {
      image_url: url,
      alt_text: `${url} alt`,
      sort_order: sortOrder,
      is_primary: isPrimary,
    };
  }

  it("gives a multi-image product a primary layer and one hover layer", async () => {
    supabaseReturning({
      data: [
        listRow(PRODUCT_A, "Jazz Club", {
          product_images: [
            productImage("/third.jpg", 2),
            productImage("/primary.jpg", 0, true),
            productImage("/hover.jpg", 1),
          ],
        }),
      ],
    });

    const { container } = render(
      await ShopPage({ searchParams: Promise.resolve({}) }),
    );

    const layers = [...container.querySelectorAll("[data-src]")];

    // Two, not three: the tile shows the primary and the one after it.
    expect(layers.map((layer) => layer.getAttribute("data-src"))).toEqual([
      "/primary.jpg",
      "/hover.jpg",
    ]);
  });

  it("gives a single-image product exactly one layer", async () => {
    supabaseReturning({
      data: [
        listRow(PRODUCT_A, "Jazz Club", {
          product_images: [productImage("/only.jpg", 0, true)],
        }),
      ],
    });

    const { container } = render(
      await ShopPage({ searchParams: Promise.resolve({}) }),
    );

    const layers = [...container.querySelectorAll("[data-src]")];

    expect(layers).toHaveLength(1);
    expect(layers[0]).toHaveAttribute("data-src", "/only.jpg");
  });

  it("announces one image per product however many it has", async () => {
    supabaseReturning({
      data: [
        listRow(PRODUCT_A, "Jazz Club", {
          product_images: [
            productImage("/primary.jpg", 0, true),
            productImage("/hover.jpg", 1),
          ],
        }),
      ],
    });

    render(await ShopPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getAllByRole("img")).toHaveLength(1);
  });
});

describe("shop page empty and error states", () => {
  beforeEach(() => {
    mocks.createSupabaseServerClient.mockReset();
    mocks.loadPromotionDiscounts.mockReset();
    mocks.loadPromotionDiscounts.mockResolvedValue(new Map());
  });

  afterEach(() => {
    cleanup();
  });

  describe("a query that failed", () => {
    it("says the collection is unavailable, not that it is empty", async () => {
      supabaseReturning({ error: new Error("connection refused") });

      render(await ShopPage({ searchParams: Promise.resolve({}) }));

      expect(
        screen.getByText("The collection is unavailable"),
      ).toBeInTheDocument();
      expect(screen.queryByText("Nothing in this view")).toBeNull();
    });

    // The link would re-run the query that just failed and land back here.
    it("offers no view-all link", async () => {
      supabaseReturning({ error: new Error("connection refused") });

      render(await ShopPage({ searchParams: Promise.resolve({}) }));

      expect(screen.queryByText("View all products")).toBeNull();
    });

    // Filters built from a catalog that failed to load would be empty or wrong.
    it("hides the category and brand navigation", async () => {
      supabaseReturning({ error: new Error("connection refused") });

      render(await ShopPage({ searchParams: Promise.resolve({}) }));

      expect(screen.queryByLabelText("Product categories")).toBeNull();
      expect(screen.queryByLabelText("Brands")).toBeNull();
    });
  });

  describe("a query that succeeded with nothing in it", () => {
    it("says nothing matches the current view, not that it is broken", async () => {
      supabaseReturning({ data: [] });

      render(await ShopPage({ searchParams: Promise.resolve({}) }));

      expect(screen.getByText("Nothing in this view")).toBeInTheDocument();
      expect(
        screen.getByText("No products match the current selection."),
      ).toBeInTheDocument();
      expect(screen.queryByText("The collection is unavailable")).toBeNull();
    });

    it("offers a way out when a category is doing the filtering", async () => {
      supabaseReturning({ data: [listRow(PRODUCT_A, "Jazz Club")] });

      render(
        await ShopPage({
          searchParams: Promise.resolve({ category: "skincare" }),
        }),
      );

      expect(screen.getByText("Nothing in this view")).toBeInTheDocument();
      expect(screen.getByText("View all products")).toHaveAttribute(
        "href",
        "/shop",
      );
    });

    // On an unfiltered /shop the link would point at the page already open.
    it("omits the view-all link when nothing is filtering", async () => {
      supabaseReturning({ data: [] });

      render(await ShopPage({ searchParams: Promise.resolve({}) }));

      expect(screen.queryByText("View all products")).toBeNull();
    });

    it("keeps the navigation, since the catalog itself loaded fine", async () => {
      supabaseReturning({ data: [listRow(PRODUCT_A, "Jazz Club")] });

      render(
        await ShopPage({
          searchParams: Promise.resolve({ category: "skincare" }),
        }),
      );

      expect(screen.getByLabelText("Product categories")).toBeInTheDocument();
    });
  });
});
