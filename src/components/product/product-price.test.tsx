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
