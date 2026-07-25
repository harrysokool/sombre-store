/**
 * Resolves the public origin used for canonical URLs, Open Graph tags, the
 * sitemap, and robots.txt.
 *
 * This deliberately never throws. `getTrustedSiteOrigin` in the checkout
 * session route is the strict counterpart: it guards a payment redirect, so a
 * misconfigured origin must fail loudly there. Metadata is different — throwing
 * here would break `next build` and take the whole storefront down over a
 * missing SEO value, so an unset variable degrades to a development origin and
 * a single warning instead.
 *
 * `SITE_URL` is the existing environment variable; no new one is introduced and
 * no production domain is assumed.
 */

const DEVELOPMENT_SITE_URL = "http://localhost:3000";

let hasWarnedAboutMissingSiteUrl = false;

function warnOnce(message: string) {
  if (hasWarnedAboutMissingSiteUrl) {
    return;
  }

  hasWarnedAboutMissingSiteUrl = true;
  console.warn(message);
}

/**
 * The trusted public origin, with no trailing slash.
 *
 * Falls back to localhost when `SITE_URL` is unset or unusable. In production
 * that fallback is wrong on purpose: it keeps the build working while making
 * the misconfiguration obvious in the server log and in the rendered tags,
 * rather than silently inventing a domain.
 */
export function getSiteOrigin(): string {
  const configured = process.env.SITE_URL?.trim();

  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      warnOnce(
        "SITE_URL is not set. Canonical URLs, Open Graph tags, robots.txt, and the sitemap will fall back to http://localhost:3000. Set SITE_URL to the public origin before launch.",
      );
    }

    return DEVELOPMENT_SITE_URL;
  }

  try {
    const parsed = new URL(configured);

    // Only an origin is meaningful here. A stray path or query in the
    // environment value would corrupt every canonical URL built from it.
    return parsed.origin;
  } catch {
    warnOnce(
      `SITE_URL is not a valid absolute URL (received ${JSON.stringify(configured)}). Falling back to http://localhost:3000.`,
    );

    return DEVELOPMENT_SITE_URL;
  }
}

/** The origin as a `URL`, for `metadataBase`. */
export function getSiteUrl(): URL {
  return new URL(getSiteOrigin());
}

/**
 * Builds an absolute URL from a site-relative path.
 *
 * A value that is already absolute is returned unchanged, so a remotely hosted
 * product image is never rewritten onto this origin.
 */
export function absoluteUrl(path: string): string {
  const trimmed = path.trim();

  if (!trimmed) {
    return getSiteOrigin();
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `${getSiteOrigin()}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

/** Reset hook for tests, so the warn-once latch does not leak between cases. */
export function resetSiteUrlWarningForTests() {
  hasWarnedAboutMissingSiteUrl = false;
}
