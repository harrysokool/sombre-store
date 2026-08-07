// Shared product slug rules. Free of database and server-only imports so the
// same helper suggests a slug in the browser form and re-checks it in the
// Server Action and the admin data layer.
//
// products.slug is `text` behind a unique constraint and nothing more, so the
// format below is an application rule rather than a mirror of a database
// check. It exists to keep every product URL a predictable lowercase path.

/**
 * Generous enough for the brand-prefixed slugs the catalog already uses, such
 * as `maison-margiela-replica-lazy-sunday-morning`.
 */
export const MAX_PRODUCT_SLUG_LENGTH = 100;

const PRODUCT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Lowercase kebab-case derived from a product name, for the form's suggestion.
 *
 * This is only ever a starting point. The catalog's own slugs are brand
 * prefixed while a product's name is not, so an administrator editing the
 * suggestion is the normal case rather than the exception.
 *
 * Returns "" for a name with nothing sluggable in it, which the validation
 * layer reports rather than saving.
 */
export function slugifyProductName(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const slug = value
    // Accents are folded to their base letter, so "Réplica" becomes "replica"
    // rather than losing the character to the catch-all below.
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Dropped rather than replaced, so "Women's" becomes "womens", not
    // "women-s".
    .replace(/['‘’]/g, "")
    // Matches how the existing catalog slugified "Vale & Hearth".
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // Cutting to length can leave a trailing hyphen, which the format refuses, so
  // the trim is repeated on the cut result.
  return slug.slice(0, MAX_PRODUCT_SLUG_LENGTH).replace(/-+$/g, "");
}

/**
 * Lowercase alphanumeric words joined by single hyphens. Leading, trailing, and
 * doubled hyphens are refused so one product can never have two spellings of
 * the same URL.
 */
export function isValidProductSlug(value: string): boolean {
  return (
    value.length <= MAX_PRODUCT_SLUG_LENGTH && PRODUCT_SLUG_PATTERN.test(value)
  );
}
