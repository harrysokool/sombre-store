// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseBrowserClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: mocks.createSupabaseBrowserClient,
}));

// Nothing in a client component may reach the service role. If this is ever
// called from here, the key would be in the browser bundle.
vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: mocks.createSupabaseServiceRoleClient,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

import { ProductSearchPanel } from "./product-search-panel";

const PRODUCT_A = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B = "22222222-2222-4222-8222-222222222222";

function productRow(
  id: string,
  name: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    short_description: null,
    price: "800.00",
    retail_price: "1000.00",
    size_label: "100 mL",
    stock_quantity: 5,
    is_featured: false,
    created_at: "2026-08-05T00:00:00.000Z",
    brand: { name: "Maison Margiela", slug: "maison-margiela" },
    category: { name: "Fragrance", slug: "fragrance" },
    product_images: null,
    ...overrides,
  };
}

function browserClientReturning(rows: unknown[]) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  for (const method of ["select", "eq", "order"]) {
    builder[method] = vi.fn(() => builder);
  }

  builder.returns = vi.fn(async () => ({ data: rows, error: null }));

  mocks.from.mockReturnValue(builder);
  mocks.createSupabaseBrowserClient.mockReturnValue({ from: mocks.from });

  return builder;
}

function renderPanel({
  rows = [productRow(PRODUCT_A, "Jazz Club")],
  promotionDiscounts = {} as Record<string, number>,
  isOpen = true,
} = {}) {
  browserClientReturning(rows);

  return render(
    <ProductSearchPanel
      isOpen={isOpen}
      onClose={vi.fn()}
      returnFocusRef={{ current: null }}
      promotionDiscounts={promotionDiscounts}
    />,
  );
}

async function search(term: string) {
  const input = await screen.findByLabelText("Search fragrance or brand");
  await userEvent.type(input, term);
  return input;
}

// The prices a rendered result row actually shows, in order.
function renderedPrices(container: HTMLElement) {
  return container.textContent?.match(/HK\$[\d,]+\.\d{2}/g) ?? [];
}

describe("ProductSearchPanel promotional pricing", () => {
  beforeEach(() => {
    mocks.createSupabaseBrowserClient.mockReset();
    mocks.createSupabaseServiceRoleClient.mockReset();
    mocks.from.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  describe("promotional pair", () => {
    it("shows the promotional price for an assigned product", async () => {
      renderPanel({ promotionDiscounts: { [PRODUCT_A]: 2_000 } });

      await search("jazz");

      // HK$800.00 less 20% is HK$640.00.
      expect(
        await screen.findByText("HK$640.00 w/ HAPPY2026"),
      ).toBeInTheDocument();
    });

    it("strikes through the retail price", async () => {
      renderPanel({ promotionDiscounts: { [PRODUCT_A]: 2_000 } });

      await search("jazz");

      const retail = await screen.findByText("HK$1,000.00");
      expect(retail.tagName).toBe("S");
      expect(retail.className).toContain("line-through");
    });

    it("keeps the exact coupon wording", async () => {
      renderPanel({ promotionDiscounts: { [PRODUCT_A]: 2_000 } });

      await search("jazz");

      expect(await screen.findByText(/w\/ HAPPY2026/)).toBeInTheDocument();
    });

    it("shows two prices, never the normal selling price as a third", async () => {
      const { container } = renderPanel({
        promotionDiscounts: { [PRODUCT_A]: 2_000 },
      });

      await search("jazz");

      await screen.findByText("HK$640.00 w/ HAPPY2026");
      expect(renderedPrices(container)).toEqual([
        "HK$1,000.00",
        "HK$640.00",
      ]);
      expect(container.textContent).not.toContain("HK$800.00");
    });

    it("promotes only the assigned product in a mixed result list", async () => {
      const { container } = renderPanel({
        rows: [
          productRow(PRODUCT_A, "Jazz Club"),
          productRow(PRODUCT_B, "Jazz Lounge"),
        ],
        promotionDiscounts: { [PRODUCT_A]: 2_000 },
      });

      await search("jazz");

      await screen.findByText("HK$640.00 w/ HAPPY2026");
      expect(renderedPrices(container)).toEqual([
        "HK$1,000.00",
        "HK$640.00",
        "HK$800.00",
      ]);
    });
  });

  describe("single price fallback", () => {
    it("keeps the single price when no retail price is published", async () => {
      const { container } = renderPanel({
        rows: [productRow(PRODUCT_A, "Jazz Club", { retail_price: null })],
        promotionDiscounts: { [PRODUCT_A]: 2_000 },
      });

      await search("jazz");

      await screen.findByText("Jazz Club");
      expect(renderedPrices(container)).toEqual(["HK$800.00"]);
      expect(container.textContent).not.toContain("HAPPY2026");
      expect(container.querySelector("s")).toBeNull();
    });

    it("keeps the single price when the product has no assignment", async () => {
      const { container } = renderPanel({ promotionDiscounts: {} });

      await search("jazz");

      await screen.findByText("Jazz Club");
      expect(renderedPrices(container)).toEqual(["HK$800.00"]);
      expect(container.textContent).not.toContain("HAPPY2026");
      expect(container.querySelector("s")).toBeNull();
    });

    it("keeps the single price when a different product is assigned", async () => {
      const { container } = renderPanel({
        promotionDiscounts: { [PRODUCT_B]: 2_000 },
      });

      await search("jazz");

      await screen.findByText("Jazz Club");
      expect(renderedPrices(container)).toEqual(["HK$800.00"]);
    });
  });

  describe("browser privileges", () => {
    it("never constructs the service-role client", async () => {
      renderPanel({ promotionDiscounts: { [PRODUCT_A]: 2_000 } });

      await search("jazz");
      await screen.findByText("HK$640.00 w/ HAPPY2026");

      expect(mocks.createSupabaseServiceRoleClient).not.toHaveBeenCalled();
    });

    it("queries only the public products table from the browser", async () => {
      renderPanel({ promotionDiscounts: { [PRODUCT_A]: 2_000 } });

      await search("jazz");
      await screen.findByText("HK$640.00 w/ HAPPY2026");

      // The discount tables revoke every privilege from the anon role, and this
      // panel must not even attempt to read them.
      const queriedTables = mocks.from.mock.calls.map(([table]) => table);
      expect(queriedTables).toEqual(["products"]);
      expect(queriedTables).not.toContain("discount_codes");
      expect(queriedTables).not.toContain("discount_code_products");
    });

    it("shows a promotional price without any extra request", async () => {
      renderPanel({ promotionDiscounts: { [PRODUCT_A]: 2_000 } });

      await search("jazz");
      await screen.findByText("HK$640.00 w/ HAPPY2026");

      // The discount arrives as a prop, so pricing costs the browser nothing
      // beyond the catalog fetch the panel already made.
      expect(mocks.from).toHaveBeenCalledTimes(1);
    });
  });

  describe("existing search behaviour", () => {
    it("shows the prompt before anything is typed", () => {
      renderPanel();

      expect(
        screen.getByText("Search by fragrance or brand."),
      ).toBeInTheDocument();
    });

    it("filters by product name", async () => {
      renderPanel({
        rows: [
          productRow(PRODUCT_A, "Jazz Club"),
          productRow(PRODUCT_B, "Sailing Day"),
        ],
      });

      await search("sailing");

      expect(await screen.findByText("Sailing Day")).toBeInTheDocument();
      expect(screen.queryByText("Jazz Club")).not.toBeInTheDocument();
    });

    it("filters by brand name", async () => {
      renderPanel({
        rows: [
          productRow(PRODUCT_A, "Jazz Club"),
          productRow(PRODUCT_B, "Sailing Day", {
            brand: { name: "Byredo", slug: "byredo" },
          }),
        ],
      });

      await search("byredo");

      expect(await screen.findByText("Sailing Day")).toBeInTheDocument();
      expect(screen.queryByText("Jazz Club")).not.toBeInTheDocument();
    });

    it("reports when nothing matches", async () => {
      renderPanel();

      await search("nothing-matches-this");

      // Twice on purpose, and unchanged by this phase: once in the polite live
      // region for screen readers, once visibly in the panel.
      const messages = await screen.findAllByText("No products found.");
      expect(messages).toHaveLength(2);
    });

    it("caps the result list at six", async () => {
      renderPanel({
        rows: Array.from({ length: 9 }, (_, index) =>
          productRow(`${index}`.repeat(8), `Jazz ${index}`),
        ),
        promotionDiscounts: {},
      });

      await search("jazz");

      await waitFor(() => {
        expect(screen.getAllByRole("link")).toHaveLength(6);
      });
    });

    it("links each result to its product page", async () => {
      renderPanel({ promotionDiscounts: { [PRODUCT_A]: 2_000 } });

      await search("jazz");

      const link = await screen.findByRole("link");
      expect(link).toHaveAttribute("href", "/products/jazz-club");
    });

    it("still marks a sold-out product", async () => {
      renderPanel({
        rows: [productRow(PRODUCT_A, "Jazz Club", { stock_quantity: 0 })],
        promotionDiscounts: { [PRODUCT_A]: 2_000 },
      });

      await search("jazz");

      expect(await screen.findByText("Sold out")).toBeInTheDocument();
    });

    it("closes on Escape", async () => {
      const onClose = vi.fn();
      browserClientReturning([productRow(PRODUCT_A, "Jazz Club")]);

      render(
        <ProductSearchPanel
          isOpen
          onClose={onClose}
          returnFocusRef={{ current: null }}
          promotionDiscounts={{}}
        />,
      );

      await userEvent.keyboard("{Escape}");

      expect(onClose).toHaveBeenCalled();
    });

    it("loads nothing until the panel is opened", () => {
      renderPanel({ isOpen: false });

      expect(mocks.createSupabaseBrowserClient).not.toHaveBeenCalled();
    });
  });
});
