import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildProductMetadata,
  getShopCanonicalPath,
  privatePageMetadata,
  truncateDescription,
} from "./metadata";
import {
  absoluteUrl,
  getSiteOrigin,
  resetSiteUrlWarningForTests,
} from "./site-url";

const ORIGIN = "https://sombre.example";

describe("SEO metadata helpers", () => {
  const originalSiteUrl = process.env.SITE_URL;

  beforeEach(() => {
    process.env.SITE_URL = ORIGIN;
    resetSiteUrlWarningForTests();
  });

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.SITE_URL;
    } else {
      process.env.SITE_URL = originalSiteUrl;
    }
    resetSiteUrlWarningForTests();
  });

  describe("site origin resolution", () => {
    it("uses the configured SITE_URL origin", () => {
      expect(getSiteOrigin()).toBe(ORIGIN);
      expect(absoluteUrl("/shop")).toBe(`${ORIGIN}/shop`);
    });

    it("strips any path, query, or fragment from the configured value", () => {
      process.env.SITE_URL = `${ORIGIN}/some/path?x=1#frag`;

      expect(getSiteOrigin()).toBe(ORIGIN);
    });

    it("falls back to localhost rather than throwing when SITE_URL is unset", () => {
      delete process.env.SITE_URL;

      // Never throwing is the point: a missing SEO value must not break the
      // build or take the storefront down.
      expect(() => getSiteOrigin()).not.toThrow();
      expect(getSiteOrigin()).toBe("http://localhost:3000");
    });

    it("falls back rather than throwing when SITE_URL is not a valid URL", () => {
      process.env.SITE_URL = "not a url";

      expect(() => getSiteOrigin()).not.toThrow();
      expect(getSiteOrigin()).toBe("http://localhost:3000");
    });

    it("never rewrites an already-absolute URL onto this origin", () => {
      expect(absoluteUrl("https://cdn.example.com/a.jpg")).toBe(
        "https://cdn.example.com/a.jpg",
      );
    });
  });

  describe("private page metadata", () => {
    it("marks a page noindex and nofollow", () => {
      const metadata = privatePageMetadata("Cart");

      expect(metadata.title).toBe("Cart");
      expect(metadata.robots).toMatchObject({ index: false, follow: false });
    });
  });

  describe("truncateDescription", () => {
    it("returns null for empty or missing copy", () => {
      expect(truncateDescription(null)).toBeNull();
      expect(truncateDescription("   ")).toBeNull();
    });

    it("keeps short copy intact and collapses whitespace", () => {
      expect(truncateDescription("A  quiet\n  scent")).toBe("A quiet scent");
    });

    it("clips long copy on a word boundary", () => {
      const long = `${"word ".repeat(60)}end`;
      const result = truncateDescription(long)!;

      expect(result.length).toBeLessThanOrEqual(160);
      expect(result.endsWith("…")).toBe(true);
      expect(result).not.toMatch(/wor…$/);
    });
  });

  describe("shop canonical policy", () => {
    it("canonicalises the bare shop page to itself", () => {
      expect(getShopCanonicalPath({})).toBe("/shop");
    });

    it("gives a recognised category its own canonical URL", () => {
      expect(getShopCanonicalPath({ category: "fragrance" })).toBe(
        "/shop?category=fragrance",
      );
    });

    it("collapses a legacy category alias onto the current slug", () => {
      // ?category=perfume and ?category=fragrance render the same products, so
      // they must not stand up two indexable copies.
      expect(getShopCanonicalPath({ category: "perfume" })).toBe(
        "/shop?category=fragrance",
      );
      expect(getShopCanonicalPath({ category: "home-fragrance" })).toBe(
        "/shop?category=skincare",
      );
    });

    it.each([
      ["a brand filter", { brand: "maison-margiela" }],
      ["a collection sort", { collection: "new-arrivals" }],
      ["the best-sellers sort", { collection: "best-sellers" }],
      ["a view toggle", { view: "all" }],
      ["an unknown category", { category: "not-a-real-category" }],
      ["an array-valued param", { category: ["nope", "also-nope"] }],
    ])("points %s back at /shop", (_label, params) => {
      expect(getShopCanonicalPath(params)).toBe("/shop");
    });

    it("drops a brand refinement from a category canonical", () => {
      // The brand filter narrows the category page rather than creating a new
      // one, so both share the category's canonical URL.
      expect(
        getShopCanonicalPath({
          category: "fragrance",
          brand: "maison-margiela",
        }),
      ).toBe("/shop?category=fragrance");
    });

    it("produces a bounded set of canonicals across many filter permutations", () => {
      const permutations = [
        {},
        { brand: "a" },
        { brand: "b" },
        { collection: "new-arrivals" },
        { collection: "best-sellers", brand: "a" },
        { view: "all" },
        { category: "fragrance" },
        { category: "perfume" },
        { category: "fragrance", brand: "a" },
        { category: "fragrance", brand: "b", view: "all" },
        { category: "skincare" },
        { category: "junk", brand: "x", collection: "y" },
      ];

      const canonicals = new Set(permutations.map(getShopCanonicalPath));

      // Twelve query permutations collapse to three canonical URLs.
      expect(canonicals).toEqual(
        new Set(["/shop", "/shop?category=fragrance", "/shop?category=skincare"]),
      );
    });
  });

  describe("product metadata", () => {
    const baseProduct = {
      slug: "replica-jazz-club",
      name: "Replica Jazz Club",
      brandName: "Maison Margiela",
      shortDescription: "Rum, tobacco leaf, and vetiver.",
      description: "A longer editorial description of the fragrance.",
      imageUrl: "/images/products/maison-margiela/jazz-club.png",
      imageAlt: "Replica Jazz Club bottle",
    };

    it("builds full metadata for a normal product", () => {
      const metadata = buildProductMetadata(baseProduct);

      expect(metadata.title).toBe("Maison Margiela Replica Jazz Club");
      expect(metadata.description).toBe("Rum, tobacco leaf, and vetiver.");
      expect(metadata.alternates?.canonical).toBe(
        "/products/replica-jazz-club",
      );
    });

    it("sets the canonical URL from the slug", () => {
      expect(
        buildProductMetadata({ ...baseProduct, slug: "another-scent" })
          .alternates?.canonical,
      ).toBe("/products/another-scent");
    });

    it("sets Open Graph title, description, url, and image", () => {
      const openGraph = buildProductMetadata(baseProduct).openGraph;

      expect(openGraph).toMatchObject({
        type: "website",
        siteName: "Sombre",
        title: "Maison Margiela Replica Jazz Club",
        description: "Rum, tobacco leaf, and vetiver.",
        url: `${ORIGIN}/products/replica-jazz-club`,
      });
      expect(
        (openGraph as { images?: { url: string; alt: string }[] }).images,
      ).toEqual([
        {
          url: `${ORIGIN}/images/products/maison-margiela/jazz-club.png`,
          alt: "Replica Jazz Club bottle",
        },
      ]);
    });

    it("sets a large-image Twitter card when an image exists", () => {
      const twitter = buildProductMetadata(baseProduct).twitter;

      expect(twitter).toMatchObject({
        card: "summary_large_image",
        title: "Maison Margiela Replica Jazz Club",
      });
      expect((twitter as { images?: string[] }).images).toEqual([
        `${ORIGIN}/images/products/maison-margiela/jazz-club.png`,
      ]);
    });

    it("omits image tags entirely for a product with no image", () => {
      const metadata = buildProductMetadata({
        ...baseProduct,
        imageUrl: null,
        imageAlt: null,
      });

      // A broken or placeholder image URL would give every such product a dead
      // preview card, so the tag is left out instead.
      expect(
        (metadata.openGraph as { images?: unknown }).images,
      ).toBeUndefined();
      expect((metadata.twitter as { images?: unknown }).images).toBeUndefined();
      expect((metadata.twitter as { card?: string }).card).toBe("summary");
      // Everything else still renders.
      expect(metadata.title).toBe("Maison Margiela Replica Jazz Club");
      expect(metadata.alternates?.canonical).toBe(
        "/products/replica-jazz-club",
      );
    });

    it("does not repeat a brand the product name already starts with", () => {
      expect(
        buildProductMetadata({
          ...baseProduct,
          name: "Maison Margiela Replica Jazz Club",
        }).title,
      ).toBe("Maison Margiela Replica Jazz Club");
    });

    it("uses the product name alone when no brand is known", () => {
      expect(
        buildProductMetadata({ ...baseProduct, brandName: null }).title,
      ).toBe("Replica Jazz Club");
    });

    it("falls back to the long description, then to generated copy", () => {
      expect(
        buildProductMetadata({ ...baseProduct, shortDescription: null })
          .description,
      ).toBe("A longer editorial description of the fragrance.");

      expect(
        buildProductMetadata({
          ...baseProduct,
          shortDescription: null,
          description: null,
        }).description,
      ).toBe("Replica Jazz Club by Maison Margiela, available at Sombre.");
    });

    it("keeps private database fields out of the metadata", () => {
      const serialized = JSON.stringify(buildProductMetadata(baseProduct));

      // Only publicly rendered fields are used; nothing about stock, price,
      // internal ids, or activity flags reaches the document head.
      for (const field of [
        "stock_quantity",
        "is_active",
        "is_featured",
        "price",
        "id",
        "cost",
      ]) {
        expect(serialized).not.toContain(field);
      }
    });
  });
});
