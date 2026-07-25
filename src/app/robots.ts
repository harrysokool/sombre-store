import type { MetadataRoute } from "next";

import { getSiteOrigin } from "@/lib/seo/site-url";

/**
 * Crawl rules for the storefront.
 *
 * The private pages — `/cart`, `/checkout` and its outcome pages, `/admin`, and
 * `/admin/login` — are deliberately **not** disallowed here, even though none of
 * them should ever appear in a search result.
 *
 * A `Disallow` rule and a `noindex` tag do not compose. Disallowing a path stops
 * a crawler from fetching it, which means it never reads the `noindex` in that
 * page's metadata. A URL discovered some other way — an inbound link, a shared
 * link, a browser toolbar — can then still be listed, as a bare URL with no
 * title or description, and the one instruction that would have removed it is
 * the very thing the disallow made unreadable. Letting crawlers fetch these
 * pages is what allows the `noindex` to be seen and obeyed.
 *
 * So the layering is:
 *
 * - Access control for admin content is Supabase Auth, and only that. Robots
 *   rules were never protection.
 * - Staying out of an index is the per-route `robots` metadata (`PRIVATE_ROBOTS`
 *   in `src/lib/seo/metadata.ts`), which requires the page to be crawlable.
 * - This file blocks only what must never be fetched at all.
 *
 * `/api/` is the one entry left: those routes return JSON that has no business
 * in a search result, they carry no metadata that could carry a `noindex`, and
 * the Stripe webhook in particular should never be probed by a crawler.
 */
export const BLOCKED_CRAWL_PATHS = ["/api/"] as const;

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        // Everything else stays crawlable, including the private pages, so
        // their noindex metadata can actually be read.
        allow: "/",
        disallow: [...BLOCKED_CRAWL_PATHS],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
