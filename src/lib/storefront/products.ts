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
