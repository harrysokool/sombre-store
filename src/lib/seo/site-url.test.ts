import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  absoluteUrl,
  getSiteOrigin,
  getSiteUrl,
  resetSiteUrlWarningForTests,
} from "./site-url";

const PRODUCTION_ORIGIN = "https://sombre.example";
const LOCAL_ORIGIN = "http://localhost:3000";

/**
 * Sets both the environment and `SITE_URL` for one case. `vi.stubEnv` is used
 * so `NODE_ENV` is restored automatically, rather than left mutated for the
 * rest of the file.
 */
function withEnv(nodeEnv: string, siteUrl?: string) {
  vi.stubEnv("NODE_ENV", nodeEnv);

  if (siteUrl === undefined) {
    vi.stubEnv("SITE_URL", "");
    delete process.env.SITE_URL;
  } else {
    vi.stubEnv("SITE_URL", siteUrl);
  }
}

describe("SITE_URL resolution", () => {
  beforeEach(() => {
    resetSiteUrlWarningForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetSiteUrlWarningForTests();
  });

  describe("development and test environments fall back safely", () => {
    it("falls back to localhost in development when SITE_URL is unset", () => {
      withEnv("development", undefined);

      expect(() => getSiteOrigin()).not.toThrow();
      expect(getSiteOrigin()).toBe(LOCAL_ORIGIN);
    });

    it("falls back to localhost in the test environment when SITE_URL is unset", () => {
      withEnv("test", undefined);

      expect(() => getSiteOrigin()).not.toThrow();
      expect(getSiteOrigin()).toBe(LOCAL_ORIGIN);
    });

    it("accepts a plain HTTP localhost origin outside production", () => {
      withEnv("development", LOCAL_ORIGIN);

      // The normal local value. Requiring HTTPS here would make development
      // impossible without a certificate.
      expect(getSiteOrigin()).toBe(LOCAL_ORIGIN);
    });

    it("warns and falls back rather than throwing on an invalid value outside production", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      withEnv("development", "not a url");

      expect(getSiteOrigin()).toBe(LOCAL_ORIGIN);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toEqual(
        expect.stringContaining("SITE_URL"),
      );
    });

    it("still honours a valid HTTPS origin outside production", () => {
      withEnv("development", PRODUCTION_ORIGIN);

      expect(getSiteOrigin()).toBe(PRODUCTION_ORIGIN);
    });
  });

  describe("production requires a valid HTTPS origin", () => {
    it("accepts a valid HTTPS SITE_URL", () => {
      withEnv("production", PRODUCTION_ORIGIN);

      expect(getSiteOrigin()).toBe(PRODUCTION_ORIGIN);
      expect(getSiteUrl().toString()).toBe(`${PRODUCTION_ORIGIN}/`);
      expect(absoluteUrl("/shop")).toBe(`${PRODUCTION_ORIGIN}/shop`);
    });

    it("accepts a valid HTTPS SITE_URL with a trailing slash", () => {
      withEnv("production", `${PRODUCTION_ORIGIN}/`);

      expect(getSiteOrigin()).toBe(PRODUCTION_ORIGIN);
    });

    it("throws a clear configuration error when SITE_URL is missing", () => {
      withEnv("production", undefined);

      // Never a silent localhost fallback: that would publish
      // http://localhost:3000 into every canonical tag and sitemap entry.
      expect(() => getSiteOrigin()).toThrow(/Missing SITE_URL/);
      expect(() => getSiteOrigin()).toThrow(/HTTPS origin/);
    });

    it.each([
      ["a bare hostname", "sombre.example"],
      ["free text", "not a url"],
      ["an empty string", "   "],
    ])("throws when SITE_URL is invalid (%s)", (_label, value) => {
      withEnv("production", value);

      expect(() => getSiteOrigin()).toThrow(/SITE_URL/);
    });

    it("throws when SITE_URL uses HTTP rather than HTTPS", () => {
      withEnv("production", "http://sombre.example");

      expect(() => getSiteOrigin()).toThrow(/must use HTTPS in production/);
    });

    it("throws for an HTTP localhost origin in production", () => {
      withEnv("production", LOCAL_ORIGIN);

      // The exact case this correction exists to catch: a leftover development
      // value reaching a production build.
      expect(() => getSiteOrigin()).toThrow(/must use HTTPS in production/);
    });

    it.each([
      ["a path", "https://sombre.example/shop"],
      ["a query string", "https://sombre.example/?utm=1"],
      ["a fragment", "https://sombre.example/#top"],
      ["credentials", "https://user:pass@sombre.example"],
    ])("throws when SITE_URL carries %s", (_label, value) => {
      withEnv("production", value);

      // Matches the checkout helper's rule set exactly, so neither is weaker.
      expect(() => getSiteOrigin()).toThrow(/only the origin/);
    });

    it("propagates the failure through every metadata helper", () => {
      withEnv("production", undefined);

      // metadataBase, canonical URLs, robots host, and sitemap entries all
      // resolve through these, so none of them can emit a localhost URL.
      expect(() => getSiteUrl()).toThrow(/SITE_URL/);
      expect(() => absoluteUrl("/shop")).toThrow(/SITE_URL/);
      expect(() => absoluteUrl("")).toThrow(/SITE_URL/);
    });

    it("still returns an already-absolute URL without consulting SITE_URL", () => {
      withEnv("production", undefined);

      // A remotely hosted product image needs no origin, so it must not be
      // dragged down by the misconfiguration.
      expect(absoluteUrl("https://cdn.example.com/a.jpg")).toBe(
        "https://cdn.example.com/a.jpg",
      );
    });
  });
});
