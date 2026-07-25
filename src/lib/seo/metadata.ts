import type { Metadata } from "next";

import { absoluteUrl } from "@/lib/seo/site-url";
import {
  getShopView,
  type ShopSearchParams,
} from "@/lib/storefront/shop";

/** Longest description worth emitting; search engines truncate beyond this. */
const MAX_DESCRIPTION_LENGTH = 160;

export const SITE_NAME = "Sombre";

/**
 * Applied to every page that must never appear in search results: carts,
 * checkout, order outcomes, and the whole admin area.
 *
 * This is the *only* thing keeping those pages out of an index, and it works
 * precisely because `robots.ts` does not disallow them. A crawler has to fetch
 * a page to read its `noindex`; a `Disallow` would block the fetch and leave a
 * URL discovered elsewhere listed as a bare link with no way to remove it. See
 * the comment in `src/app/robots.ts` for the full layering.
 *
 * Access control for admin content is Supabase Auth, separately and always.
 */
export const PRIVATE_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  noarchive: true,
  noimageindex: true,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
};

/** Convenience wrapper for a page whose only metadata need is "stay private". */
export function privatePageMetadata(title: string): Metadata {
  return {
    title,
    robots: PRIVATE_ROBOTS,
  };
}

/**
 * Trims a description to something a search result can actually show, cutting
 * on a word boundary rather than mid-word.
 */
export function truncateDescription(
  value: string | null | undefined,
  maxLength = MAX_DESCRIPTION_LENGTH,
): string | null {
  const text = value?.replace(/\s+/g, " ").trim();

  if (!text) {
    return null;
  }

  if (text.length <= maxLength) {
    return text;
  }

  const clipped = text.slice(0, maxLength - 1);
  const lastSpace = clipped.lastIndexOf(" ");

  return `${(lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

/**
 * The canonical path for a `/shop` request.
 *
 * Policy, in one place so the page and its tests cannot drift:
 *
 * - A recognised category keeps its own canonical URL, normalised to the
 *   resolved slug. Legacy aliases (`?category=perfume`) therefore collapse onto
 *   the current slug instead of standing up a second indexable copy.
 * - Everything else canonicalises to bare `/shop`. That covers brand filters,
 *   the sort-order collections, `?view=all`, and any arbitrary query a crawler
 *   invents — all of which render a re-filtered or re-ordered slice of the same
 *   catalog, never new content.
 *
 * The effect is a fixed, small set of canonical shop URLs no matter how many
 * query permutations exist.
 */
export function getShopCanonicalPath(params: ShopSearchParams): string {
  const view = getShopView(params);

  return view.type === "category"
    ? `/shop?category=${view.categorySlug}`
    : "/shop";
}

type ProductMetadataInput = {
  slug: string;
  name: string;
  brandName: string | null;
  shortDescription: string | null;
  description: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
};

/**
 * Title for a product page, prefixed with its house when that adds something.
 *
 * The prefix is skipped when the product name already opens with the brand, so
 * a listing like "Maison Margiela Replica Jazz Club" is not doubled up.
 */
function getProductTitle(name: string, brandName: string | null): string {
  const trimmedName = name.trim();
  const trimmedBrand = brandName?.trim();

  if (
    !trimmedBrand ||
    trimmedName.toLowerCase().startsWith(trimmedBrand.toLowerCase())
  ) {
    return trimmedName;
  }

  return `${trimmedBrand} ${trimmedName}`;
}

/**
 * Description for a product page, preferring the copy written for it and
 * falling back to something accurate rather than leaving the tag empty.
 */
function getProductDescription(product: ProductMetadataInput): string {
  const written =
    truncateDescription(product.shortDescription) ??
    truncateDescription(product.description);

  if (written) {
    return written;
  }

  const brandSuffix = product.brandName?.trim()
    ? ` by ${product.brandName.trim()}`
    : "";

  return `${product.name.trim()}${brandSuffix}, available at ${SITE_NAME}.`;
}

/**
 * Metadata for one product page.
 *
 * Only fields already rendered publicly on the page are used. Stock levels,
 * internal identifiers, cost, and every other private column stay out of the
 * document head.
 */
export function buildProductMetadata(product: ProductMetadataInput): Metadata {
  const title = getProductTitle(product.name, product.brandName);
  const description = getProductDescription(product);
  const canonicalPath = `/products/${product.slug}`;
  const canonicalUrl = absoluteUrl(canonicalPath);

  // A product with no image simply omits the tag. Emitting a broken or
  // placeholder URL would give every such product a dead preview card.
  const images = product.imageUrl
    ? [
        {
          url: absoluteUrl(product.imageUrl),
          alt: product.imageAlt?.trim() || title,
        },
      ]
    : undefined;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url: canonicalUrl,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      ...(images ? { images: images.map((image) => image.url) } : {}),
    },
  };
}
