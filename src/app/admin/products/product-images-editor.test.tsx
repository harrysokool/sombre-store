// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminProductImage } from "@/lib/admin/product-images";

const mocks = vi.hoisted(() => ({
  addProductImageAction: vi.fn(),
  updateProductImageAltTextAction: vi.fn(),
  setPrimaryProductImageAction: vi.fn(),
  moveProductImageAction: vi.fn(),
  removeProductImageAction: vi.fn(),
}));

vi.mock("@/app/admin/products/image-actions", () => ({
  addProductImageAction: mocks.addProductImageAction,
  updateProductImageAltTextAction: mocks.updateProductImageAltTextAction,
  setPrimaryProductImageAction: mocks.setPrimaryProductImageAction,
  moveProductImageAction: mocks.moveProductImageAction,
  removeProductImageAction: mocks.removeProductImageAction,
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <span role="img" aria-label={alt} data-src={src} />
  ),
}));

import { ProductImagesEditor } from "./product-images-editor";

const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";

const IMAGES: AdminProductImage[] = [
  {
    id: "image-a",
    imageUrl: "/images/products/a.jpg",
    altText: "Bottle on stone",
    sortOrder: 0,
    isPrimary: true,
  },
  {
    id: "image-b",
    imageUrl: "/images/products/b.jpg",
    altText: "",
    sortOrder: 1,
    isPrimary: false,
  },
  {
    id: "image-c",
    imageUrl: "/images/products/c.jpg",
    altText: "Cap detail",
    sortOrder: 2,
    isPrimary: false,
  },
];

function renderEditor(images = IMAGES) {
  render(<ProductImagesEditor productId={PRODUCT_ID} images={images} />);
}

/** One image's row, located by the path it shows. */
function rowFor(imageUrl: string) {
  const list = screen.getByRole("list", { name: "Product images" });
  const row = within(list)
    .getAllByRole("listitem")
    .find((item) => item.textContent?.includes(imageUrl));

  if (!row) {
    throw new Error(`No row found for ${imageUrl}`);
  }

  return within(row);
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) {
    mock.mockReset();
    mock.mockResolvedValue({ error: null });
  }
});

afterEach(() => {
  cleanup();
});

describe("listing images", () => {
  it("shows one row per image, in the order given", async () => {
    renderEditor();

    const rows = within(
      screen.getByRole("list", { name: "Product images" }),
    ).getAllByRole("listitem");

    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("/images/products/a.jpg");
    expect(rows[1]).toHaveTextContent("/images/products/b.jpg");
    expect(rows[2]).toHaveTextContent("/images/products/c.jpg");
  });

  it("shows a preview, the path, and the alt text for each image", () => {
    renderEditor();

    const row = rowFor("/images/products/a.jpg");

    expect(row.getByRole("img")).toHaveAttribute(
      "data-src",
      "/images/products/a.jpg",
    );
    expect(
      row.getByLabelText("Alt text for /images/products/a.jpg"),
    ).toHaveValue("Bottle on stone");
  });

  it("marks the primary image and offers to promote the others", () => {
    renderEditor();

    expect(
      rowFor("/images/products/a.jpg").getByText("Primary"),
    ).toBeInTheDocument();
    expect(
      rowFor("/images/products/b.jpg").queryByText("Primary"),
    ).not.toBeInTheDocument();
    expect(
      rowFor("/images/products/b.jpg").getByRole("button", {
        name: "Make primary: /images/products/b.jpg",
      }),
    ).toBeInTheDocument();
  });

  it("says so when a product has no images", () => {
    renderEditor([]);

    expect(screen.getByText("This product has no images.")).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Product images" }),
    ).not.toBeInTheDocument();
  });
});

describe("ordering controls", () => {
  it("cannot move the first image up", () => {
    renderEditor();

    expect(
      rowFor("/images/products/a.jpg").getByRole("button", {
        name: "Move image up: /images/products/a.jpg",
      }),
    ).toBeDisabled();
    expect(
      rowFor("/images/products/a.jpg").getByRole("button", {
        name: "Move image down: /images/products/a.jpg",
      }),
    ).toBeEnabled();
  });

  it("cannot move the last image down", () => {
    renderEditor();

    expect(
      rowFor("/images/products/c.jpg").getByRole("button", {
        name: "Move image down: /images/products/c.jpg",
      }),
    ).toBeDisabled();
    expect(
      rowFor("/images/products/c.jpg").getByRole("button", {
        name: "Move image up: /images/products/c.jpg",
      }),
    ).toBeEnabled();
  });

  it("moves a middle image in either direction", async () => {
    const user = userEvent.setup();
    renderEditor();

    const row = rowFor("/images/products/b.jpg");

    await user.click(
      row.getByRole("button", { name: "Move image up: /images/products/b.jpg" }),
    );

    expect(mocks.moveProductImageAction).toHaveBeenCalled();
  });

  it("disables both controls when a product has one image", () => {
    renderEditor([IMAGES[0]]);

    const row = rowFor("/images/products/a.jpg");

    expect(
      row.getByRole("button", { name: "Move image up: /images/products/a.jpg" }),
    ).toBeDisabled();
    expect(
      row.getByRole("button", {
        name: "Move image down: /images/products/a.jpg",
      }),
    ).toBeDisabled();
  });
});

describe("alt text", () => {
  it("keeps the save control inert until the text actually changes", async () => {
    const user = userEvent.setup();
    renderEditor();

    const row = rowFor("/images/products/a.jpg");
    const save = row.getByRole("button", {
      name: "Save alt text for /images/products/a.jpg",
    });

    expect(save).toBeDisabled();

    await user.type(
      row.getByLabelText("Alt text for /images/products/a.jpg"),
      " and shadow",
    );

    expect(save).toBeEnabled();

    await user.click(save);

    expect(mocks.updateProductImageAltTextAction).toHaveBeenCalled();
  });
});

describe("removal", () => {
  it("asks before removing, and does nothing until confirmed", async () => {
    // Removal is irreversible, so the destructive button never submits on its
    // own.
    const user = userEvent.setup();
    renderEditor();

    const row = rowFor("/images/products/b.jpg");

    await user.click(
      row.getByRole("button", {
        name: "Remove image: /images/products/b.jpg",
      }),
    );

    expect(mocks.removeProductImageAction).not.toHaveBeenCalled();

    await user.click(
      row.getByRole("button", {
        name: "Confirm remove image: /images/products/b.jpg",
      }),
    );

    expect(mocks.removeProductImageAction).toHaveBeenCalled();
  });

  it("can be backed out of", async () => {
    const user = userEvent.setup();
    renderEditor();

    const row = rowFor("/images/products/b.jpg");

    await user.click(
      row.getByRole("button", {
        name: "Remove image: /images/products/b.jpg",
      }),
    );
    await user.click(
      row.getByRole("button", { name: "Keep image: /images/products/b.jpg" }),
    );

    expect(mocks.removeProductImageAction).not.toHaveBeenCalled();
    expect(
      row.queryByRole("button", {
        name: "Confirm remove image: /images/products/b.jpg",
      }),
    ).not.toBeInTheDocument();
  });
});

describe("adding an image", () => {
  it("submits the path and alt text", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(
      screen.getByLabelText("Image path"),
      "/images/products/d.jpg",
    );
    await user.type(screen.getByLabelText("Alt text"), "A new bottle");
    await user.click(screen.getByRole("button", { name: "Add image" }));

    expect(mocks.addProductImageAction).toHaveBeenCalled();
  });

  it("clears the fields after a successful add", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(
      screen.getByLabelText("Image path"),
      "/images/products/d.jpg",
    );
    await user.click(screen.getByRole("button", { name: "Add image" }));

    await vi.waitFor(() => {
      expect(screen.getByLabelText("Image path")).toHaveValue("");
    });
  });

  it("keeps what was typed when the add is refused", async () => {
    // Otherwise a mistyped path would have to be retyped from scratch.
    mocks.addProductImageAction.mockResolvedValue({
      error: "Enter an image path.",
    });

    const user = userEvent.setup();
    renderEditor();

    await user.type(screen.getByLabelText("Image path"), "not-a-path");
    await user.click(screen.getByRole("button", { name: "Add image" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter an image path.",
    );
    expect(screen.getByLabelText("Image path")).toHaveValue("not-a-path");
  });
});
