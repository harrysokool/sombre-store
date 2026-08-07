export type ProductImage = {
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
};

export type ProductRelation = {
  name: string;
};

export type ProductRelationWithSlug = ProductRelation & {
  slug: string;
};

export function normalizeProductRelation<Relation extends ProductRelation>(
  relation: Relation | Relation[] | null,
): Relation | null {
  if (!relation) {
    return null;
  }

  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

export function getSortedProductImages(
  images: ProductImage[] | null,
): ProductImage[] | null {
  if (!images) {
    return null;
  }

  return [...images].sort((left, right) => left.sort_order - right.sort_order);
}

export function getPrimaryProductImage(
  images: ProductImage[] | null,
): ProductImage | null {
  const sortedImages = getSortedProductImages(images) ?? [];

  return sortedImages.find((image) => image.is_primary) ?? sortedImages[0] ?? null;
}

/**
 * Every image a product page should show, primary first, the rest following in
 * their existing sort order.
 *
 * Sort order alone is not enough: `is_primary` may sit on any row, and the
 * image a product leads with has to be the one merchandising chose. So the
 * primary is lifted to the front and everything else keeps the order it
 * already had.
 *
 * Both rules are borrowed rather than restated — `getSortedProductImages` for
 * the order and `getPrimaryProductImage` for which row leads, including its
 * fallback to the first sorted image when nothing is flagged. In that fallback
 * case the list comes back in plain sort order, exactly as before.
 */
export function getGalleryProductImages(
  images: ProductImage[] | null,
): ProductImage[] {
  const sortedImages = getSortedProductImages(images) ?? [];
  const primaryImage = getPrimaryProductImage(images);

  if (!primaryImage) {
    return sortedImages;
  }

  return [
    primaryImage,
    ...sortedImages.filter((image) => image !== primaryImage),
  ];
}

/**
 * The image immediately after the primary one in sort order, or null when the
 * product has nothing to follow it with.
 *
 * Picks the *next* image rather than "the first one that is not primary", so
 * the pair a shop tile crossfades between always reads in the order the images
 * were arranged. A product whose primary is flagged last therefore has no
 * secondary, which is correct: there is nothing after it to move on to.
 *
 * The primary is resolved exactly as `getPrimaryProductImage` resolves it,
 * including the fallback to the first sorted image when no row is flagged, so
 * the two helpers can never disagree about which image is the primary.
 */
export function getSecondaryProductImage(
  images: ProductImage[] | null,
): ProductImage | null {
  const sortedImages = getSortedProductImages(images) ?? [];

  if (sortedImages.length < 2) {
    return null;
  }

  const flaggedIndex = sortedImages.findIndex((image) => image.is_primary);
  const primaryIndex = flaggedIndex === -1 ? 0 : flaggedIndex;

  return sortedImages[primaryIndex + 1] ?? null;
}
