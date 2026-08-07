import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createSupabase: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  getAdminUser: mocks.getAdminUser,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: mocks.createSupabase,
}));

import type { AdminProductSubmission } from "./product-rules";
import { createAdminProduct, listAdminProductFormOptions } from "./products";

const BRAND_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";

type QueryResult = {
  data?: unknown;
  error?: unknown;
};

function query(result: QueryResult = {}) {
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
  };
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  for (const method of ["select", "eq", "order", "insert"]) {
    builder[method] = vi.fn(() => builder);
  }

  builder.returns = vi.fn(async () => resolved);
  builder.maybeSingle = vi.fn(async () => resolved);

  return builder;
}

/**
 * Hands out the queued builders per table, so a test names the tables it
 * expects rather than counting `from()` calls in order.
 */
function supabaseWith(tables: Record<string, ReturnType<typeof query>[]>) {
  const pending: Record<string, ReturnType<typeof query>[]> = {};

  for (const [table, queue] of Object.entries(tables)) {
    pending[table] = [...queue];
  }

  const client = {
    from: vi.fn((table: string) => {
      const next = pending[table]?.shift();

      if (!next) {
        throw new Error(`Unexpected Supabase query on "${table}".`);
      }

      return next;
    }),
  };

  mocks.createSupabase.mockReturnValue(client);

  return client;
}

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
    description: "A smooth perfume with warm spice.",
    price: "165.00",
    retailPrice: "",
    stockQuantity: "5",
    isActive: false,
    ...overrides,
  };
}

/**
 * Wires the happy path: both relations found, no existing slug, insert
 * succeeds. Returns the insert builder so a test can read what was written.
 */
function insertSucceeds() {
  const insert = query({ data: { id: PRODUCT_ID } });

  supabaseWith({
    brands: [query({ data: { id: BRAND_ID } })],
    categories: [query({ data: { id: CATEGORY_ID } })],
    products: [query({ data: null }), insert],
  });

  return insert;
}

beforeEach(() => {
  mocks.getAdminUser.mockReset();
  mocks.createSupabase.mockReset();
  mocks.getAdminUser.mockResolvedValue({
    id: "admin-1",
    email: "admin@example.com",
  });
  // Re-spying on an already-spied method reuses the existing spy without
  // clearing it, so a message logged by one test would otherwise still be
  // visible to the next.
  vi.spyOn(console, "error").mockImplementation(() => {}).mockClear();
});

describe("authorization", () => {
  it("refuses to read the form options without an approved session", async () => {
    mocks.getAdminUser.mockResolvedValue(null);

    await expect(listAdminProductFormOptions()).rejects.toThrow(
      "Admin product data requested without an approved session.",
    );
    // The gate is checked before any client is built, so an unapproved caller
    // never reaches the service-role key at all.
    expect(mocks.createSupabase).not.toHaveBeenCalled();
  });

  it("refuses to create a product without an approved session", async () => {
    mocks.getAdminUser.mockResolvedValue(null);

    await expect(createAdminProduct(submission())).rejects.toThrow(
      "Admin product data requested without an approved session.",
    );
    // The guard runs before validation too, so a rejected caller cannot even
    // probe which values would be accepted.
    expect(mocks.createSupabase).not.toHaveBeenCalled();
  });
});

describe("listAdminProductFormOptions", () => {
  it("returns brands and categories in name order", async () => {
    const brands = query({ data: [{ id: BRAND_ID, name: "Maison Margiela" }] });
    const categories = query({ data: [{ id: CATEGORY_ID, name: "Fragrance" }] });

    supabaseWith({ brands: [brands], categories: [categories] });

    await expect(listAdminProductFormOptions()).resolves.toEqual({
      brands: [{ id: BRAND_ID, name: "Maison Margiela" }],
      categories: [{ id: CATEGORY_ID, name: "Fragrance" }],
    });
    expect(brands.order).toHaveBeenCalledWith("name", { ascending: true });
    expect(categories.order).toHaveBeenCalledWith("name", { ascending: true });
  });

  it("throws when either list cannot be read", async () => {
    supabaseWith({
      brands: [query({ error: { message: "boom" } })],
      categories: [query({ data: [] })],
    });

    await expect(listAdminProductFormOptions()).rejects.toThrow(
      "Brands and categories could not be loaded.",
    );
  });
});

describe("createAdminProduct", () => {
  it("inserts a validated product and returns its id", async () => {
    const insert = insertSucceeds();

    await expect(createAdminProduct(submission())).resolves.toEqual({
      ok: true,
      productId: PRODUCT_ID,
    });
    expect(insert.insert).toHaveBeenCalledWith({
      name: "Replica Jazz Club",
      slug: "maison-margiela-replica-jazz-club",
      brand_id: BRAND_ID,
      category_id: CATEGORY_ID,
      size_label: "100 mL",
      short_description: "Spiced warmth and polished woods.",
      description: "A smooth perfume with warm spice.",
      price: "165.00",
      retail_price: null,
      stock_quantity: 5,
      is_active: false,
    });
  });

  it("writes stock as a plain column value", async () => {
    const insert = insertSucceeds();

    await createAdminProduct(submission({ stockQuantity: "12" }));

    const [written] = insert.insert.mock.calls[0] as [{ stock_quantity: number }];

    expect(written.stock_quantity).toBe(12);
    // The stock RPCs reconcile inventory against an existing order. A product
    // being created has no order history, so none of them is involved.
    expect(mocks.createSupabase.mock.results[0]?.value).not.toHaveProperty(
      "rpc",
    );
  });

  it("saves an active product when the box was checked", async () => {
    const insert = insertSucceeds();

    await createAdminProduct(submission({ isActive: true }));

    const [written] = insert.insert.mock.calls[0] as [{ is_active: boolean }];

    expect(written.is_active).toBe(true);
  });

  it("returns the validation refusal without touching the database", async () => {
    supabaseWith({});

    await expect(createAdminProduct(submission({ name: "" }))).resolves.toEqual({
      ok: false,
      error: "Enter a product name.",
    });
    expect(mocks.createSupabase).not.toHaveBeenCalled();
  });

  it("refuses a brand that no longer exists", async () => {
    supabaseWith({
      brands: [query({ data: null })],
      categories: [query({ data: { id: CATEGORY_ID } })],
    });

    await expect(createAdminProduct(submission())).resolves.toEqual({
      ok: false,
      error: "That brand no longer exists. Reload the form and try again.",
    });
  });

  it("refuses a category that no longer exists", async () => {
    supabaseWith({
      brands: [query({ data: { id: BRAND_ID } })],
      categories: [query({ data: null })],
    });

    await expect(createAdminProduct(submission())).resolves.toEqual({
      ok: false,
      error: "That category no longer exists. Reload the form and try again.",
    });
  });

  it("reports a generic message when the relations cannot be checked", async () => {
    supabaseWith({
      brands: [query({ error: { message: "boom" } })],
      categories: [query({ data: { id: CATEGORY_ID } })],
    });

    await expect(createAdminProduct(submission())).resolves.toEqual({
      ok: false,
      error: "The brand and category could not be checked. Try again.",
    });
  });

  it("refuses a slug another product already uses", async () => {
    supabaseWith({
      brands: [query({ data: { id: BRAND_ID } })],
      categories: [query({ data: { id: CATEGORY_ID } })],
      products: [query({ data: { id: "existing" } })],
    });

    await expect(createAdminProduct(submission())).resolves.toEqual({
      ok: false,
      error: "A product with that slug already exists. Choose a different slug.",
    });
  });

  it("reports the same duplicate message when two creates race", async () => {
    // The look-up above cannot prevent a concurrent insert, so the unique
    // violation has to say the same thing rather than a generic failure.
    supabaseWith({
      brands: [query({ data: { id: BRAND_ID } })],
      categories: [query({ data: { id: CATEGORY_ID } })],
      products: [query({ data: null }), query({ error: { code: "23505" } })],
    });

    await expect(createAdminProduct(submission())).resolves.toEqual({
      ok: false,
      error: "A product with that slug already exists. Choose a different slug.",
    });
  });

  it("reports a stale relation when the foreign key refuses the insert", async () => {
    supabaseWith({
      brands: [query({ data: { id: BRAND_ID } })],
      categories: [query({ data: { id: CATEGORY_ID } })],
      products: [query({ data: null }), query({ error: { code: "23503" } })],
    });

    await expect(createAdminProduct(submission())).resolves.toEqual({
      ok: false,
      error:
        "That brand or category no longer exists. Reload the form and try again.",
    });
  });

  it("hides database detail behind one generic message", async () => {
    supabaseWith({
      brands: [query({ data: { id: BRAND_ID } })],
      categories: [query({ data: { id: CATEGORY_ID } })],
      products: [
        query({ data: null }),
        query({
          error: { code: "42501", message: 'permission denied for table "products"' },
        }),
      ],
    });

    const result = await createAdminProduct(submission());

    expect(result).toEqual({
      ok: false,
      error: "Product could not be created. Try again.",
    });
    // The detail belongs in the server log, never in the browser.
    if (result.ok) {
      throw new Error("Expected the create to fail.");
    }
    expect(result.error).not.toContain("permission denied");
    expect(console.error).toHaveBeenCalledWith(
      "Failed to create product",
      expect.objectContaining({ code: "42501" }),
    );
  });

  it("reports a failure when the insert returns no row", async () => {
    supabaseWith({
      brands: [query({ data: { id: BRAND_ID } })],
      categories: [query({ data: { id: CATEGORY_ID } })],
      products: [query({ data: null }), query({ data: null })],
    });

    await expect(createAdminProduct(submission())).resolves.toEqual({
      ok: false,
      error: "Product could not be created. Try again.",
    });
  });
});
