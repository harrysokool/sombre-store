// Pure product image rules. Free of database and server-only imports so the
// browser controls, the Server Actions, and the admin data layer agree on what
// a valid image record and a valid move request look like.
//
// The database stays the authority: product_images.image_url is not null,
// sort_order is unique per product and non-negative, and a partial unique index
// allows at most one is_primary row per product. These rules exist so a mistake
// produces a readable message instead of a constraint violation.

export const PRODUCT_IMAGE_TEXT_LIMITS = {
  imageUrl: 500,
  altText: 300,
} as const;

/**
 * A root-relative path under `public/`, and nothing else.
 *
 * `next/image` renders every product image, and `next.config.ts` declares no
 * `images.remotePatterns`, so a remote `https://` source would throw when the
 * product page tried to render it. Restricting the column to local paths is
 * what keeps a saved image from breaking the storefront.
 *
 * The leading-slash rule also refuses `//evil.example/x.jpg`, which a browser
 * resolves as a protocol-relative URL to another origin, and any scheme such as
 * `javascript:`. Backslashes are refused because some browsers normalise them
 * to forward slashes, which would reopen the same escape.
 */
const ROOT_RELATIVE_IMAGE_PATTERN = /^\/[^/\\][^\\]*$/;

export const PRODUCT_IMAGE_MOVE_DIRECTIONS = ["up", "down"] as const;

export type ProductImageMoveDirection =
  (typeof PRODUCT_IMAGE_MOVE_DIRECTIONS)[number];

export type AdminProductImageSubmission = {
  imageUrl: unknown;
  altText: unknown;
};

/** Column-shaped and ready to insert, minus the ordering the caller assigns. */
export type ValidatedProductImage = {
  image_url: string;
  alt_text: string | null;
};

export type ProductImageValidationResult =
  | { ok: true; value: ValidatedProductImage }
  | { ok: false; error: string };

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isProductImageMoveDirection(
  value: unknown,
): value is ProductImageMoveDirection {
  return (
    typeof value === "string" &&
    (PRODUCT_IMAGE_MOVE_DIRECTIONS as readonly string[]).includes(value)
  );
}

export function isValidProductImagePath(value: string): boolean {
  return (
    value.length <= PRODUCT_IMAGE_TEXT_LIMITS.imageUrl &&
    ROOT_RELATIVE_IMAGE_PATTERN.test(value)
  );
}

/**
 * Alt text on its own, for the per-row edit.
 *
 * Empty is allowed and stored as null: the column is nullable, and a decorative
 * image with no useful description is better served by an empty alt than by an
 * invented one.
 */
export function validateProductImageAltText(
  value: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const altText = normalizeText(value);

  if (altText.length > PRODUCT_IMAGE_TEXT_LIMITS.altText) {
    return {
      ok: false,
      error: `Alt text must be ${PRODUCT_IMAGE_TEXT_LIMITS.altText} characters or fewer.`,
    };
  }

  return { ok: true, value: altText === "" ? null : altText };
}

export function validateProductImageSubmission(
  input: AdminProductImageSubmission,
): ProductImageValidationResult {
  const imageUrl = normalizeText(input.imageUrl);

  if (!imageUrl) {
    return { ok: false, error: "Enter an image path." };
  }

  if (!isValidProductImagePath(imageUrl)) {
    return {
      ok: false,
      error:
        "The image path must be a local path beginning with a single /, as in /images/products/maison-margiela/replica-jazz-club-01.jpg.",
    };
  }

  const altText = validateProductImageAltText(input.altText);

  if (!altText.ok) {
    return altText;
  }

  return {
    ok: true,
    value: { image_url: imageUrl, alt_text: altText.value },
  };
}

/**
 * The image ids in their order after moving one of them a single place.
 *
 * Returns null when the image is absent or the move runs off the end, which are
 * ordinary outcomes rather than errors — the controls disable those buttons, so
 * reaching here means a stale page or a direct request.
 *
 * Returning the whole order, rather than a pair to swap, is what lets the data
 * layer write one clean 0..n-1 sequence for every kind of change.
 */
export function getReorderedImageIds(
  orderedIds: readonly string[],
  imageId: string,
  direction: ProductImageMoveDirection,
): string[] | null {
  const index = orderedIds.indexOf(imageId);

  if (index === -1) {
    return null;
  }

  const target = direction === "up" ? index - 1 : index + 1;

  if (target < 0 || target >= orderedIds.length) {
    return null;
  }

  const reordered = [...orderedIds];

  [reordered[index], reordered[target]] = [
    reordered[target],
    reordered[index],
  ];

  return reordered;
}
