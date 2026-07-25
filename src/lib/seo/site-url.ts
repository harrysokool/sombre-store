/**
 * Resolves the public origin used for canonical URLs, Open Graph tags, the
 * sitemap, and robots.txt.
 *
 * Relationship to `getTrustedSiteOrigin` in the checkout session route: the
 * validation rules are deliberately identical — a valid absolute URL, HTTPS,
 * and an origin with no credentials, path, query, or fragment. What differs is
 * when they apply. The checkout helper guards a payment redirect, so it refuses
 * a bad origin in every environment. Metadata legitimately runs against
 * `http://localhost:3000` while developing and testing, so the same rules are
 * enforced only under `NODE_ENV=production`.
 *
 * The two are not consolidated here because doing so would mean editing the
 * checkout route, and its stricter always-on behaviour is covered by its own
 * tests. Neither copy is weaker than the other.
 *
 * In production this throws rather than falling back. A silent localhost
 * fallback would publish `http://localhost:3000` into every canonical tag,
 * Open Graph URL, robots `Host`, and sitemap entry — damage that is invisible
 * until it has already been crawled. Failing the build is the cheaper outcome.
 *
 * `SITE_URL` is the existing environment variable; no new one is introduced and
 * no production domain is assumed.
 */

const LOCAL_FALLBACK_ORIGIN = "http://localhost:3000";

const CONFIGURE_HINT =
  "Set SITE_URL to the public HTTPS origin of this site, with no path or query (for example https://example.com).";

let hasWarnedAboutSiteUrl = false;

function warnOnce(message: string) {
  if (hasWarnedAboutSiteUrl) {
    return;
  }

  hasWarnedAboutSiteUrl = true;
  console.warn(message);
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

/**
 * Production rules. Any failure is a configuration error, reported with the
 * variable name and the fix rather than a generic message.
 */
function getProductionOrigin(configured: string | undefined): string {
  if (!configured) {
    throw new Error(
      `Missing SITE_URL. Canonical URLs, Open Graph tags, robots.txt, and the sitemap cannot be generated without it. ${CONFIGURE_HINT}`,
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(configured);
  } catch {
    throw new Error(
      `SITE_URL is not a valid absolute URL. ${CONFIGURE_HINT}`,
    );
  }

  if (parsed.protocol !== "https:") {
    throw new Error(
      `SITE_URL must use HTTPS in production (received ${parsed.protocol}//). ${CONFIGURE_HINT}`,
    );
  }

  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      `SITE_URL must contain only the origin, without credentials, a path, query parameters, or a fragment. ${CONFIGURE_HINT}`,
    );
  }

  return parsed.origin;
}

/**
 * Development and test rules. `http://localhost:3000` is the normal value here,
 * so an unset variable is expected and falls back silently. An unparseable
 * value still warns, because that is a mistake rather than a default.
 */
function getLocalOrigin(configured: string | undefined): string {
  if (!configured) {
    return LOCAL_FALLBACK_ORIGIN;
  }

  try {
    return new URL(configured).origin;
  } catch {
    warnOnce(
      `SITE_URL is not a valid absolute URL (received ${JSON.stringify(configured)}). Falling back to ${LOCAL_FALLBACK_ORIGIN}. This would be a fatal configuration error in production.`,
    );

    return LOCAL_FALLBACK_ORIGIN;
  }
}

/**
 * The trusted public origin, with no trailing slash.
 *
 * Throws in production when `SITE_URL` is missing, unparseable, not HTTPS, or
 * carries anything beyond an origin. Falls back to localhost everywhere else.
 */
export function getSiteOrigin(): string {
  const configured = process.env.SITE_URL?.trim();

  return isProductionRuntime()
    ? getProductionOrigin(configured)
    : getLocalOrigin(configured);
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
  hasWarnedAboutSiteUrl = false;
}
