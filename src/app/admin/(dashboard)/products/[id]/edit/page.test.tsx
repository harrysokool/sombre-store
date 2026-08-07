// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminProductEditorData } from "@/lib/admin/products";

const mocks = vi.hoisted(() => ({
  requireAdminUser: vi.fn(),
  getAdminProductEditorData: vi.fn(),
  notFound: vi.fn(),
  ProductForm: vi.fn(),
}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  requireAdminUser: mocks.requireAdminUser,
}));

vi.mock("@/lib/admin/products", () => ({
  getAdminProductEditorData: mocks.getAdminProductEditorData,
}));

// The real notFound() signals by throwing, so mirroring that is what proves the
// page stops rather than rendering a form for a product it never loaded.
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Rendered as a marker carrying its props, so this test can assert what the
// page hands the form without re-testing the form itself.
vi.mock("@/app/admin/products/product-form", () => ({
  ProductForm: (props: Record<string, unknown>) => {
    mocks.ProductForm(props);
    return <div data-testid="product-form" />;
  },
}));

import EditAdminProductPage, { metadata } from "./page";

const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
const BRAND_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";

const EDITOR_DATA: AdminProductEditorData = {
  product: {
    id: PRODUCT_ID,
    name: "Replica Jazz Club",
    slug: "maison-margiela-replica-jazz-club",
    brandId: BRAND_ID,
    categoryId: CATEGORY_ID,
    sizeLabel: "100 mL",
    shortDescription: "Spiced warmth and polished woods.",
    description: "A smooth perfume with warm spice.",
    price: "165.00",
    retailPrice: "220.00",
    stockQuantity: 5,
    isActive: true,
  },
  brands: [{ id: BRAND_ID, name: "Maison Margiela" }],
  categories: [{ id: CATEGORY_ID, name: "Fragrance" }],
};

async function renderPage(id = PRODUCT_ID) {
  render(await EditAdminProductPage({ params: Promise.resolve({ id }) }));
}

beforeEach(() => {
  mocks.requireAdminUser.mockReset();
  mocks.getAdminProductEditorData.mockReset();
  mocks.notFound.mockReset();
  mocks.ProductForm.mockReset();
  mocks.requireAdminUser.mockResolvedValue({
    id: "admin-1",
    email: "admin@example.com",
  });
  mocks.getAdminProductEditorData.mockResolvedValue(EDITOR_DATA);
  mocks.notFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
  vi.spyOn(console, "error").mockImplementation(() => {}).mockClear();
});

afterEach(() => {
  cleanup();
});

describe("authorization", () => {
  it("sets the route title while inheriting the dashboard noindex metadata", () => {
    expect(metadata).toEqual({ title: "Edit product" });
  });

  it("gates the page before loading anything", async () => {
    mocks.requireAdminUser.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(renderPage()).rejects.toThrow("NEXT_REDIRECT");
    // The gate runs outside the loader, so its redirect is never swallowed.
    expect(mocks.getAdminProductEditorData).not.toHaveBeenCalled();
  });
});

describe("loading an existing product", () => {
  it("hands the product's current values to the form in edit mode", async () => {
    await renderPage();

    expect(mocks.ProductForm).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "edit",
        productId: PRODUCT_ID,
        name: "Replica Jazz Club",
        slug: "maison-margiela-replica-jazz-club",
        brandId: BRAND_ID,
        categoryId: CATEGORY_ID,
        sizeLabel: "100 mL",
        shortDescription: "Spiced warmth and polished woods.",
        description: "A smooth perfume with warm spice.",
        price: "165.00",
        retailPrice: "220.00",
        stockQuantity: 5,
        isActive: true,
      }),
    );
  });

  it("passes the brand and category options through for the dropdowns", async () => {
    await renderPage();

    expect(mocks.ProductForm).toHaveBeenCalledWith(
      expect.objectContaining({
        brands: [{ id: BRAND_ID, name: "Maison Margiela" }],
        categories: [{ id: CATEGORY_ID, name: "Fragrance" }],
      }),
    );
  });

  it("shows the product name as the heading", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Replica Jazz Club" }),
    ).toBeInTheDocument();
  });

  it("reads the product named in the route", async () => {
    await renderPage();

    expect(mocks.getAdminProductEditorData).toHaveBeenCalledWith(PRODUCT_ID);
  });
});

describe("products that cannot be shown", () => {
  it("uses the not-found page for a product that does not exist", async () => {
    mocks.getAdminProductEditorData.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalled();
  });

  it("uses the not-found page for a malformed product id", async () => {
    // The data layer reports a malformed reference the same way as a missing
    // product, so both land on the ordinary not-found page.
    mocks.getAdminProductEditorData.mockResolvedValue(null);

    await expect(renderPage("not-a-uuid")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.getAdminProductEditorData).toHaveBeenCalledWith("not-a-uuid");
  });

  it("shows a generic message when the product cannot be loaded", async () => {
    mocks.getAdminProductEditorData.mockRejectedValue(
      new Error('permission denied for table "products"'),
    );

    await renderPage();

    const alert = screen.getByRole("alert");

    expect(alert).toHaveTextContent("Product details could not be loaded.");
    // The detail belongs in the server log, never in the browser.
    expect(alert).not.toHaveTextContent("permission denied");
    expect(screen.queryByTestId("product-form")).not.toBeInTheDocument();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
