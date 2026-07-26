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

import { listAdminInventory } from "./inventory-data";

type QueryResult = {
  data?: unknown;
  error?: unknown;
};

function stubClient(result: QueryResult = {}) {
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
  };
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  for (const method of [
    "select",
    "order",
    "limit",
    "eq",
    "neq",
    "filter",
    "match",
    "is",
  ]) {
    builder[method] = vi.fn(() => builder);
  }

  builder.returns = vi.fn(async () => resolved);

  const client = {
    from: vi.fn(() => builder),
  };

  mocks.createSupabase.mockReturnValue(client);

  return { builder, client };
}

const ACTIVE_PRODUCT = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Active tee",
  price: "480.00",
  stock_quantity: 8,
  is_active: true,
  brand: { name: "Sombre" },
  category: { name: "Tops" },
  product_images: [
    {
      image_url: "https://example.com/active-tee.jpg",
      alt_text: "Active tee",
    },
  ],
};

const INACTIVE_PRODUCT = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Archived trousers",
  price: 720,
  stock_quantity: 0,
  is_active: false,
  brand: null,
  category: null,
  product_images: null,
};

describe("admin inventory data layer", () => {
  beforeEach(() => {
    mocks.getAdminUser.mockReset();
    mocks.createSupabase.mockReset();
    mocks.getAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
  });

  it("authorizes before creating a service-role client and fails closed", async () => {
    mocks.getAdminUser.mockResolvedValue(null);

    await expect(listAdminInventory()).rejects.toThrow(
      "Admin inventory data requested without an approved session.",
    );

    expect(mocks.getAdminUser).toHaveBeenCalledTimes(1);
    expect(mocks.createSupabase).not.toHaveBeenCalled();
  });

  it("uses one products query with exactly the fields the page needs", async () => {
    const { builder, client } = stubClient({ data: [] });

    await listAdminInventory();

    expect(mocks.getAdminUser).toHaveBeenCalledTimes(1);
    expect(mocks.createSupabase).toHaveBeenCalledTimes(1);
    expect(mocks.getAdminUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createSupabase.mock.invocationCallOrder[0],
    );
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledWith("products");
    expect(builder.select).toHaveBeenCalledTimes(1);
    expect(builder.returns).toHaveBeenCalledTimes(1);

    const selectedColumns = String(builder.select.mock.calls[0]?.[0]).replace(
      /\s+/g,
      "",
    );

    expect(selectedColumns).toBe(
      "id,name,price,stock_quantity,is_active," +
        "brand:brands(name),category:categories(name)," +
        "product_images(image_url,alt_text)",
    );
    expect(selectedColumns).not.toContain("description");
    expect(selectedColumns).not.toContain("slug");
    expect(selectedColumns).not.toContain("created_at");
    expect(selectedColumns).not.toContain("updated_at");
  });

  it("orders and limits the embedded images inside the products query", async () => {
    const { builder } = stubClient({ data: [] });

    await listAdminInventory();

    expect(builder.order).toHaveBeenCalledTimes(3);
    expect(builder.order).toHaveBeenNthCalledWith(1, "name", {
      ascending: true,
    });
    expect(builder.order).toHaveBeenNthCalledWith(2, "is_primary", {
      ascending: false,
      referencedTable: "product_images",
    });
    expect(builder.order).toHaveBeenNthCalledWith(3, "sort_order", {
      ascending: true,
      referencedTable: "product_images",
    });
    expect(builder.limit).toHaveBeenCalledTimes(1);
    expect(builder.limit).toHaveBeenCalledWith(1, {
      referencedTable: "product_images",
    });
  });

  it("does not add an active-only filter", async () => {
    const { builder } = stubClient({
      data: [ACTIVE_PRODUCT, INACTIVE_PRODUCT],
    });

    await listAdminInventory();

    expect(builder.eq).not.toHaveBeenCalled();
    expect(builder.neq).not.toHaveBeenCalled();
    expect(builder.filter).not.toHaveBeenCalled();
    expect(builder.match).not.toHaveBeenCalled();
    expect(builder.is).not.toHaveBeenCalled();
  });

  it("returns both active and inactive products", async () => {
    stubClient({ data: [ACTIVE_PRODUCT, INACTIVE_PRODUCT] });

    await expect(listAdminInventory()).resolves.toEqual([
      {
        id: ACTIVE_PRODUCT.id,
        name: "Active tee",
        price: "480.00",
        stockQuantity: 8,
        isActive: true,
        brand: { name: "Sombre" },
        category: { name: "Tops" },
        primaryImage: {
          imageUrl: "https://example.com/active-tee.jpg",
          altText: "Active tee",
        },
      },
      {
        id: INACTIVE_PRODUCT.id,
        name: "Archived trousers",
        price: 720,
        stockQuantity: 0,
        isActive: false,
        brand: null,
        category: null,
        primaryImage: null,
      },
    ]);
  });

  it("returns an empty inventory when the query result is null", async () => {
    stubClient({ data: null });

    await expect(listAdminInventory()).resolves.toEqual([]);
  });

  it("surfaces query errors to the caller", async () => {
    const queryError = { message: "inventory query failed" };
    stubClient({ error: queryError });

    await expect(listAdminInventory()).rejects.toBe(queryError);
  });
});
