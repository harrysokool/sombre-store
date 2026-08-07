// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createProductAction: vi.fn(),
}));

vi.mock("@/app/admin/products/actions", () => ({
  createProductAction: mocks.createProductAction,
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

function renderForm() {
  render(<ProductForm brands={brands} categories={categories} />);

  return {
    name: screen.getByLabelText("Product name"),
    slug: screen.getByLabelText("Slug") as HTMLInputElement,
  };
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
