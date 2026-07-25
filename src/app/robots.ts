import type { MetadataRoute } from "next";

import { getSiteOrigin } from "@/lib/seo/site-url";

/**
 * Crawl rules for the storefront.
 *
 * These are a request, not an access control: `Disallow` asks a well-behaved
 * crawler not to fetch a path, but it neither authenticates anything nor
 * removes an already-discovered URL from an index. Real protection comes from
 * the admin auth gate, and de-indexing comes from the per-route `robots`
 * metadata. This file is the outermost of the three layers.
 *
 * `/api/` is included because those routes return JSON that has no business in
 * a search result — and the Stripe webhook in particular should never be probed
 * by a crawler.
 */
export const PRIVATE_CRAWL_PATHS = [
  "/admin",
  "/cart",
  "/checkout",
  "/api/",
] as const;

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        // Everything public — home, shop, products, brands, about, contact,
        // and the policy pages — stays crawlable.
        allow: "/",
        disallow: [...PRIVATE_CRAWL_PATHS],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
