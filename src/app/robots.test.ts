import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetSiteUrlWarningForTests } from "@/lib/seo/site-url";

import robots from "./robots";

const ORIGIN = "https://sombre.example";

function disallowList() {
  const rule = robots().rules;
  const first = Array.isArray(rule) ? rule[0] : rule;
  const disallow = first.disallow;

  return Array.isArray(disallow) ? disallow : disallow ? [disallow] : [];
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
  ])("does not disallow %s", (_label, path) => {
    for (const blocked of disallowList()) {
      expect(path.startsWith(blocked)).toBe(false);
    }
  });

  it.each([
    ["the admin dashboard", "/admin"],
    ["a nested admin route", "/admin/orders/abc"],
    ["admin sign in", "/admin/login"],
    ["the cart", "/cart"],
    ["checkout", "/checkout"],
    ["checkout success", "/checkout/success"],
    ["checkout cancel", "/checkout/cancel"],
    ["an API route", "/api/checkout/session"],
    ["the Stripe webhook", "/api/stripe/webhook"],
  ])("blocks %s", (_label, path) => {
    expect(
      disallowList().some((blocked) => path.startsWith(blocked)),
    ).toBe(true);
  });

  it("points at the sitemap on the configured origin", () => {
    expect(robots().sitemap).toBe(`${ORIGIN}/sitemap.xml`);
    expect(robots().host).toBe(ORIGIN);
  });

  it("does not block the removed public login path as a side effect", () => {
    // /login no longer exists and 404s. It is simply absent from the rules
    // rather than being disallowed, which would imply it is a real private
    // page.
    expect(disallowList()).not.toContain("/login");
  });
});
