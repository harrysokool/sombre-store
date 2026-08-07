// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ProductPriceDisplay } from "@/lib/storefront/promotion-display";

import { ProductPrice } from "./product-price";

const PROMOTIONAL: ProductPriceDisplay = {
  kind: "promotional",
  formattedRetailPrice: "HK$1,000.00",
  formattedPromotionalPrice: "HK$640.00",
  couponCode: "HAPPY2026",
};

const SINGLE: ProductPriceDisplay = {
  kind: "single",
  formattedPrice: "HK$800.00",
};

describe("ProductPrice", () => {
  afterEach(() => {
    cleanup();
  });

  describe("promotional pair", () => {
    it("strikes through the retail price", () => {
      render(<ProductPrice display={PROMOTIONAL} />);

      const retail = screen.getByText("HK$1,000.00");

      // <s> carries the meaning to assistive technology; the class guarantees
      // the rule is actually drawn.
      expect(retail.tagName).toBe("S");
      expect(retail.className).toContain("line-through");
    });

    it("labels the struck price as the retail price", () => {
      render(<ProductPrice display={PROMOTIONAL} />);

      expect(screen.getByText(/Retail/)).toBeInTheDocument();
    });

    it("shows the promotional price with the exact coupon wording", () => {
      render(<ProductPrice display={PROMOTIONAL} />);

      expect(
        screen.getByText("HK$640.00 w/ HAPPY2026"),
      ).toBeInTheDocument();
    });

    it("keeps the coupon code visible, since it is not applied automatically", () => {
      render(<ProductPrice display={PROMOTIONAL} />);

      expect(screen.getByText(/w\/ HAPPY2026/)).toBeInTheDocument();
    });

    it("shows exactly two prices, never the normal selling price as a third", () => {
      const { container } = render(<ProductPrice display={PROMOTIONAL} />);

      const prices = container.textContent?.match(/HK\$[\d,]+\.\d{2}/g) ?? [];

      expect(prices).toEqual(["HK$1,000.00", "HK$640.00"]);
      expect(prices).toHaveLength(2);
    });

    it("does not strike through the promotional price", () => {
      render(<ProductPrice display={PROMOTIONAL} />);

      const promotional = screen.getByText("HK$640.00 w/ HAPPY2026");

      expect(promotional.tagName).not.toBe("S");
      expect(promotional.className).not.toContain("line-through");
    });

    it("renders both lines in the detail variant too", () => {
      render(<ProductPrice display={PROMOTIONAL} variant="detail" />);

      expect(screen.getByText("HK$1,000.00").tagName).toBe("S");
      expect(
        screen.getByText("HK$640.00 w/ HAPPY2026"),
      ).toBeInTheDocument();
    });
  });

  describe("card variant", () => {
    it("renders the same two lines as every other variant", () => {
      render(<ProductPrice display={PROMOTIONAL} variant="card" />);

      const retail = screen.getByText("HK$1,000.00");

      expect(retail.tagName).toBe("S");
      expect(retail.className).toContain("line-through");
      expect(
        screen.getByText("HK$640.00 w/ HAPPY2026"),
      ).toBeInTheDocument();
    });

    it("keeps the exact coupon wording", () => {
      render(<ProductPrice display={PROMOTIONAL} variant="card" />);

      expect(screen.getByText(/w\/ HAPPY2026/)).toBeInTheDocument();
    });

    it("shows exactly two prices, never the normal selling price as a third", () => {
      const { container } = render(
        <ProductPrice display={PROMOTIONAL} variant="card" />,
      );

      const prices = container.textContent?.match(/HK\$[\d,]+\.\d{2}/g) ?? [];

      expect(prices).toEqual(["HK$1,000.00", "HK$640.00"]);
      expect(prices).toHaveLength(2);
    });

    // The shop tile is only ~150px wide in the two-column mobile grid, and this
    // is the line a customer acts on, so it must not break mid-phrase.
    it("holds the promotional price on one line", () => {
      render(<ProductPrice display={PROMOTIONAL} variant="card" />);

      expect(
        screen.getByText("HK$640.00 w/ HAPPY2026").className,
      ).toContain("whitespace-nowrap");
    });

    // The tile already carries one tracked-uppercase line for the brand. The
    // retail price drops that treatment so the block reuses the tile's muted
    // body style instead of introducing a further one.
    it("drops the tracked uppercase treatment the compact variant uses", () => {
      render(<ProductPrice display={PROMOTIONAL} variant="card" />);

      const retailLine = screen.getByText(/Retail/);

      expect(retailLine.className).not.toContain("uppercase");
      expect(retailLine.className).not.toContain("tracking-");
      expect(retailLine.className).toContain("text-stone-400");
    });

    it("falls back to the single price like the other variants", () => {
      const { container } = render(
        <ProductPrice display={SINGLE} variant="card" />,
      );

      expect(container.textContent).toBe("HK$800.00");
      expect(container.querySelector("s")).toBeNull();
      expect(container.textContent).not.toContain("HAPPY2026");
    });
  });

  // The card variant was added alongside these, not in place of them: "compact"
  // still dresses the homepage row and "detail" the product page.
  describe("existing variants are untouched", () => {
    it("keeps the tracked uppercase retail line in the compact variant", () => {
      render(<ProductPrice display={PROMOTIONAL} variant="compact" />);

      const retailLine = screen.getByText(/Retail/);

      expect(retailLine.className).toContain("uppercase");
      expect(retailLine.className).toContain("tracking-[0.16em]");
      expect(retailLine.className).toContain("text-[0.7rem]");
    });

    it("keeps the compact promotional line at its original size and colour", () => {
      render(<ProductPrice display={PROMOTIONAL} variant="compact" />);

      const promotional = screen.getByText("HK$640.00 w/ HAPPY2026");

      expect(promotional.className).toContain("text-sm");
      expect(promotional.className).toContain("text-stone-200");
      expect(promotional.className).not.toContain("whitespace-nowrap");
    });

    it("keeps the detail variant's heavier promotional line", () => {
      render(<ProductPrice display={PROMOTIONAL} variant="detail" />);

      const promotional = screen.getByText("HK$640.00 w/ HAPPY2026");

      expect(promotional.className).toContain("text-2xl");
      expect(promotional.className).toContain("font-light");
      expect(promotional.className).toContain("text-stone-100");
    });
  });

  describe("single price fallback", () => {
    it("renders the price alone", () => {
      const { container } = render(<ProductPrice display={SINGLE} />);

      expect(container.textContent).toBe("HK$800.00");
    });

    it("adds no strikethrough and no coupon wording", () => {
      const { container } = render(<ProductPrice display={SINGLE} />);

      expect(container.querySelector("s")).toBeNull();
      expect(container.textContent).not.toContain("HAPPY2026");
      expect(container.textContent).not.toContain("Retail");
    });
  });
});
