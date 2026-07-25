import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo/site-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Regenerated hourly. The catalog changes far more slowly than that, and it
// keeps a crawl from running a fresh Supabase query on every hit.
export const revalidate = 3600;

type SitemapProductRow = {
  slug: string;
  updated_at: string | null;
};

type StaticRoute = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
};

/**
 * Only genuinely public, stable pages.
 *
 * Deliberately absent: `/cart`, `/checkout`, `/checkout/success`,
 * `/checkout/cancel`, every `/admin` route, and `/api`. Listing a page here
 * actively invites a crawler to it, which is the opposite of what those need.
 * `/login` is absent because the route no longer exists.
 *
 * Query-string URLs are absent as a rule. The shop's category and brand filters
 * live entirely in query strings, and submitting those would advertise the
 * filtered permutations this project's canonical policy exists to collapse. The
 * category views stay discoverable through the on-page navigation and remain
 * indexable via their self-canonical; they simply are not promoted here.
 */
const STATIC_ROUTES: StaticRoute[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/shop", changeFrequency: "daily", priority: 0.9 },
  { path: "/brands", changeFrequency: "weekly", priority: 0.7 },
  { path: "/about", changeFrequency: "yearly", priority: 0.5 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.5 },
  { path: "/shipping-policy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/refund-policy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy-policy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
];

/**
 * Only a value that parses into a real date is used. A null, empty, or
 * malformed `updated_at` yields no `lastModified` at all, which is better than
 * stamping every product with "now" and teaching crawlers the field is noise.
 */
function toLastModified(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);

  return Number.isFinite(parsed.getTime()) ? parsed : undefined;
}

/**
 * Active product slugs, read server-side.
 *
 * A query failure returns an empty list rather than throwing: a broken sitemap
 * route would surface an internal error page to a crawler and could get the
 * whole sitemap dropped. Serving the static routes alone degrades quietly and
 * recovers on the next revalidation.
 */
async function getActiveProductEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("products")
      .select("slug, updated_at")
      // Inactive products are excluded here, matching the product page itself,
      // which 404s for anything not active.
      .eq("is_active", true)
      .order("slug", { ascending: true })
      .returns<SitemapProductRow[]>();

    if (error) {
      throw error;
    }

    return (data ?? [])
      .filter((product) => Boolean(product.slug?.trim()))
      .map((product) => {
        const lastModified = toLastModified(product.updated_at);

        return {
          url: absoluteUrl(`/products/${product.slug.trim()}`),
          changeFrequency: "weekly" as const,
          priority: 0.8,
          ...(lastModified ? { lastModified } : {}),
        };
      });
  } catch (error) {
    console.error("Failed to load products for the sitemap:", error);

    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const productEntries = await getActiveProductEntries();

  return [
    ...STATIC_ROUTES.map((route) => ({
      url: absoluteUrl(route.path),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...productEntries,
  ];
}
