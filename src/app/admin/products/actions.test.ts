import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createAdminProduct: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

// The real redirect() signals by throwing, which is what makes it unsafe to
// call inside a try/catch. Mirroring that here is what proves the action calls
// it from outside one.
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  getAdminUser: mocks.getAdminUser,
}));

vi.mock("@/lib/admin/products", () => ({
  createAdminProduct: mocks.createAdminProduct,
}));

import { createProductAction } from "./actions";

const BRAND_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";

const initialState = { error: null };

function formData(entries: Record<string, string> = {}) {
  const data = new FormData();
  const fields = {
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
    ...entries,
  };

  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }

  return data;
}

beforeEach(() => {
  mocks.getAdminUser.mockReset();
  mocks.createAdminProduct.mockReset();
  mocks.revalidatePath.mockReset();
  mocks.redirect.mockReset();
  mocks.redirect.mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
  mocks.getAdminUser.mockResolvedValue({
    id: "admin-1",
    email: "admin@example.com",
  });
  mocks.createAdminProduct.mockResolvedValue({
    ok: true,
    productId: PRODUCT_ID,
  });
  // Re-spying on an already-spied method reuses the existing spy without
  // clearing it, so a message logged by one test would otherwise still be
  // visible to the next.
  vi.spyOn(console, "error").mockImplementation(() => {}).mockClear();
});

describe("authorization", () => {
  it("refuses an expired session before reaching the data layer", async () => {
    mocks.getAdminUser.mockResolvedValue(null);

    const state = await createProductAction(initialState, formData());

    expect(state.error).toContain("admin session has ended");
    // A Server Action is a directly callable endpoint, so this gate runs before
    // anything is written.
    expect(mocks.createAdminProduct).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("form parsing", () => {
  it("passes every field through to the data layer", async () => {
    await expect(
      createProductAction(initialState, formData()),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.createAdminProduct).toHaveBeenCalledWith({
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
    });
  });

  it("reads a checked box as active", async () => {
    await expect(
      createProductAction(initialState, formData({ isActive: "on" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.createAdminProduct).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true }),
    );
  });

  it("reads an absent box as inactive", async () => {
    // An unchecked checkbox is not submitted at all.
    await expect(
      createProductAction(initialState, formData()),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.createAdminProduct).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
    );
  });
});

describe("success", () => {
  it("refreshes inventory and redirects there", async () => {
    // There is no product list page yet; inventory is the existing admin view
    // that lists every product, including inactive ones.
    await expect(
      createProductAction(initialState, formData()),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/inventory");
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/inventory");
  });

  it("revalidates before redirecting", async () => {
    await expect(
      createProductAction(initialState, formData()),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.revalidatePath.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.redirect.mock.invocationCallOrder[0],
    );
  });
});

describe("failure", () => {
  it("keeps the administrator on the form when the data layer refuses", async () => {
    mocks.createAdminProduct.mockResolvedValue({
      ok: false,
      error: "A product with that slug already exists. Choose a different slug.",
    });

    const state = await createProductAction(initialState, formData());

    expect(state.error).toBe(
      "A product with that slug already exists. Choose a different slug.",
    );
    // Nothing was written, so the cached views are still correct.
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("shows one generic message when the data layer throws", async () => {
    mocks.createAdminProduct.mockRejectedValue(
      new Error('permission denied for table "products"'),
    );

    const state = await createProductAction(initialState, formData());

    expect(state.error).toBe("Product could not be created. Try again.");
    expect(state.error).not.toContain("permission denied");
    expect(console.error).toHaveBeenCalledWith(
      "Admin product creation failed",
      expect.any(Error),
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("lets the redirect signal escape the try/catch", async () => {
    // redirect() throws to signal. Catching it would turn a successful save
    // into a generic error message and strand the administrator on the form.
    await expect(
      createProductAction(initialState, formData()),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(console.error).not.toHaveBeenCalled();
  });
});
