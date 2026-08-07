// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createProductAction: vi.fn(),
  updateProductAction: vi.fn(),
}));

vi.mock("@/app/admin/products/actions", () => ({
  createProductAction: mocks.createProductAction,
  updateProductAction: mocks.updateProductAction,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import { ProductForm } from "./product-form";

const BRAND_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";

const brands = [
  { id: BRAND_ID, name: "Maison Margiela" },
  { id: "44444444-4444-4444-8444-444444444444", name: "Frédéric Malle" },
];
const categories = [{ id: CATEGORY_ID, name: "Fragrance" }];

const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";

/** The values an existing product hands the form in edit mode. */
const EXISTING_PRODUCT = {
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
} as const;

function renderForm(
  props: Partial<ComponentProps<typeof ProductForm>> = {},
) {
  render(
    <ProductForm
      mode="create"
      brands={brands}
      categories={categories}
      {...props}
    />,
  );

  return {
    name: screen.getByLabelText("Product name"),
    slug: screen.getByLabelText("Slug") as HTMLInputElement,
  };
}

function renderEditForm(
  props: Partial<ComponentProps<typeof ProductForm>> = {},
) {
  return renderForm({ mode: "edit", ...EXISTING_PRODUCT, ...props });
}

/**
 * Fills every field carrying `required`, because the browser refuses to submit
 * the form at all until they are populated.
 */
async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Product name"), "Replica Jazz Club");
  await user.selectOptions(screen.getByLabelText("Brand"), BRAND_ID);
  await user.selectOptions(screen.getByLabelText("Category"), CATEGORY_ID);
  await user.type(screen.getByLabelText("Sombre price"), "165.00");
}

beforeEach(() => {
  mocks.createProductAction.mockReset();
  mocks.updateProductAction.mockReset();
  mocks.updateProductAction.mockResolvedValue({ error: null });
  mocks.createProductAction.mockResolvedValue({ error: null });
});

afterEach(() => {
  cleanup();
});

describe("slug suggestion", () => {
  it("fills the slug from the product name", async () => {
    const user = userEvent.setup();
    const { name, slug } = renderForm();

    await user.type(name, "Replica Jazz Club");

    expect(slug.value).toBe("replica-jazz-club");
  });

  it("stops following the name once the slug is edited", async () => {
    // Catalog slugs are brand-prefixed, so editing is the normal path and the
    // name must not overwrite the administrator's own wording.
    const user = userEvent.setup();
    const { name, slug } = renderForm();

    await user.type(name, "Replica Jazz Club");
    await user.clear(slug);
    await user.type(slug, "maison-margiela-replica-jazz-club");
    await user.type(name, " Reissue");

    expect(slug.value).toBe("maison-margiela-replica-jazz-club");
  });

  it("follows the name again when the slug is cleared", async () => {
    const user = userEvent.setup();
    const { name, slug } = renderForm();

    await user.type(name, "Jazz");
    await user.clear(slug);
    await user.type(slug, "custom");
    await user.clear(slug);
    await user.type(name, " Club");

    expect(slug.value).toBe("jazz-club");
  });

  it("never follows the name when editing an existing product", async () => {
    // An existing slug is a live URL. Renaming a product must not silently move
    // it, so the suggestion is create-only.
    const user = userEvent.setup();
    const { name, slug } = renderEditForm();

    await user.clear(name);
    await user.type(name, "Replica Jazz Club Reissue");

    expect(slug.value).toBe("maison-margiela-replica-jazz-club");
  });

  it("leaves a cleared slug alone when editing", async () => {
    const user = userEvent.setup();
    const { name, slug } = renderEditForm();

    await user.clear(slug);
    await user.type(name, " Reissue");

    expect(slug.value).toBe("");
  });
});

describe("edit mode", () => {
  it("starts every field at the product's current value", () => {
    renderEditForm();

    expect(screen.getByLabelText("Product name")).toHaveValue(
      "Replica Jazz Club",
    );
    expect(screen.getByLabelText("Slug")).toHaveValue(
      "maison-margiela-replica-jazz-club",
    );
    expect(screen.getByLabelText("Brand")).toHaveValue(BRAND_ID);
    expect(screen.getByLabelText("Category")).toHaveValue(CATEGORY_ID);
    expect(screen.getByLabelText("Size label")).toHaveValue("100 mL");
    expect(screen.getByLabelText("Short description")).toHaveValue(
      "Spiced warmth and polished woods.",
    );
    expect(screen.getByLabelText("Description")).toHaveValue(
      "A smooth perfume with warm spice.",
    );
    expect(screen.getByLabelText("Sombre price")).toHaveValue(165);
    expect(screen.getByLabelText("Retail price")).toHaveValue(220);
    expect(screen.getByLabelText("Active")).toBeChecked();
  });

  it("reflects an inactive product", () => {
    renderEditForm({ isActive: false });

    expect(screen.getByLabelText("Active")).not.toBeChecked();
  });

  it("carries the product reference so the action knows what to save", () => {
    renderEditForm();

    expect(
      document.body.querySelector('input[name="productId"]'),
    ).toHaveValue(PRODUCT_ID);
  });

  it("shows stock read-only, with no field to submit", () => {
    // Stock is moved by the order and restoration RPCs. There is deliberately
    // no input here for a form post to carry.
    renderEditForm();

    expect(screen.getByText("Stock quantity")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(
      document.body.querySelector('[name="stockQuantity"]'),
    ).toBeNull();
  });

  it("labels the submit control as saving rather than creating", () => {
    renderEditForm();

    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create product" }),
    ).not.toBeInTheDocument();
  });

  it("submits through the update action, not the create action", async () => {
    const user = userEvent.setup();
    renderEditForm();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(mocks.updateProductAction).toHaveBeenCalled();
    expect(mocks.createProductAction).not.toHaveBeenCalled();
  });
});

describe("create mode is unchanged", () => {
  it("starts empty and submits through the create action", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByLabelText("Product name")).toHaveValue("");
    expect(screen.getByLabelText("Slug")).toHaveValue("");
    expect(screen.getByLabelText("Active")).not.toBeChecked();
    // Stock stays editable on a product that has no order history yet.
    expect(screen.getByLabelText("Stock quantity")).toHaveValue(0);
    expect(
      document.body.querySelector('input[name="productId"]'),
    ).toBeNull();

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(mocks.createProductAction).toHaveBeenCalled();
    expect(mocks.updateProductAction).not.toHaveBeenCalled();
  });
});

describe("brand and category", () => {
  it("offers the loaded brands and categories, and selects neither by default", () => {
    renderForm();

    const brand = screen.getByLabelText("Brand") as HTMLSelectElement;
    const category = screen.getByLabelText("Category") as HTMLSelectElement;

    expect(brand.value).toBe("");
    expect(category.value).toBe("");
    expect(
      screen.getByRole("option", { name: "Maison Margiela" }),
    ).toHaveValue(BRAND_ID);
    expect(screen.getByRole("option", { name: "Frédéric Malle" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Fragrance" })).toHaveValue(
      CATEGORY_ID,
    );
  });
});

describe("active status", () => {
  it("starts unchecked, because a product created here has no images yet", () => {
    renderForm();

    expect(screen.getByLabelText("Active")).not.toBeChecked();
  });
});

describe("errors", () => {
  it("shows the refusal returned by the action", async () => {
    mocks.createProductAction.mockResolvedValue({
      error: "A product with that slug already exists. Choose a different slug.",
    });

    const user = userEvent.setup();
    renderForm();

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A product with that slug already exists.",
    );
  });

  it("keeps the administrator's entries after a refusal", async () => {
    // React resets the form element once the action settles, which would
    // otherwise make them retype everything to fix one field.
    mocks.createProductAction.mockResolvedValue({ error: "Enter a product name." });

    const user = userEvent.setup();
    renderForm();

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    await screen.findByRole("alert");

    expect(screen.getByLabelText("Product name")).toHaveValue(
      "Replica Jazz Club",
    );
    expect(screen.getByLabelText("Sombre price")).toHaveValue(165);
    expect(screen.getByLabelText("Brand")).toHaveValue(BRAND_ID);
  });

  it("shows nothing before a submission is refused", () => {
    renderForm();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
