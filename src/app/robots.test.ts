import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetSiteUrlWarningForTests } from "@/lib/seo/site-url";

import robots from "./robots";

const ORIGIN = "https://sombre.example";

/** Every path the private routes live under, as a crawler would see them. */
const PRIVATE_PAGE_PATHS = [
  "/cart",
  "/checkout",
  "/checkout/success",
  "/checkout/cancel",
  "/admin",
  "/admin/login",
  "/admin/orders",
  "/admin/orders/abc",
  "/admin/coupons",
] as const;

function disallowList() {
  const rule = robots().rules;
  const first = Array.isArray(rule) ? rule[0] : rule;
  const disallow = first.disallow;

  return Array.isArray(disallow) ? disallow : disallow ? [disallow] : [];
}

function isBlocked(path: string) {
  return disallowList().some((blocked) => path.startsWith(blocked));
}

describe("robots.txt", () => {
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

  it("allows normal storefront crawling", () => {
    const rule = robots().rules;
    const first = Array.isArray(rule) ? rule[0] : rule;

    expect(first.userAgent).toBe("*");
    expect(first.allow).toBe("/");
  });

  it.each([
    ["the home page", "/"],
    ["the shop", "/shop"],
    ["a category view", "/shop?category=fragrance"],
    ["a product page", "/products/replica-jazz-club"],
    ["the brands page", "/brands"],
    ["about", "/about"],
    ["contact", "/contact"],
    ["a policy page", "/privacy-policy"],
  ])("does not block %s", (_label, path) => {
    expect(isBlocked(path)).toBe(false);
  });

  describe("private pages are crawlable so their noindex can be read", () => {
    it.each(PRIVATE_PAGE_PATHS.map((path) => [path] as const))(
      "does not disallow %s",
      (path) => {
        // Disallowing this would stop a crawler fetching the page, and so stop
        // it ever reading the noindex that is the actual de-indexing
        // instruction. See src/app/robots.ts.
        expect(isBlocked(path)).toBe(false);
      },
    );

    it.each([
      ["/admin", "admin content"],
      ["/cart", "the cart"],
      ["/checkout", "checkout"],
    ])("has no %s disallow entry at all (%s)", (path) => {
      expect(disallowList()).not.toContain(path);
    });

    it("relies on authentication, not robots rules, for admin protection", () => {
      // Nothing under /admin is blocked here; the auth gate is what keeps the
      // content private, and noindex is what keeps the URL unlisted.
      expect(
        PRIVATE_PAGE_PATHS.filter((path) => path.startsWith("/admin")).every(
          (path) => !isBlocked(path),
        ),
      ).toBe(true);
    });
  });

  describe("API routes stay blocked", () => {
    it.each([
      ["a checkout API route", "/api/checkout/session"],
      ["the coupon API route", "/api/checkout/coupon"],
      ["the Stripe webhook", "/api/stripe/webhook"],
    ])("blocks %s", (_label, path) => {
      expect(isBlocked(path)).toBe(true);
    });

    it("blocks only the API prefix", () => {
      // The one thing that must never be fetched: JSON endpoints carry no
      // metadata, so they have no way to express a noindex of their own.
      expect(disallowList()).toEqual(["/api/"]);
    });
  });

  it("points at the sitemap on the configured origin", () => {
    expect(robots().sitemap).toBe(`${ORIGIN}/sitemap.xml`);
    expect(robots().host).toBe(ORIGIN);
  });

  it("does not reference the removed public login path", () => {
    expect(disallowList()).not.toContain("/login");
  });
});
