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

// The loader itself is covered by promotion-discounts.test.ts. Here it is a spy,
// so these tests can assert how the pages call it.
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
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

// A client component with cart state; nothing about it is relevant to pricing.
vi.mock("@/components/cart/add-to-cart-button", () => ({
  AddToCartButton: () => <button type="button">Add to cart</button>,
}));

import ShopPage from "./shop/page";
import ProductDetailPage from "./products/[slug]/page";

const PRODUCT_A = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B = "22222222-2222-4222-8222-222222222222";
const PRODUCT_C = "33333333-3333-4333-8333-333333333333";

function listRow(id: string, name: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    short_description: null,
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

function detailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PRODUCT_A,
    name: "Replica Jazz Club",
    description: "An editorial description.",
    short_description: "Rum, tobacco leaf, and vetiver.",
    price: "800.00",
    retail_price: "1000.00",
    size_label: "100 mL",
    stock_quantity: 5,
    is_featured: false,
    brand: { name: "Maison Margiela" },
    category: { name: "Fragrance" },
    product_images: null,
    ...overrides,
  };
}

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

// The prices a rendered page actually shows, in order.
function renderedPrices(container: HTMLElement) {
  return container.textContent?.match(/HK\$[\d,]+\.\d{2}/g) ?? [];
}

describe("storefront promotional pricing", () => {
  beforeEach(() => {
    mocks.createSupabaseServerClient.mockReset();
    mocks.loadPromotionDiscounts.mockReset();
    mocks.loadPromotionDiscounts.mockResolvedValue(new Map());
  });

  afterEach(() => {
    cleanup();
  });

  describe("shop page batching", () => {
    it("asks about every rendered product in a single call", async () => {
      supabaseReturning({
        data: [
          listRow(PRODUCT_A, "Jazz Club"),
          listRow(PRODUCT_B, "By The Fireplace"),
          listRow(PRODUCT_C, "Sailing Day"),
        ],
      });

      render(await ShopPage({ searchParams: Promise.resolve({}) }));

      // One request for the whole grid, not one per tile.
      expect(mocks.loadPromotionDiscounts).toHaveBeenCalledTimes(1);
      expect(mocks.loadPromotionDiscounts).toHaveBeenCalledWith([
        PRODUCT_A,
        PRODUCT_B,
        PRODUCT_C,
      ]);
    });

    it("still makes exactly one call when a brand filter narrows the grid", async () => {
      supabaseReturning({
        data: [
          listRow(PRODUCT_A, "Jazz Club"),
          listRow(PRODUCT_B, "Fireplace", {
            brand: { name: "Byredo", slug: "byredo" },
          }),
        ],
      });

      render(
        await ShopPage({
          searchParams: Promise.resolve({
            category: "fragrance",
            brand: "byredo",
          }),
        }),
      );

      expect(mocks.loadPromotionDiscounts).toHaveBeenCalledTimes(1);
      // Only the products that survive the filter are asked about.
      expect(mocks.loadPromotionDiscounts).toHaveBeenCalledWith([PRODUCT_B]);
    });

    it("shows the promotional pair only for the assigned product", async () => {
      supabaseReturning({
        data: [
          listRow(PRODUCT_A, "Jazz Club"),
          listRow(PRODUCT_B, "Fireplace"),
        ],
      });
      // Only the first product is assigned under the coupon.
      mocks.loadPromotionDiscounts.mockResolvedValue(
        new Map([[PRODUCT_A, 2_000]]),
      );

      const { container } = render(
        await ShopPage({ searchParams: Promise.resolve({}) }),
      );

      expect(screen.getByText("HK$640.00 w/ HAPPY2026")).toBeInTheDocument();
      expect(screen.getByText("HK$1,000.00").tagName).toBe("S");
      // The unassigned product keeps its ordinary single price.
      expect(renderedPrices(container)).toEqual([
        "HK$1,000.00",
        "HK$640.00",
        "HK$800.00",
      ]);
    });

    it("keeps the single price for every product when nothing is assigned", async () => {
      supabaseReturning({
        data: [listRow(PRODUCT_A, "Jazz Club"), listRow(PRODUCT_B, "Fireplace")],
      });

      const { container } = render(
        await ShopPage({ searchParams: Promise.resolve({}) }),
      );

      expect(renderedPrices(container)).toEqual(["HK$800.00", "HK$800.00"]);
      expect(container.querySelector("s")).toBeNull();
      expect(container.textContent).not.toContain("HAPPY2026");
    });

    it("keeps the single price when the product has no retail price", async () => {
      supabaseReturning({
        data: [listRow(PRODUCT_A, "Jazz Club", { retail_price: null })],
      });
      mocks.loadPromotionDiscounts.mockResolvedValue(
        new Map([[PRODUCT_A, 2_000]]),
      );

      const { container } = render(
        await ShopPage({ searchParams: Promise.resolve({}) }),
      );

      expect(renderedPrices(container)).toEqual(["HK$800.00"]);
      expect(container.textContent).not.toContain("HAPPY2026");
    });
  });

  describe("product detail page", () => {
    it("asks about the single product id", async () => {
      supabaseReturning({ data: detailRow() });

      render(
        await ProductDetailPage({
          params: Promise.resolve({ slug: "replica-jazz-club" }),
        }),
      );

      expect(mocks.loadPromotionDiscounts).toHaveBeenCalledTimes(1);
      expect(mocks.loadPromotionDiscounts).toHaveBeenCalledWith([PRODUCT_A]);
    });

    it("shows the struck retail price and the promotional price", async () => {
      supabaseReturning({ data: detailRow() });
      mocks.loadPromotionDiscounts.mockResolvedValue(
        new Map([[PRODUCT_A, 2_000]]),
      );

      const { container } = render(
        await ProductDetailPage({
          params: Promise.resolve({ slug: "replica-jazz-club" }),
        }),
      );

      const retail = screen.getByText("HK$1,000.00");
      expect(retail.tagName).toBe("S");
      expect(retail.className).toContain("line-through");
      expect(screen.getByText("HK$640.00 w/ HAPPY2026")).toBeInTheDocument();
      // Two figures, never the normal selling price as a third.
      expect(renderedPrices(container)).toEqual([
        "HK$1,000.00",
        "HK$640.00",
      ]);
    });

    it("keeps the single price when the product is not assigned", async () => {
      supabaseReturning({ data: detailRow() });

      const { container } = render(
        await ProductDetailPage({
          params: Promise.resolve({ slug: "replica-jazz-club" }),
        }),
      );

      expect(renderedPrices(container)).toEqual(["HK$800.00"]);
      expect(container.querySelector("s")).toBeNull();
      expect(container.textContent).not.toContain("HAPPY2026");
    });

    it("keeps the single price when no retail price is published", async () => {
      supabaseReturning({ data: detailRow({ retail_price: null }) });
      mocks.loadPromotionDiscounts.mockResolvedValue(
        new Map([[PRODUCT_A, 2_000]]),
      );

      const { container } = render(
        await ProductDetailPage({
          params: Promise.resolve({ slug: "replica-jazz-club" }),
        }),
      );

      expect(renderedPrices(container)).toEqual(["HK$800.00"]);
      expect(container.textContent).not.toContain("HAPPY2026");
    });
  });
});
