import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabase: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabase,
}));

// The admin dashboard layout pulls in the auth gate and server actions at
// import time; neither is relevant to its metadata export.
vi.mock("@/lib/supabase/admin-auth", () => ({
  requireAdminUser: vi.fn(),
  getAdminUser: vi.fn(),
}));

vi.mock("@/app/admin/actions", () => ({ signOutAdmin: vi.fn() }));

// The success page imports the receipt loader, which constructs the Stripe
// client at module load and throws without STRIPE_SECRET_KEY. Nothing about
// that is relevant to the page's metadata export.
vi.mock("@/lib/checkout/receipt", () => ({
  loadVerifiedCheckoutReceipt: vi.fn(),
}));

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
  Cormorant_Garamond: () => ({ variable: "--font-cormorant" }),
}));

import { resetSiteUrlWarningForTests } from "@/lib/seo/site-url";

const ORIGIN = "https://sombre.example";

type RobotsShape = { index?: boolean; follow?: boolean };

function robotsOf(metadata: { robots?: unknown }) {
  return metadata.robots as RobotsShape;
}

describe("route metadata", () => {
  const originalSiteUrl = process.env.SITE_URL;

  beforeEach(() => {
    process.env.SITE_URL = ORIGIN;
    resetSiteUrlWarningForTests();
    mocks.createSupabase.mockReset();
  });

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.SITE_URL;
    } else {
      process.env.SITE_URL = originalSiteUrl;
    }
    resetSiteUrlWarningForTests();
  });

  describe("root layout", () => {
    it("sets metadataBase from the configured site URL", async () => {
      const { metadata } = await import("./layout");

      expect(metadata.metadataBase?.toString()).toBe(`${ORIGIN}/`);
    });

    it("declares the page title template and a clean brand default", async () => {
      const { metadata } = await import("./layout");
      const title = metadata.title as { default: string; template: string };

      expect(title.template).toBe("%s | Sombre");
      // The home page inherits this, so it stays "Sombre", not "Sombre | Sombre".
      expect(title.default).toBe("Sombre");
    });
  });

  describe("public pages", () => {
    it("gives the shop a title, description, and self-canonical", async () => {
      const { generateMetadata } = await import("./(storefront)/shop/page");
      const metadata = await generateMetadata({});

      expect(metadata.title).toBe("Shop");
      expect(metadata.description).toEqual(expect.stringContaining("Sombre"));
      expect(metadata.alternates?.canonical).toBe("/shop");
    });

    it("gives a recognised category its own title and canonical", async () => {
      const { generateMetadata } = await import("./(storefront)/shop/page");
      const metadata = await generateMetadata({
        searchParams: Promise.resolve({ category: "fragrance" }),
      });

      expect(metadata.title).toBe("Fragrance");
      expect(metadata.alternates?.canonical).toBe("/shop?category=fragrance");
    });

    it.each([
      ["a brand filter", { brand: "maison-margiela" }],
      ["a collection sort", { collection: "new-arrivals" }],
      ["an unknown filter value", { category: "made-up" }],
    ])("keeps %s canonical to /shop", async (_label, params) => {
      const { generateMetadata } = await import("./(storefront)/shop/page");
      const metadata = await generateMetadata({
        searchParams: Promise.resolve(params),
      });

      expect(metadata.alternates?.canonical).toBe("/shop");
      expect(metadata.title).toBe("Shop");
    });

    it.each([
      ["home", "./(storefront)/page", "/"],
      ["about", "./(storefront)/about/page", "/about"],
      ["contact", "./(storefront)/contact/page", "/contact"],
      ["brands", "./(storefront)/brands/page", "/brands"],
      ["terms", "./(storefront)/terms/page", "/terms"],
      ["privacy", "./(storefront)/privacy-policy/page", "/privacy-policy"],
      ["refunds", "./(storefront)/refund-policy/page", "/refund-policy"],
      ["shipping", "./(storefront)/shipping-policy/page", "/shipping-policy"],
    ])("gives %s a description and canonical", async (_label, path, canonical) => {
      const { metadata } = await import(path);

      expect(metadata.description).toBeTruthy();
      expect(metadata.alternates?.canonical).toBe(canonical);
      // Public pages must not be accidentally hidden from search.
      expect(robotsOf(metadata)?.index).not.toBe(false);
    });

    it("strips the old ' | Sombre' suffix so the template cannot double it", async () => {
      const { metadata } = await import("./(storefront)/terms/page");

      expect(metadata.title).toBe("Terms and Conditions");
      expect(String(metadata.title)).not.toContain("| Sombre");
    });

    it("leaves the home page without its own title so it inherits the brand default", async () => {
      const { metadata } = await import("./(storefront)/page");

      expect(metadata.title).toBeUndefined();
    });
  });

  describe("private pages are noindex", () => {
    it.each([
      ["cart", "./(storefront)/cart/page"],
      ["checkout", "./(storefront)/checkout/page"],
      ["checkout success", "./(storefront)/checkout/success/page"],
      ["checkout cancel", "./(storefront)/checkout/cancel/page"],
      ["admin sign in", "./admin/login/layout"],
      ["admin dashboard", "./admin/(dashboard)/layout"],
    ])("marks %s noindex and nofollow", async (_label, path) => {
      const { metadata } = await import(path);

      expect(robotsOf(metadata).index).toBe(false);
      expect(robotsOf(metadata).follow).toBe(false);
    });

    it("keeps order details out of the success page metadata", async () => {
      const { metadata } = await import(
        "./(storefront)/checkout/success/page"
      );

      // A static title only. No description, and nothing derived from the
      // Stripe session or the customer's order.
      expect(metadata.title).toBe("Order status");
      expect(metadata.description).toBeUndefined();
    });
  });

  // The two halves have to hold together: a noindex that a crawler is blocked
  // from fetching does nothing, and a crawlable page with no noindex gets
  // indexed. Asserting them as a pair is what stops a future change to either
  // file from silently reintroducing the conflict.
  describe("private routes are crawlable AND noindex", () => {
    it.each([
      ["cart", "./(storefront)/cart/page", "/cart"],
      ["checkout", "./(storefront)/checkout/page", "/checkout"],
      [
        "checkout success",
        "./(storefront)/checkout/success/page",
        "/checkout/success",
      ],
      [
        "checkout cancel",
        "./(storefront)/checkout/cancel/page",
        "/checkout/cancel",
      ],
      ["admin sign in", "./admin/login/layout", "/admin/login"],
      ["admin dashboard", "./admin/(dashboard)/layout", "/admin"],
    ])("%s", async (_label, modulePath, urlPath) => {
      const [{ metadata }, { default: robots }] = await Promise.all([
        import(modulePath),
        import("./robots"),
      ]);

      const rule = robots().rules;
      const first = Array.isArray(rule) ? rule[0] : rule;
      const disallow = first.disallow;
      const blocked = Array.isArray(disallow)
        ? disallow
        : disallow
          ? [disallow]
          : [];

      // Crawlable, so the instruction below can actually be read...
      expect(blocked.some((path) => urlPath.startsWith(path))).toBe(false);
      // ...and carrying the instruction.
      expect(robotsOf(metadata).index).toBe(false);
      expect(robotsOf(metadata).follow).toBe(false);
    });
  });

  describe("the unfinished public login route", () => {
    // Asserted against the filesystem rather than a failed import, so the test
    // states the actual intent: the route is gone, not merely unimportable.
    const projectRoot = fileURLToPath(new URL("../..", import.meta.url));

    it("no longer exists, so /login returns not found", () => {
      // Removed rather than left as an indexable placeholder: there is no
      // customer account feature behind it.
      expect(
        existsSync(join(projectRoot, "src/app/(storefront)/login")),
      ).toBe(false);
    });

    it("took its unused placeholder component with it", () => {
      expect(
        existsSync(join(projectRoot, "src/components/shared/page-placeholder.tsx")),
      ).toBe(false);
      // The sibling component in that directory is still in use and must stay.
      expect(
        existsSync(join(projectRoot, "src/components/shared/not-found-content.tsx")),
      ).toBe(true);
    });
  });

  describe("product page metadata", () => {
    function supabaseReturning(result: {
      data?: unknown;
      error?: unknown;
    }) {
      const builder: Record<string, unknown> = {};
      builder.select = vi.fn(() => builder);
      builder.eq = vi.fn(() => builder);
      builder.maybeSingle = vi.fn(async () => ({
        data: result.data ?? null,
        error: result.error ?? null,
      }));

      mocks.createSupabase.mockReturnValue({ from: vi.fn(() => builder) });
    }

    function productRow(overrides: Record<string, unknown> = {}) {
      return {
        id: "product-1",
        name: "Replica Jazz Club",
        description: "A longer editorial description.",
        short_description: "Rum, tobacco leaf, and vetiver.",
        price: "1000.00",
        size_label: "100ml",
        stock_quantity: 4,
        is_featured: true,
        brand: { name: "Maison Margiela" },
        category: { name: "Fragrance" },
        product_images: [
          {
            image_url: "/images/products/jazz-club.png",
            alt_text: "Jazz Club bottle",
            sort_order: 0,
            is_primary: true,
          },
        ],
        ...overrides,
      };
    }

    it("builds metadata for a normal product", async () => {
      supabaseReturning({ data: productRow() });
      const { generateMetadata } = await import(
        "./(storefront)/products/[slug]/page"
      );

      const metadata = await generateMetadata({
        params: Promise.resolve({ slug: "replica-jazz-club" }),
      });

      expect(metadata.title).toBe("Maison Margiela Replica Jazz Club");
      expect(metadata.description).toBe("Rum, tobacco leaf, and vetiver.");
      expect(metadata.alternates?.canonical).toBe(
        "/products/replica-jazz-club",
      );
      expect(metadata.openGraph).toMatchObject({
        url: `${ORIGIN}/products/replica-jazz-club`,
      });
    });

    it("omits image tags for a product with no images", async () => {
      supabaseReturning({ data: productRow({ product_images: [] }) });
      const { generateMetadata } = await import(
        "./(storefront)/products/[slug]/page"
      );

      const metadata = await generateMetadata({
        params: Promise.resolve({ slug: "replica-jazz-club" }),
      });

      expect(
        (metadata.openGraph as { images?: unknown }).images,
      ).toBeUndefined();
      expect(metadata.title).toBe("Maison Margiela Replica Jazz Club");
    });

    it("returns a noindex stub for a missing product", async () => {
      supabaseReturning({ data: null });
      const { generateMetadata } = await import(
        "./(storefront)/products/[slug]/page"
      );

      const metadata = await generateMetadata({
        params: Promise.resolve({ slug: "does-not-exist" }),
      });

      // The page 404s a moment later; the metadata must not advertise it.
      expect(metadata.title).toBe("Product not found");
      expect(robotsOf(metadata).index).toBe(false);
      expect(metadata.alternates?.canonical).toBeUndefined();
    });

    it("degrades to the noindex stub instead of throwing when the query fails", async () => {
      supabaseReturning({ error: { message: "connection refused" } });
      const { generateMetadata } = await import(
        "./(storefront)/products/[slug]/page"
      );

      const metadata = await generateMetadata({
        params: Promise.resolve({ slug: "replica-jazz-club" }),
      });

      expect(robotsOf(metadata).index).toBe(false);
      expect(JSON.stringify(metadata)).not.toContain("connection refused");
    });
  });
});
