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
  default: ({ alt, src }: { alt: string; src?: string }) => (
    <span role="img" aria-label={alt || undefined} data-src={src} />
  ),
}));

import ProductDetailPage from "./page";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

function productImage(url: string, sortOrder: number, isPrimary = false) {
  return {
    image_url: url,
    alt_text: null,
    sort_order: sortOrder,
    is_primary: isPrimary,
  };
}

function detailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PRODUCT_ID,
    name: "Replica Jazz Club",
    description: "An editorial description.",
    short_description: "Spiced warmth and polished woods.",
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

async function renderProductPage() {
  return render(
    await ProductDetailPage({
      params: Promise.resolve({ slug: "replica-jazz-club" }),
    }),
  );
}

describe("product detail gallery", () => {
  beforeEach(() => {
    mocks.createSupabaseServerClient.mockReset();
    mocks.loadPromotionDiscounts.mockReset();
    mocks.loadPromotionDiscounts.mockResolvedValue(new Map());
  });

  afterEach(() => {
    cleanup();
  });

  it("renders every image, primary first", async () => {
    supabaseReturning({
      data: detailRow({
        product_images: [
          productImage("/third.jpg", 2),
          productImage("/lead.jpg", 1, true),
          productImage("/first-sorted.jpg", 0),
        ],
      }),
    });

    const { container } = await renderProductPage();

    expect(
      [...container.querySelectorAll("[data-src]")].map((el) =>
        el.getAttribute("data-src"),
      ),
    ).toEqual(["/lead.jpg", "/first-sorted.jpg", "/third.jpg"]);
  });

  it("uses plain sort order when nothing is flagged primary", async () => {
    supabaseReturning({
      data: detailRow({
        product_images: [
          productImage("/b.jpg", 1),
          productImage("/a.jpg", 0),
        ],
      }),
    });

    const { container } = await renderProductPage();

    expect(
      [...container.querySelectorAll("[data-src]")].map((el) =>
        el.getAttribute("data-src"),
      ),
    ).toEqual(["/a.jpg", "/b.jpg"]);
  });

  it("gives a single-image product one image and no gallery region", async () => {
    supabaseReturning({
      data: detailRow({
        product_images: [productImage("/only.jpg", 0, true)],
      }),
    });

    const { container } = await renderProductPage();

    expect(container.querySelectorAll("[data-src]")).toHaveLength(1);
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("exposes a named gallery region once there is more than one image", async () => {
    supabaseReturning({
      data: detailRow({
        product_images: [
          productImage("/a.jpg", 0, true),
          productImage("/b.jpg", 1),
        ],
      }),
    });

    await renderProductPage();

    expect(
      screen.getByRole("region", { name: "Replica Jazz Club images" }),
    ).toBeInTheDocument();
  });
});

// The gallery sits beside these; none of them should have moved.
describe("product detail page is otherwise unchanged", () => {
  beforeEach(() => {
    mocks.createSupabaseServerClient.mockReset();
    mocks.loadPromotionDiscounts.mockReset();
    mocks.loadPromotionDiscounts.mockResolvedValue(new Map());
  });

  afterEach(() => {
    cleanup();
  });

  const TWO_IMAGES = [
    productImage("/a.jpg", 0, true),
    productImage("/b.jpg", 1),
  ];

  it("still shows the promotional pair and no third price", async () => {
    supabaseReturning({ data: detailRow({ product_images: TWO_IMAGES }) });
    mocks.loadPromotionDiscounts.mockResolvedValue(
      new Map([[PRODUCT_ID, 2_000]]),
    );

    const { container } = await renderProductPage();

    expect(screen.getByText("HK$1,000.00").tagName).toBe("S");
    expect(screen.getByText("HK$640.00 w/ HAPPY2026")).toBeInTheDocument();
    expect(container.textContent?.match(/HK\$[\d,]+\.\d{2}/g)).toEqual([
      "HK$1,000.00",
      "HK$640.00",
    ]);
  });

  it("still shows the single price when nothing is assigned", async () => {
    supabaseReturning({ data: detailRow({ product_images: TWO_IMAGES }) });

    const { container } = await renderProductPage();

    expect(container.textContent?.match(/HK\$[\d,]+\.\d{2}/g)).toEqual([
      "HK$800.00",
    ]);
    expect(container.textContent).not.toContain("HAPPY2026");
  });

  it("still renders the add to cart control", async () => {
    supabaseReturning({ data: detailRow({ product_images: TWO_IMAGES }) });

    await renderProductPage();

    expect(
      screen.getByRole("button", { name: /add to cart/i }),
    ).toBeInTheDocument();
  });

  // The cart line takes the primary image, independently of gallery order.
  it("still reports availability and size", async () => {
    supabaseReturning({ data: detailRow({ product_images: TWO_IMAGES }) });

    await renderProductPage();

    expect(screen.getByText("In stock")).toBeInTheDocument();
    // Once beside the price, once in the details table further down.
    expect(screen.getAllByText("100 mL")).toHaveLength(2);
  });
});
