import { describe, expect, it } from "vitest";

import {
  formatProductPriceInput,
  PRODUCT_TEXT_LIMITS,
  validateAdminProductSubmission,
  validateAdminProductUpdate,
  type AdminProductSubmission,
} from "./product-rules";

const BRAND_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";

function submission(
  overrides: Partial<AdminProductSubmission> = {},
): AdminProductSubmission {
  return {
    name: "Replica Jazz Club",
    slug: "maison-margiela-replica-jazz-club",
    brandId: BRAND_ID,
    categoryId: CATEGORY_ID,
    sizeLabel: "100 mL",
    shortDescription: "Spiced warmth and polished woods.",
    description: "A smooth perfume with warm spice and polished woods.",
    price: "165.00",
    retailPrice: "",
    stockQuantity: "5",
    isActive: false,
    ...overrides,
  };
}

/** Unwraps a submission expected to pass, failing loudly when it does not. */
function validated(overrides: Partial<AdminProductSubmission> = {}) {
  const result = validateAdminProductSubmission(submission(overrides));

  if (!result.ok) {
    throw new Error(`Expected a valid submission, got: ${result.error}`);
  }

  return result.value;
}

/** Unwraps a submission expected to be refused. */
function refusal(overrides: Partial<AdminProductSubmission> = {}) {
  const result = validateAdminProductSubmission(submission(overrides));

  if (result.ok) {
    throw new Error("Expected the submission to be refused.");
  }

  return result.error;
}

/** Label, field overrides, and the exact message they should produce. */
type RefusalCase = [string, Partial<AdminProductSubmission>, string];

describe("required fields", () => {
  it("accepts a complete submission and shapes it for the columns", () => {
    expect(validated()).toEqual({
      name: "Replica Jazz Club",
      slug: "maison-margiela-replica-jazz-club",
      brand_id: BRAND_ID,
      category_id: CATEGORY_ID,
      size_label: "100 mL",
      short_description: "Spiced warmth and polished woods.",
      description: "A smooth perfume with warm spice and polished woods.",
      price: "165.00",
      retail_price: null,
      stock_quantity: 5,
      is_active: false,
    });
  });

  it.each<RefusalCase>([
    ["an empty name", { name: "" }, "Enter a product name."],
    ["a whitespace-only name", { name: "   " }, "Enter a product name."],
    ["a non-string name", { name: null }, "Enter a product name."],
    ["an empty price", { price: "" }, "Enter a Sombre price."],
  ])("refuses %s", (_label, overrides, expected) => {
    expect(refusal(overrides)).toBe(expected);
  });

  it("trims the text fields it keeps", () => {
    const value = validated({
      name: "  Replica Jazz Club  ",
      sizeLabel: "  100 mL  ",
    });

    expect(value.name).toBe("Replica Jazz Club");
    expect(value.size_label).toBe("100 mL");
  });

  it("stores an omitted optional field as null rather than an empty string", () => {
    // The columns are nullable, and "" would be a value that was never entered.
    const value = validated({
      sizeLabel: "  ",
      shortDescription: "",
      description: null,
    });

    expect(value.size_label).toBeNull();
    expect(value.short_description).toBeNull();
    expect(value.description).toBeNull();
  });

  it("refuses text past its ceiling", () => {
    expect(refusal({ name: "a".repeat(PRODUCT_TEXT_LIMITS.name + 1) })).toContain(
      "Product name must be",
    );
    expect(
      refusal({ sizeLabel: "a".repeat(PRODUCT_TEXT_LIMITS.sizeLabel + 1) }),
    ).toContain("Size label must be");
    expect(
      refusal({
        shortDescription: "a".repeat(
          PRODUCT_TEXT_LIMITS.shortDescription + 1,
        ),
      }),
    ).toContain("Short description must be");
    expect(
      refusal({ description: "a".repeat(PRODUCT_TEXT_LIMITS.description + 1) }),
    ).toContain("Description must be");
  });
});

describe("slug", () => {
  it("keeps a submitted slug as written", () => {
    // Catalog slugs are brand-prefixed, so a submitted slug is never rederived
    // from the name.
    expect(validated().slug).toBe("maison-margiela-replica-jazz-club");
  });

  it("falls back to the name when the slug field arrives empty", () => {
    expect(validated({ slug: "" }).slug).toBe("replica-jazz-club");
    expect(validated({ slug: "   " }).slug).toBe("replica-jazz-club");
  });

  it("refuses a name with no sluggable characters and no slug of its own", () => {
    expect(refusal({ name: "!!!", slug: "" })).toBe("Enter a product slug.");
  });

  it.each([
    ["uppercase letters", "Replica-Jazz"],
    ["spaces", "replica jazz"],
    ["underscores", "replica_jazz"],
    ["a leading hyphen", "-replica"],
    ["a trailing hyphen", "replica-"],
    ["doubled hyphens", "replica--jazz"],
  ])("refuses a slug with %s", (_label, slug) => {
    expect(refusal({ slug })).toContain("The slug must be lowercase letters");
  });
});

describe("brand and category", () => {
  it.each<RefusalCase>([
    ["an empty brand", { brandId: "" }, "Select a brand."],
    ["a non-uuid brand", { brandId: "noct-atelier" }, "Select a brand."],
    ["a non-string brand", { brandId: null }, "Select a brand."],
    ["an empty category", { categoryId: "" }, "Select a category."],
    ["a non-uuid category", { categoryId: "fragrance" }, "Select a category."],
    ["a non-string category", { categoryId: null }, "Select a category."],
  ])("refuses %s", (_label, overrides, expected) => {
    expect(refusal(overrides)).toBe(expected);
  });

  it("passes the two references through unchanged", () => {
    // Whether they exist is the database layer's question, not this one's.
    const value = validated();

    expect(value.brand_id).toBe(BRAND_ID);
    expect(value.category_id).toBe(CATEGORY_ID);
  });
});

describe("prices", () => {
  it.each([
    ["165.00", "165.00"],
    ["165", "165.00"],
    ["165.5", "165.50"],
    ["0", "0.00"],
    ["0.99", "0.99"],
    ["99999999.99", "99999999.99"],
  ])("accepts %s and stores it as %s", (entered, stored) => {
    // Stored as a decimal string for numeric(10, 2): cents are only ever an
    // intermediate step in validation.
    expect(validated({ price: entered }).price).toBe(stored);
  });

  it.each([
    ["a negative amount", "-5"],
    ["three decimal places", "165.123"],
    ["letters", "abc"],
    ["an exponent", "1e5"],
    ["a comma", "1,650"],
    ["a currency symbol", "$165"],
    ["a lone decimal point", "."],
  ])("refuses %s as a Sombre price", (_label, price) => {
    expect(refusal({ price })).toContain("Sombre price must be an amount");
  });

  it("refuses a price past what numeric(10, 2) can hold", () => {
    expect(refusal({ price: "100000000.00" })).toBe("Sombre price is too large.");
  });

  it("treats an absent retail price as no published retail price", () => {
    expect(validated({ retailPrice: "" }).retail_price).toBeNull();
    expect(validated({ retailPrice: "   " }).retail_price).toBeNull();
    expect(validated({ retailPrice: null }).retail_price).toBeNull();
  });

  it("accepts and canonicalises a retail price when one is given", () => {
    expect(validated({ retailPrice: "220" }).retail_price).toBe("220.00");
  });

  it.each([
    ["a negative amount", "-1"],
    ["three decimal places", "220.123"],
    ["letters", "two hundred"],
  ])("refuses %s as a retail price", (_label, retailPrice) => {
    expect(refusal({ retailPrice })).toContain("Retail price must be an amount");
  });

  it("names the field that was wrong", () => {
    // Two amount fields on one form: the message has to say which one.
    expect(refusal({ price: "-1" })).toContain("Sombre price");
    expect(refusal({ retailPrice: "-1" })).toContain("Retail price");
  });
});

describe("stock quantity", () => {
  it.each([
    ["5", 5],
    ["0", 0],
    ["1200", 1200],
  ])("accepts %s", (entered, expected) => {
    expect(validated({ stockQuantity: entered }).stock_quantity).toBe(expected);
  });

  it("defaults an empty field to the column's own default", () => {
    // A product can legitimately be added before its stock arrives.
    expect(validated({ stockQuantity: "" }).stock_quantity).toBe(0);
    expect(validated({ stockQuantity: null }).stock_quantity).toBe(0);
  });

  it.each([
    ["a negative quantity", "-1"],
    ["a fractional quantity", "1.5"],
    ["letters", "twelve"],
    ["an exponent", "1e3"],
  ])("refuses %s", (_label, stockQuantity) => {
    expect(refusal({ stockQuantity })).toBe(
      "Stock quantity must be a whole number of 0 or more.",
    );
  });

  it("refuses a quantity beyond safe integer range instead of saving zero", () => {
    // Silently collapsing to 0 would sell nothing and look like a successful
    // save.
    expect(refusal({ stockQuantity: "9".repeat(20) })).toBe(
      "Stock quantity is too large.",
    );
  });
});

describe("active status", () => {
  it("saves a checked box as active", () => {
    expect(validated({ isActive: true }).is_active).toBe(true);
  });

  it("saves an unchecked box as inactive", () => {
    expect(validated({ isActive: false }).is_active).toBe(false);
  });
});

describe("validateAdminProductUpdate", () => {
  /** Unwraps an edit expected to pass. */
  function updated(overrides: Partial<AdminProductSubmission> = {}) {
    const result = validateAdminProductUpdate(submission(overrides));

    if (!result.ok) {
      throw new Error(`Expected a valid update, got: ${result.error}`);
    }

    return result.value;
  }

  /** Unwraps an edit expected to be refused. */
  function updateRefusal(overrides: Partial<AdminProductSubmission> = {}) {
    const result = validateAdminProductUpdate(submission(overrides));

    if (result.ok) {
      throw new Error("Expected the update to be refused.");
    }

    return result.error;
  }

  it("writes only the editable columns, and never stock", () => {
    // The guard against a future column on the insert shape silently becoming
    // editable. Stock is moved by the order and restoration RPCs.
    expect(Object.keys(updated()).sort()).toEqual([
      "brand_id",
      "category_id",
      "description",
      "is_active",
      "name",
      "price",
      "retail_price",
      "short_description",
      "size_label",
      "slug",
    ]);
    expect(updated()).not.toHaveProperty("stock_quantity");
  });

  it("ignores a stock quantity smuggled into the submission", () => {
    // Even a hand-crafted post naming stock cannot move it.
    expect(updated({ stockQuantity: "9999" })).not.toHaveProperty(
      "stock_quantity",
    );
  });

  it("keeps every other rule a create is held to", () => {
    expect(updated()).toMatchObject({
      name: "Replica Jazz Club",
      slug: "maison-margiela-replica-jazz-club",
      brand_id: BRAND_ID,
      category_id: CATEGORY_ID,
      size_label: "100 mL",
      price: "165.00",
      retail_price: null,
      is_active: false,
    });
  });

  it("refuses an omitted slug instead of deriving one from the name", () => {
    // A create may take the suggestion, but an existing product's slug is a
    // live URL: deriving one here would silently move the product.
    expect(updateRefusal({ slug: "" })).toBe("Enter a product slug.");
    expect(updateRefusal({ slug: "   " })).toBe("Enter a product slug.");
  });

  it("still refuses a slug in the wrong format", () => {
    expect(updateRefusal({ slug: "Replica Jazz" })).toContain(
      "The slug must be lowercase letters",
    );
  });

  it.each<RefusalCase>([
    ["an empty name", { name: "" }, "Enter a product name."],
    ["an empty price", { price: "" }, "Enter a Sombre price."],
    ["a missing brand", { brandId: "" }, "Select a brand."],
    ["a missing category", { categoryId: "" }, "Select a category."],
  ])("refuses %s just as a create does", (_label, overrides, expected) => {
    expect(updateRefusal(overrides)).toBe(expected);
  });

  it("refuses an invalid Sombre price", () => {
    expect(updateRefusal({ price: "-5" })).toContain(
      "Sombre price must be an amount",
    );
    expect(updateRefusal({ price: "165.123" })).toContain(
      "Sombre price must be an amount",
    );
  });

  it("keeps the retail price optional and clearable", () => {
    // Emptying the field is how an admin removes a published retail price.
    expect(updated({ retailPrice: "" }).retail_price).toBeNull();
    expect(updated({ retailPrice: "220" }).retail_price).toBe("220.00");
  });

  it("refuses an invalid retail price", () => {
    expect(updateRefusal({ retailPrice: "-1" })).toContain(
      "Retail price must be an amount",
    );
  });

  it.each([
    [true, true],
    [false, false],
  ])("saves isActive %s", (isActive, expected) => {
    expect(updated({ isActive }).is_active).toBe(expected);
  });
});

describe("formatProductPriceInput", () => {
  it.each([
    ["165.00", "165.00"],
    ["165", "165.00"],
    ["165.5", "165.50"],
    ["0", "0.00"],
  ])("turns the stored string %s into %s", (stored, expected) => {
    // PostgREST returns numeric columns as strings.
    expect(formatProductPriceInput(stored)).toBe(expected);
  });

  it("accepts a number too, in case the driver returns one", () => {
    expect(formatProductPriceInput(165)).toBe("165.00");
    expect(formatProductPriceInput(0)).toBe("0.00");
  });

  it("shows an empty field rather than NaN for an absent price", () => {
    expect(formatProductPriceInput(null)).toBe("");
    expect(formatProductPriceInput(undefined)).toBe("");
    expect(formatProductPriceInput("")).toBe("");
    expect(formatProductPriceInput("not a price")).toBe("");
  });
});
