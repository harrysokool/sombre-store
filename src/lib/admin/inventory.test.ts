import { describe, expect, it } from "vitest";

import {
  ALL_INVENTORY_FILTER,
  formatInventoryPrice,
  getInventoryRelationOptions,
  getInventoryStockStatus,
  getVisibleInventoryProducts,
  LOW_STOCK_MIN_QUANTITY,
  LOW_STOCK_THRESHOLD,
  MISSING_RELATION_FILTER,
  normalizeInventoryProduct,
  normalizeInventoryView,
  normalizeStockQuantity,
  OUT_OF_STOCK_QUANTITY,
  summarizeInventory,
  type AdminInventoryProduct,
  type AdminInventoryProductRow,
  type InventoryView,
} from "./inventory";

function product(
  id: string,
  name: string,
  overrides: Partial<AdminInventoryProduct> = {},
): AdminInventoryProduct {
  return {
    id,
    name,
    price: 1_000,
    stockQuantity: 10,
    isActive: true,
    brand: { name: "Atelier" },
    category: { name: "Bags" },
    primaryImage: null,
    ...overrides,
  };
}

function row(
  overrides: Partial<AdminInventoryProductRow> = {},
): AdminInventoryProductRow {
  return {
    id: "product-1",
    name: "Sombre bag",
    price: "1000.00",
    stock_quantity: 10,
    is_active: true,
    brand: { name: "Atelier" },
    category: { name: "Bags" },
    product_images: null,
    ...overrides,
  };
}

function view(overrides: Partial<InventoryView> = {}): InventoryView {
  return {
    search: "",
    brand: ALL_INVENTORY_FILTER,
    category: ALL_INVENTORY_FILTER,
    stock: ALL_INVENTORY_FILTER,
    active: ALL_INVENTORY_FILTER,
    sort: "name",
    ...overrides,
  };
}

function ids(products: AdminInventoryProduct[]) {
  return products.map((item) => item.id);
}

describe("inventory stock safety", () => {
  it("keeps the shared low-stock threshold at five", () => {
    expect(LOW_STOCK_THRESHOLD).toBe(5);
    expect(OUT_OF_STOCK_QUANTITY).toBe(0);
    expect(LOW_STOCK_MIN_QUANTITY).toBe(1);
  });

  it.each([
    [0, "out_of_stock"],
    [1, "low_stock"],
    [LOW_STOCK_THRESHOLD, "low_stock"],
    [LOW_STOCK_THRESHOLD + 1, "in_stock"],
  ] as const)("classifies quantity %s as %s", (quantity, expected) => {
    expect(getInventoryStockStatus(quantity)).toBe(expected);
  });

  it.each([
    ["zero", "0", 0],
    ["surrounding whitespace", " 5 ", 5],
    ["the first in-stock value", "6", 6],
    ["an integer number", 42, 42],
    ["negative zero", -0, 0],
    ["a negative-zero string", "-0", 0],
    ["the largest safe integer", Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  ])("normalizes %s", (_label, input, expected) => {
    expect(normalizeStockQuantity(input)).toBe(expected);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["an empty string", ""],
    ["a whitespace-only string", "   "],
    ["a non-numeric string", "five"],
    ["a negative number", -1],
    ["a negative numeric string", "-2"],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["an infinity string", "Infinity"],
    ["a fractional number", 1.5],
    ["a fractional numeric string", "2.25"],
    ["an unsafe integer", Number.MAX_SAFE_INTEGER + 1],
  ])("conservatively converts %s to zero", (_label, input) => {
    expect(normalizeStockQuantity(input)).toBe(0);
    expect(getInventoryStockStatus(input)).toBe("out_of_stock");
  });
});

describe("inventory row normalization", () => {
  it("trims names, relations, and the first product image", () => {
    expect(
      normalizeInventoryProduct(
        row({
          id: "trimmed-product",
          name: "  Crescent shoulder bag  ",
          price: "1250.50",
          stock_quantity: " 5 ",
          brand: { name: "  Sombre Studio  " },
          category: [
            { name: "  Shoulder bags  " },
            { name: "Ignored second category" },
          ],
          product_images: [
            {
              image_url: "  /images/crescent.jpg  ",
              alt_text: "  Black crescent shoulder bag  ",
            },
            {
              image_url: "/images/ignored.jpg",
              alt_text: "Ignored second image",
            },
          ],
        }),
      ),
    ).toEqual({
      id: "trimmed-product",
      name: "Crescent shoulder bag",
      price: "1250.50",
      stockQuantity: 5,
      isActive: true,
      brand: { name: "Sombre Studio" },
      category: { name: "Shoulder bags" },
      primaryImage: {
        imageUrl: "/images/crescent.jpg",
        altText: "Black crescent shoulder bag",
      },
    });
  });

  it("turns blank or missing names, relations, images, and stock into safe values", () => {
    expect(
      normalizeInventoryProduct(
        row({
          name: "   ",
          stock_quantity: undefined,
          is_active: false,
          brand: { name: "   " },
          category: [],
          product_images: [
            {
              image_url: "   ",
              alt_text: "This is ignored without an image URL",
            },
          ],
        }),
      ),
    ).toMatchObject({
      name: "Unnamed product",
      stockQuantity: 0,
      isActive: false,
      brand: null,
      category: null,
      primaryImage: null,
    });

    expect(
      normalizeInventoryProduct(
        row({
          brand: null,
          category: null,
          product_images: null,
        }),
      ),
    ).toMatchObject({
      brand: null,
      category: null,
      primaryImage: null,
    });
  });

  it("keeps a usable image while normalizing a blank alt label to null", () => {
    expect(
      normalizeInventoryProduct(
        row({
          product_images: [
            {
              image_url: " /images/bag.jpg ",
              alt_text: "   ",
            },
          ],
        }),
      ).primaryImage,
    ).toEqual({
      imageUrl: "/images/bag.jpg",
      altText: null,
    });
  });
});

describe("inventory price safety", () => {
  it.each([
    ["a zero number", 0, "HK$0.00"],
    ["a decimal number", 12.5, "HK$12.50"],
    ["a trimmed numeric string", " 1234.5 ", "HK$1,234.50"],
  ])("formats %s", (_label, input, expected) => {
    expect(formatInventoryPrice(input)).toBe(expected);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["an empty string", ""],
    ["a blank string", "   "],
    ["a non-numeric string", "free"],
    ["a negative number", -0.01],
    ["a negative numeric string", "-1"],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["an infinity string", "Infinity"],
  ])("renders a safe placeholder for %s", (_label, input) => {
    expect(formatInventoryPrice(input)).toBe("—");
  });
});

describe("inventory relation options", () => {
  const products = [
    product("one", "One", {
      brand: { name: "Zed" },
      category: { name: "Jewellery" },
    }),
    product("two", "Two", {
      brand: { name: "atelier" },
      category: { name: "Bags" },
    }),
    product("three", "Three", {
      brand: { name: "Zed" },
      category: { name: "Bags" },
    }),
    product("four", "Four", {
      brand: null,
      category: null,
    }),
  ];

  it("deduplicates and sorts brand options, with a missing-brand choice last", () => {
    expect(getInventoryRelationOptions(products, "brand")).toEqual([
      { value: "atelier", label: "atelier" },
      { value: "Zed", label: "Zed" },
      { value: MISSING_RELATION_FILTER, label: "No brand" },
    ]);
  });

  it("deduplicates and sorts category options, with a missing-category choice last", () => {
    expect(getInventoryRelationOptions(products, "category")).toEqual([
      { value: "Bags", label: "Bags" },
      { value: "Jewellery", label: "Jewellery" },
      { value: MISSING_RELATION_FILTER, label: "No category" },
    ]);
  });

  it("does not invent a missing option when every relation is present", () => {
    expect(
      getInventoryRelationOptions(products.slice(0, 3), "brand"),
    ).not.toContainEqual({
      value: MISSING_RELATION_FILTER,
      label: "No brand",
    });
  });
});

describe("inventory search and filtering", () => {
  const products = [
    product("in-active", "Velvet Moon bag", {
      stockQuantity: LOW_STOCK_THRESHOLD + 1,
      isActive: true,
      brand: { name: "Aster" },
      category: { name: "Bags" },
    }),
    product("low-inactive", "Everyday tote", {
      stockQuantity: LOW_STOCK_THRESHOLD,
      isActive: false,
      brand: { name: "Velvet Moon" },
      category: { name: "Bags" },
    }),
    product("out-inactive", "Orbit necklace", {
      stockQuantity: 0,
      isActive: false,
      brand: { name: "Aster" },
      category: { name: "Jewellery" },
    }),
    product("low-missing", "Plain pouch", {
      stockQuantity: 2,
      isActive: true,
      brand: null,
      category: null,
    }),
  ];

  it("searches only product names after trimming and ignoring case", () => {
    const normalized = normalizeInventoryView(
      { q: "  vELvEt mOOn  " },
      products,
    );

    expect(normalized.search).toBe("vELvEt mOOn");
    expect(ids(getVisibleInventoryProducts(products, normalized))).toEqual([
      "in-active",
    ]);

    const relationOnly = normalizeInventoryView({ q: "Aster" }, products);
    expect(getVisibleInventoryProducts(products, relationOnly)).toEqual([]);
  });

  it.each([
    ["brand", view({ brand: "Aster" }), ["out-inactive", "in-active"]],
    [
      "missing brand",
      view({ brand: MISSING_RELATION_FILTER }),
      ["low-missing"],
    ],
    [
      "category",
      view({ category: "Bags" }),
      ["low-inactive", "in-active"],
    ],
    [
      "missing category",
      view({ category: MISSING_RELATION_FILTER }),
      ["low-missing"],
    ],
    ["in-stock status", view({ stock: "in-stock" }), ["in-active"]],
    [
      "low-stock status",
      view({ stock: "low-stock" }),
      ["low-inactive", "low-missing"],
    ],
    [
      "out-of-stock status",
      view({ stock: "out-of-stock" }),
      ["out-inactive"],
    ],
    ["active status", view({ active: "active" }), ["low-missing", "in-active"]],
    [
      "inactive status",
      view({ active: "inactive" }),
      ["low-inactive", "out-inactive"],
    ],
  ] as const)("applies the %s filter", (_label, selectedView, expectedIds) => {
    expect(ids(getVisibleInventoryProducts(products, selectedView))).toEqual(
      expectedIds,
    );
  });

  it("combines brand, category, stock, and active filters", () => {
    expect(
      ids(
        getVisibleInventoryProducts(
          products,
          view({
            brand: "Aster",
            category: "Jewellery",
            stock: "out-of-stock",
            active: "inactive",
          }),
        ),
      ),
    ).toEqual(["out-inactive"]);
  });
});

describe("inventory sorting", () => {
  it("sorts by product name and uses the product id to break equal-name ties", () => {
    const products = [
      product("name-b", "echo"),
      product("name-c", "Alpha"),
      product("name-a", "Echo"),
    ];

    expect(
      ids(getVisibleInventoryProducts(products, view({ sort: "name" }))),
    ).toEqual(["name-c", "name-a", "name-b"]);
    expect(ids(products)).toEqual(["name-b", "name-c", "name-a"]);
  });

  it("sorts by brand, breaks relation ties by name and id, and puts missing brands last", () => {
    const products = [
      product("brand-missing", "Aardvark", { brand: null }),
      product("brand-b", "echo", { brand: { name: "Beta" } }),
      product("brand-alpha", "Zulu", { brand: { name: "Alpha" } }),
      product("brand-a", "Echo", { brand: { name: "Beta" } }),
    ];

    expect(
      ids(getVisibleInventoryProducts(products, view({ sort: "brand" }))),
    ).toEqual(["brand-alpha", "brand-a", "brand-b", "brand-missing"]);
  });

  it("sorts by category, breaks relation ties by name and id, and puts missing categories last", () => {
    const products = [
      product("category-missing", "Aardvark", { category: null }),
      product("category-b", "echo", {
        category: { name: "Jewellery" },
      }),
      product("category-bags", "Zulu", { category: { name: "Bags" } }),
      product("category-a", "Echo", {
        category: { name: "Jewellery" },
      }),
    ];

    expect(
      ids(getVisibleInventoryProducts(products, view({ sort: "category" }))),
    ).toEqual([
      "category-bags",
      "category-a",
      "category-b",
      "category-missing",
    ]);
  });

  it("sorts stock from lowest to highest with deterministic ties", () => {
    const products = [
      product("stock-two-b", "echo", { stockQuantity: 2 }),
      product("stock-ten", "Ten", { stockQuantity: 10 }),
      product("stock-zero", "Zero", { stockQuantity: 0 }),
      product("stock-two-a", "Echo", { stockQuantity: 2 }),
    ];

    expect(
      ids(getVisibleInventoryProducts(products, view({ sort: "stock-asc" }))),
    ).toEqual(["stock-zero", "stock-two-a", "stock-two-b", "stock-ten"]);
  });

  it("sorts stock from highest to lowest with deterministic ties", () => {
    const products = [
      product("stock-two-b", "echo", { stockQuantity: 2 }),
      product("stock-zero", "Zero", { stockQuantity: 0 }),
      product("stock-two-a", "Echo", { stockQuantity: 2 }),
      product("stock-ten", "Ten", { stockQuantity: 10 }),
    ];

    expect(
      ids(getVisibleInventoryProducts(products, view({ sort: "stock-desc" }))),
    ).toEqual(["stock-ten", "stock-two-a", "stock-two-b", "stock-zero"]);
  });
});

describe("inventory URL view normalization", () => {
  const products = [
    product("one", "One", {
      brand: { name: "Aster" },
      category: { name: "Bags" },
    }),
    product("two", "Two", {
      brand: null,
      category: null,
    }),
  ];

  it("uses safe defaults for unknown relation, status, and sort values", () => {
    expect(
      normalizeInventoryView(
        {
          brand: "Unknown brand",
          category: "Unknown category",
          stock: "nearly-empty",
          active: "enabled",
          sort: "price",
        },
        products,
      ),
    ).toEqual({
      search: "",
      brand: ALL_INVENTORY_FILTER,
      category: ALL_INVENTORY_FILTER,
      stock: ALL_INVENTORY_FILTER,
      active: ALL_INVENTORY_FILTER,
      sort: "name",
    });
  });

  it("takes the first array value and preserves every valid selection", () => {
    expect(
      normalizeInventoryView(
        {
          q: ["  Moon bag  ", "ignored"],
          brand: ["Aster", "ignored"],
          category: ["Bags", "ignored"],
          stock: ["low-stock", "ignored"],
          active: ["inactive", "ignored"],
          sort: ["stock-desc", "ignored"],
        },
        products,
      ),
    ).toEqual({
      search: "Moon bag",
      brand: "Aster",
      category: "Bags",
      stock: "low-stock",
      active: "inactive",
      sort: "stock-desc",
    });
  });

  it("allows validated missing-relation selections and caps long searches", () => {
    const normalized = normalizeInventoryView(
      {
        q: `  ${"x".repeat(150)}  `,
        brand: MISSING_RELATION_FILTER,
        category: MISSING_RELATION_FILTER,
      },
      products,
    );

    expect(normalized.search).toBe("x".repeat(120));
    expect(normalized.brand).toBe(MISSING_RELATION_FILTER);
    expect(normalized.category).toBe(MISSING_RELATION_FILTER);
  });
});

describe("inventory summaries", () => {
  it("counts products and safely totals valid stock without inflating invalid values", () => {
    const stockValues: unknown[] = [
      LOW_STOCK_THRESHOLD + 1,
      LOW_STOCK_THRESHOLD,
      "4",
      0,
      undefined,
      -3,
      Number.POSITIVE_INFINITY,
      1.5,
      Number.NaN,
    ];
    const products = stockValues.map((stockQuantity, index) =>
      product(`summary-${index}`, `Summary ${index}`, {
        stockQuantity: stockQuantity as number,
      }),
    );

    expect(summarizeInventory(products)).toEqual({
      totalProducts: 9,
      totalStockUnits: 15,
      lowStockProducts: 2,
      outOfStockProducts: 6,
    });
  });

  it("returns zeroed totals for an empty inventory", () => {
    expect(summarizeInventory([])).toEqual({
      totalProducts: 0,
      totalStockUnits: 0,
      lowStockProducts: 0,
      outOfStockProducts: 0,
    });
  });
});
