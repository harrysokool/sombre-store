// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AdminInventoryProduct,
  InventorySearchParams,
} from "@/lib/admin/inventory";

const mocks = vi.hoisted(() => ({
  requireAdminUser: vi.fn(),
  listAdminInventory: vi.fn(),
}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  requireAdminUser: mocks.requireAdminUser,
}));

vi.mock("@/lib/admin/inventory-data", () => ({
  listAdminInventory: mocks.listAdminInventory,
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import AdminInventoryPage, { metadata } from "./page";

const PRODUCTS: AdminInventoryProduct[] = [
  {
    id: "product-a",
    name: "Amber Serum",
    price: "120.00",
    stockQuantity: 12,
    isActive: true,
    brand: { name: "Maison" },
    category: { name: "Fragrance" },
    primaryImage: {
      imageUrl: "/images/amber.jpg",
      altText: "Amber Serum bottle",
    },
  },
  {
    id: "product-b",
    name: "Birch Balm",
    price: "250.00",
    stockQuantity: 5,
    isActive: false,
    brand: { name: "Aesop" },
    category: { name: "Skincare" },
    primaryImage: {
      imageUrl: "/images/birch.jpg",
      altText: null,
    },
  },
  {
    id: "product-c",
    name: "Cedar Mist",
    price: 300,
    stockQuantity: 0,
    isActive: true,
    brand: { name: "Maison" },
    category: { name: "Fragrance" },
    primaryImage: null,
  },
  {
    id: "product-d",
    name: "Dusk Cream",
    price: "450.50",
    stockQuantity: 1,
    isActive: true,
    brand: { name: "Byredo" },
    category: { name: "Bath and Body" },
    primaryImage: null,
  },
  {
    id: "product-e",
    name: "Ember Oil",
    price: "80.00",
    stockQuantity: 6,
    isActive: false,
    brand: { name: "Aesop" },
    category: { name: "Skincare" },
    primaryImage: null,
  },
];

function mobileCards() {
  return within(screen.getByRole("list", { name: "Inventory products" }));
}

function desktopTable() {
  return within(screen.getByRole("table", { name: "Inventory products" }));
}

function mobileProductNames() {
  return mobileCards()
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent);
}

async function renderPage(params: InventorySearchParams = {}) {
  render(
    await AdminInventoryPage({
      searchParams: Promise.resolve(params),
    }),
  );
}

function summaryValue(label: string) {
  const summary = within(screen.getByLabelText("Inventory summary"));
  const term = summary.getByText(label);
  const card = term.closest("div");

  if (!card) {
    throw new Error(`Summary card not found for ${label}`);
  }

  return within(card).getByRole("definition");
}

describe("admin inventory page", () => {
  beforeEach(() => {
    mocks.requireAdminUser.mockReset();
    mocks.listAdminInventory.mockReset();
    mocks.requireAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
    mocks.listAdminInventory.mockResolvedValue(PRODUCTS);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("sets the route title while inheriting the dashboard noindex metadata", () => {
    expect(metadata).toEqual({ title: "Inventory" });
  });

  it("checks admin authentication before loading any inventory", async () => {
    mocks.requireAdminUser.mockRejectedValue(
      new Error("redirect to admin login"),
    );

    await expect(AdminInventoryPage()).rejects.toThrow(
      "redirect to admin login",
    );
    expect(mocks.listAdminInventory).not.toHaveBeenCalled();
  });

  it("displays every requested product field in both responsive presentations", async () => {
    await renderPage();

    const table = desktopTable();
    const amberRow = within(
      table
        .getAllByRole("row")
        .find((row) => within(row).queryByText("Amber Serum"))!,
    );

    for (const header of [
      "Product",
      "Brand",
      "Category",
      "Stock",
      "Price",
      "Product status",
      "Stock status",
    ]) {
      expect(
        table.getByRole("columnheader", { name: header }),
      ).toBeInTheDocument();
    }

    expect(
      amberRow.getByRole("img", { name: "Amber Serum bottle" }),
    ).toBeInTheDocument();
    expect(amberRow.getByText("Amber Serum")).toBeInTheDocument();
    expect(amberRow.getByText("Maison")).toBeInTheDocument();
    expect(amberRow.getByText("Fragrance")).toBeInTheDocument();
    expect(amberRow.getByText("12")).toBeInTheDocument();
    expect(amberRow.getByText("HK$120.00")).toBeInTheDocument();
    expect(
      amberRow.getByLabelText("Product status: Active"),
    ).toHaveTextContent("Active");
    expect(
      amberRow.getByLabelText("Stock status: In stock"),
    ).toHaveTextContent("In stock");

    const birchCard = within(
      mobileCards()
        .getAllByRole("listitem")
        .find((card) => within(card).queryByText("Birch Balm"))!,
    );

    expect(
      birchCard.getByRole("img", {
        name: "Birch Balm product thumbnail",
      }),
    ).toBeInTheDocument();
    expect(birchCard.getByText("Aesop")).toBeInTheDocument();
    expect(birchCard.getByText("Skincare")).toBeInTheDocument();
    expect(birchCard.getByText("5")).toBeInTheDocument();
    expect(birchCard.getByText("HK$250.00")).toBeInTheDocument();
    expect(
      birchCard.getByLabelText("Product status: Inactive"),
    ).toHaveTextContent("Inactive");
    expect(
      birchCard.getByLabelText("Stock status: Low stock"),
    ).toHaveTextContent("Low stock");
  });

  it("shows accurate global summary totals", async () => {
    await renderPage();

    expect(summaryValue("Total products")).toHaveTextContent("5");
    expect(summaryValue("Total stock units")).toHaveTextContent("24");
    expect(summaryValue("Low stock products")).toHaveTextContent("2");
    expect(summaryValue("Out of stock products")).toHaveTextContent("1");
  });

  it.each([
    [{ brand: "Maison" }, ["Amber Serum", "Cedar Mist"]],
    [{ category: "Skincare" }, ["Birch Balm", "Ember Oil"]],
    [{ q: "  CEDAR  " }, ["Cedar Mist"]],
    [{ active: "active" }, ["Amber Serum", "Cedar Mist", "Dusk Cream"]],
    [{ active: "inactive" }, ["Birch Balm", "Ember Oil"]],
    [{ stock: "in-stock" }, ["Amber Serum", "Ember Oil"]],
    [{ stock: "low-stock" }, ["Birch Balm", "Dusk Cream"]],
    [{ stock: "out-of-stock" }, ["Cedar Mist"]],
  ] as Array<[InventorySearchParams, string[]]>)(
    "applies the URL-backed view %o",
    async (params, expectedNames) => {
      await renderPage(params);

      expect(mobileProductNames()).toEqual(expectedNames);
      expect(screen.getByText(`${expectedNames.length} of 5 products`)).toBeInTheDocument();
      // Summary cards always describe the complete catalog, not just the view.
      expect(summaryValue("Total products")).toHaveTextContent("5");
      expect(summaryValue("Total stock units")).toHaveTextContent("24");
    },
  );

  it("applies URL-backed sorting and reflects the selected option", async () => {
    await renderPage({ sort: "stock-desc" });

    expect(mobileProductNames()).toEqual([
      "Amber Serum",
      "Ember Oil",
      "Birch Balm",
      "Dusk Cream",
      "Cedar Mist",
    ]);
    expect(screen.getByLabelText("Sort by")).toHaveValue("stock-desc");
  });

  it("uses a labelled GET form so the selected view survives refresh", async () => {
    await renderPage({
      q: "Cedar",
      brand: "Maison",
      category: "Fragrance",
      stock: "out-of-stock",
      active: "active",
      sort: "brand",
    });

    const form = screen.getByRole("form", { name: "Inventory filters" });

    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/admin/inventory");
    expect(screen.getByLabelText("Product name")).toHaveValue("Cedar");
    expect(screen.getByLabelText("Brand")).toHaveValue("Maison");
    expect(screen.getByLabelText("Category")).toHaveValue("Fragrance");
    expect(screen.getByLabelText("Stock status")).toHaveValue("out-of-stock");
    expect(screen.getByLabelText("Active status")).toHaveValue("active");
    expect(screen.getByLabelText("Sort by")).toHaveValue("brand");
    expect(
      screen.getByRole("button", { name: "Apply filters" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reset view" })).toHaveAttribute(
      "href",
      "/admin/inventory",
    );
  });

  it("normalizes invalid URL values to a safe default view", async () => {
    await renderPage({
      brand: "not-a-brand",
      category: "not-a-category",
      stock: "overstocked",
      active: "maybe",
      sort: "price",
    });

    expect(screen.getByLabelText("Brand")).toHaveValue("all");
    expect(screen.getByLabelText("Category")).toHaveValue("all");
    expect(screen.getByLabelText("Stock status")).toHaveValue("all");
    expect(screen.getByLabelText("Active status")).toHaveValue("all");
    expect(screen.getByLabelText("Sort by")).toHaveValue("name");
    expect(mobileProductNames()).toEqual([
      "Amber Serum",
      "Birch Balm",
      "Cedar Mist",
      "Dusk Cream",
      "Ember Oil",
    ]);
  });

  it("handles missing images, brands, categories, and invalid prices safely", async () => {
    mocks.listAdminInventory.mockResolvedValue([
      {
        ...PRODUCTS[0],
        id: "missing-fields",
        name: "Unassigned Product",
        price: null,
        stockQuantity: 0,
        brand: null,
        category: null,
        primaryImage: null,
      },
    ]);

    await renderPage();

    const row = desktopTable();
    expect(
      row.getByRole("img", {
        name: "No image available for Unassigned Product",
      }),
    ).toBeInTheDocument();
    expect(row.getByText("No brand")).toBeInTheDocument();
    expect(row.getByText("No category")).toBeInTheDocument();
    expect(row.getByText("—")).toBeInTheDocument();
    expect(
      row.getByLabelText("Stock status: Out of stock"),
    ).toHaveTextContent("Out of stock");
  });

  it("shows an empty state when no product matches the selected view", async () => {
    await renderPage({ q: "product that does not exist" });

    expect(screen.getByText("No products match this view.")).toBeInTheDocument();
    expect(
      screen.getByText("Try changing the search or filters."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("list", { name: "Inventory products" })).toBeNull();
  });

  it("shows a distinct empty state when the catalog itself is empty", async () => {
    mocks.listAdminInventory.mockResolvedValue([]);

    await renderPage();

    expect(screen.getByText("No products in inventory.")).toBeInTheDocument();
    expect(summaryValue("Total products")).toHaveTextContent("0");
  });

  it("shows a safe error without exposing database details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.listAdminInventory.mockRejectedValue(
      new Error('relation "products" does not exist; service key abc123'),
    );

    await renderPage();

    expect(
      screen.getByRole("alert"),
    ).toHaveTextContent("Inventory could not be loaded. Please try again.");
    expect(screen.queryByText(/does not exist/)).toBeNull();
    expect(screen.queryByText(/abc123/)).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("form", { name: "Inventory filters" })).toBeNull();
  });

  it("contains the desktop table scroll and uses cards below desktop widths", async () => {
    const longName =
      "An Extremely Long Product Name That Must Wrap Without Expanding the Document";
    const longBrand =
      "A Brand Name With Enough Words To Need Defensive Wrapping On Narrow Screens";
    mocks.listAdminInventory.mockResolvedValue([
      {
        ...PRODUCTS[0],
        name: longName,
        brand: { name: longBrand },
      },
    ]);

    await renderPage();

    const list = screen.getByRole("list", { name: "Inventory products" });
    const table = screen.getByRole("table", { name: "Inventory products" });
    const tableWrapper = table.parentElement;

    expect(list).toHaveClass("lg:hidden");
    expect(tableWrapper).toHaveClass(
      "hidden",
      "w-full",
      "max-w-full",
      "overflow-x-auto",
      "lg:block",
    );
    expect(mobileCards().getByText(longName)).toHaveClass(
      "break-words",
      "[overflow-wrap:anywhere]",
    );
    expect(desktopTable().getByText(longBrand).closest("td")).toHaveClass(
      "break-words",
      "[overflow-wrap:anywhere]",
    );
  });

  it("remains read-only and exposes no stock or product mutation controls", async () => {
    await renderPage();

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button")).toHaveTextContent("Apply filters");
    expect(screen.getAllByRole("form")).toHaveLength(1);
    expect(screen.getByRole("form")).toHaveAttribute("method", "get");
    expect(
      screen.queryByRole("button", { name: /adjust|edit|delete|create/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("link", { name: /adjust|edit|delete|create/i }),
    ).toBeNull();
  });
});
