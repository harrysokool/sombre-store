import { describe, expect, it } from "vitest";

import {
  normalizeProductListItem,
  type ProductListItemRow,
} from "./shop";

function productRow(
  overrides: Partial<ProductListItemRow> = {},
): ProductListItemRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Replica Jazz Club",
    slug: "replica-jazz-club",
    short_description: null,
    price: "1000.00",
    retail_price: null,
    size_label: "100ml",
    stock_quantity: 3,
    is_featured: false,
    created_at: "2026-08-05T00:00:00.000Z",
    brand: null,
    category: null,
    product_images: null,
    ...overrides,
  };
}

describe("normalizeProductListItem", () => {
  // Supabase returns numeric columns as decimal strings, so the mapping must
  // hand the value through untouched rather than coercing it to a number.
  it("passes a retail price through unchanged", () => {
    const item = normalizeProductListItem(
      productRow({ retail_price: "1000.00" }),
    );

    expect(item.retail_price).toBe("1000.00");
  });

  // A product with no published retail price stays null; no value is invented.
  it("keeps a missing retail price as null", () => {
    const item = normalizeProductListItem(productRow({ retail_price: null }));

    expect(item.retail_price).toBeNull();
  });

  // The retail price is a separate column and must not disturb the selling
  // price, which is what checkout charges from.
  it("leaves the selling price untouched", () => {
    const item = normalizeProductListItem(
      productRow({ price: "640.00", retail_price: "1000.00" }),
    );

    expect(item.price).toBe("640.00");
  });

  describe("images", () => {
    function productImage(url: string, sortOrder: number, isPrimary = false) {
      return {
        image_url: url,
        alt_text: `${url} alt`,
        sort_order: sortOrder,
        is_primary: isPrimary,
      };
    }

    it("keeps the primary image and the one that follows it", () => {
      const item = normalizeProductListItem(
        productRow({
          product_images: [
            productImage("/c.jpg", 2),
            productImage("/a.jpg", 0, true),
            productImage("/b.jpg", 1),
          ],
        }),
      );

      expect(item.primaryImage?.image_url).toBe("/a.jpg");
      expect(item.secondaryImage?.image_url).toBe("/b.jpg");
    });

    // Only the two the tile can show are carried; a third would be dead weight
    // on every list this mapping feeds.
    it("carries no image beyond those two", () => {
      const item = normalizeProductListItem(
        productRow({
          product_images: [
            productImage("/a.jpg", 0, true),
            productImage("/b.jpg", 1),
            productImage("/c.jpg", 2),
          ],
        }),
      );

      expect(Object.keys(item).filter((key) => key.endsWith("Image"))).toEqual([
        "primaryImage",
        "secondaryImage",
      ]);
    });

    // The existing fallback is untouched: one image still resolves as primary.
    it("leaves the secondary null for a single-image product", () => {
      const item = normalizeProductListItem(
        productRow({ product_images: [productImage("/a.jpg", 0, true)] }),
      );

      expect(item.primaryImage?.image_url).toBe("/a.jpg");
      expect(item.secondaryImage).toBeNull();
    });

    it("leaves both null when the product has no images", () => {
      const item = normalizeProductListItem(productRow({ product_images: null }));

      expect(item.primaryImage).toBeNull();
      expect(item.secondaryImage).toBeNull();
    });
  });
});
