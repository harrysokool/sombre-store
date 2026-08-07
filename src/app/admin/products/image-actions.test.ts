import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  addAdminProductImage: vi.fn(),
  updateAdminProductImageAltText: vi.fn(),
  setAdminPrimaryProductImage: vi.fn(),
  moveAdminProductImage: vi.fn(),
  removeAdminProductImage: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  getAdminUser: mocks.getAdminUser,
}));

vi.mock("@/lib/admin/product-images", () => ({
  addAdminProductImage: mocks.addAdminProductImage,
  updateAdminProductImageAltText: mocks.updateAdminProductImageAltText,
  setAdminPrimaryProductImage: mocks.setAdminPrimaryProductImage,
  moveAdminProductImage: mocks.moveAdminProductImage,
  removeAdminProductImage: mocks.removeAdminProductImage,
}));

import {
  addProductImageAction,
  moveProductImageAction,
  removeProductImageAction,
  setPrimaryProductImageAction,
  updateProductImageAltTextAction,
} from "./image-actions";

const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
const IMAGE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const initialState = { error: null };

/** The same form body with one field left out, to probe a missing reference. */
function without(
  body: Readonly<Record<string, string>>,
  omitted: string,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(body).filter(([key]) => key !== omitted),
  );
}

function formData(entries: Record<string, string>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }

  return data;
}

/** Every action, with a form body that satisfies it. */
const ACTIONS = [
  [
    "addProductImageAction",
    addProductImageAction,
    "addAdminProductImage",
    { productId: PRODUCT_ID, imageUrl: "/images/products/a.jpg", altText: "" },
  ],
  [
    "updateProductImageAltTextAction",
    updateProductImageAltTextAction,
    "updateAdminProductImageAltText",
    { productId: PRODUCT_ID, imageId: IMAGE_ID, altText: "A bottle" },
  ],
  [
    "setPrimaryProductImageAction",
    setPrimaryProductImageAction,
    "setAdminPrimaryProductImage",
    { productId: PRODUCT_ID, imageId: IMAGE_ID },
  ],
  [
    "moveProductImageAction",
    moveProductImageAction,
    "moveAdminProductImage",
    { productId: PRODUCT_ID, imageId: IMAGE_ID, direction: "up" },
  ],
  [
    "removeProductImageAction",
    removeProductImageAction,
    "removeAdminProductImage",
    { productId: PRODUCT_ID, imageId: IMAGE_ID },
  ],
] as const;

beforeEach(() => {
  for (const mock of Object.values(mocks)) {
    mock.mockReset();
  }

  mocks.getAdminUser.mockResolvedValue({
    id: "admin-1",
    email: "admin@example.com",
  });

  for (const name of [
    "addAdminProductImage",
    "updateAdminProductImageAltText",
    "setAdminPrimaryProductImage",
    "moveAdminProductImage",
    "removeAdminProductImage",
  ] as const) {
    mocks[name].mockResolvedValue({ ok: true });
  }

  vi.spyOn(console, "error").mockImplementation(() => {}).mockClear();
});

describe("authorization", () => {
  it.each(ACTIONS)(
    "%s refuses an expired session before reaching the data layer",
    async (_name, action, dataLayerName, body) => {
      mocks.getAdminUser.mockResolvedValue(null);

      const state = await action(initialState, formData(body));

      expect(state.error).toContain("admin session has ended");
      // A Server Action is a directly callable endpoint, so this gate runs
      // before anything is written.
      expect(mocks[dataLayerName]).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );
});

describe("references", () => {
  it.each(ACTIONS)(
    "%s refuses a submission with no product reference",
    async (_name, action, dataLayerName, body) => {
      const state = await action(initialState, formData(without(body, "productId")));

      expect(state.error).toBe("That image reference is not valid.");
      expect(mocks[dataLayerName]).not.toHaveBeenCalled();
    },
  );

  it.each(ACTIONS.filter(([name]) => name !== "addProductImageAction"))(
    "%s refuses a submission with no image reference",
    async (_name, action, dataLayerName, body) => {
      const state = await action(initialState, formData(without(body, "imageId")));

      expect(state.error).toBe("That image reference is not valid.");
      expect(mocks[dataLayerName]).not.toHaveBeenCalled();
    },
  );
});

describe("passing the submission through", () => {
  it("adds an image with its path and alt text", async () => {
    await addProductImageAction(
      initialState,
      formData({
        productId: PRODUCT_ID,
        imageUrl: "/images/products/a.jpg",
        altText: "A bottle",
      }),
    );

    expect(mocks.addAdminProductImage).toHaveBeenCalledWith(PRODUCT_ID, {
      imageUrl: "/images/products/a.jpg",
      altText: "A bottle",
    });
  });

  it("edits alt text for one image", async () => {
    await updateProductImageAltTextAction(
      initialState,
      formData({
        productId: PRODUCT_ID,
        imageId: IMAGE_ID,
        altText: "A bottle",
      }),
    );

    expect(mocks.updateAdminProductImageAltText).toHaveBeenCalledWith(
      PRODUCT_ID,
      IMAGE_ID,
      "A bottle",
    );
  });

  it("sets a primary image", async () => {
    await setPrimaryProductImageAction(
      initialState,
      formData({ productId: PRODUCT_ID, imageId: IMAGE_ID }),
    );

    expect(mocks.setAdminPrimaryProductImage).toHaveBeenCalledWith(
      PRODUCT_ID,
      IMAGE_ID,
    );
  });

  it.each(["up", "down"])("moves an image %s", async (direction) => {
    await moveProductImageAction(
      initialState,
      formData({ productId: PRODUCT_ID, imageId: IMAGE_ID, direction }),
    );

    expect(mocks.moveAdminProductImage).toHaveBeenCalledWith(
      PRODUCT_ID,
      IMAGE_ID,
      direction,
    );
  });

  it("removes an image", async () => {
    await removeProductImageAction(
      initialState,
      formData({ productId: PRODUCT_ID, imageId: IMAGE_ID }),
    );

    expect(mocks.removeAdminProductImage).toHaveBeenCalledWith(
      PRODUCT_ID,
      IMAGE_ID,
    );
  });
});

describe("success", () => {
  it.each(ACTIONS)(
    "%s refreshes the editor and the inventory list",
    async (_name, action, _dataLayerName, body) => {
      const state = await action(initialState, formData(body));

      expect(state.error).toBeNull();
      expect(mocks.revalidatePath).toHaveBeenCalledWith(
        `/admin/products/${PRODUCT_ID}/edit`,
      );
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/inventory");
    },
  );
});

describe("failure", () => {
  it.each(ACTIONS)(
    "%s surfaces a refusal without refreshing anything",
    async (_name, action, dataLayerName, body) => {
      mocks[dataLayerName].mockResolvedValue({
        ok: false,
        error: "That image is not part of this product.",
      });

      const state = await action(initialState, formData(body));

      expect(state.error).toBe("That image is not part of this product.");
      // Nothing was written, so the cached views are still correct.
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it.each(ACTIONS)(
    "%s shows one generic message when the data layer throws",
    async (_name, action, dataLayerName, body) => {
      mocks[dataLayerName].mockRejectedValue(
        new Error('permission denied for table "product_images"'),
      );

      const state = await action(initialState, formData(body));

      expect(state.error).toBe("That change could not be saved. Try again.");
      expect(state.error).not.toContain("permission denied");
      expect(console.error).toHaveBeenCalledWith(
        "Admin product image action failed",
        expect.any(Error),
      );
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );
});
