// Pure product rules. Free of database and server-only imports so the same
// checks back the browser form, the Server Action, and the admin data layer,
// and can be probed on their own.
//
// The database stays the authority: products.price and products.retail_price
// carry non-negative checks, stock_quantity carries its own, slug is unique,
// and brand_id and category_id are non-null foreign keys. These rules exist so
// a mistake produces a readable message instead of a constraint violation.

import { normalizeStockQuantity } from "@/lib/admin/inventory";
import {
  isValidProductSlug,
  MAX_PRODUCT_SLUG_LENGTH,
  slugifyProductName,
} from "@/lib/admin/product-slug";
import {
  formatHkdCentsForDatabase,
  parseHkdDecimalToCents,
} from "@/lib/checkout/money";

/**
 * Application-level ceilings. The columns behind these are unconstrained
 * `text`, so none of them mirrors a database check; they exist to keep a
 * runaway paste out of the catalog and are set well above the longest values
 * the real catalog uses.
 */
export const PRODUCT_TEXT_LIMITS = {
  name: 200,
  sizeLabel: 80,
  shortDescription: 300,
  description: 4000,
} as const;

/**
 * products.price and products.retail_price are numeric(10, 2): eight digits
 * before the decimal point and two after. A larger figure is refused here so it
 * reads as a validation message instead of a numeric overflow from PostgreSQL.
 */
const MAX_PRICE_CENTS = 9_999_999_999;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STOCK_PATTERN = /^\d+$/;

export type AdminProductSubmission = {
  name: unknown;
  slug: unknown;
  brandId: unknown;
  categoryId: unknown;
  sizeLabel: unknown;
  shortDescription: unknown;
  description: unknown;
  price: unknown;
  retailPrice: unknown;
  stockQuantity: unknown;
  isActive: boolean;
};

/** Column-shaped and ready to insert, with prices as decimal strings. */
export type ValidatedProductInsert = {
  name: string;
  slug: string;
  brand_id: string;
  category_id: string;
  size_label: string | null;
  short_description: string | null;
  description: string | null;
  price: string;
  retail_price: string | null;
  stock_quantity: number;
  is_active: boolean;
};

/**
 * The columns an edit is allowed to write, and the only shape the update path
 * ever hands to the database.
 *
 * `stock_quantity` is deliberately absent. Existing stock is moved by the paid
 * order and restoration RPCs, which reconcile it against real orders; letting a
 * form overwrite that figure would silently discard whatever those recorded.
 */
export type ValidatedProductUpdate = {
  name: string;
  slug: string;
  brand_id: string;
  category_id: string;
  size_label: string | null;
  short_description: string | null;
  description: string | null;
  price: string;
  retail_price: string | null;
  is_active: boolean;
};

export type ProductValidationResult =
  | { ok: true; value: ValidatedProductInsert }
  | { ok: false; error: string };

export type ProductUpdateValidationResult =
  | { ok: true; value: ValidatedProductUpdate }
  | { ok: false; error: string };

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Trims a submitted field, turning anything empty into null, because an empty
 * input is what "not set" looks like on a form and the columns store an absent
 * value as null rather than "".
 */
function normalizeOptionalText(value: unknown): string | null {
  const trimmed = normalizeText(value);

  return trimmed === "" ? null : trimmed;
}

/**
 * Validates one HKD amount and returns it as the canonical two-decimal string
 * the numeric(10, 2) column stores.
 *
 * `parseHkdDecimalToCents` is the project's existing money guard, and its
 * pattern admits only digits with at most two decimal places — which refuses
 * negatives, exponent forms, and a third decimal in one place. The cents it
 * returns are used to range-check and re-format here and are never stored:
 * product prices stay decimal in the database, unlike the minor units Stripe
 * is charged in.
 */
function parseProductPrice(
  value: string,
  label: string,
): { ok: true; value: string } | { ok: false; error: string } {
  let cents: number;

  try {
    cents = parseHkdDecimalToCents(value);
  } catch {
    return {
      ok: false,
      error: `${label} must be an amount with at most two decimal places, such as 165.00.`,
    };
  }

  if (cents > MAX_PRICE_CENTS) {
    return { ok: false, error: `${label} is too large.` };
  }

  return { ok: true, value: formatHkdCentsForDatabase(cents) };
}

export function validateAdminProductSubmission(
  input: AdminProductSubmission,
): ProductValidationResult {
  const name = normalizeText(input.name);

  if (!name) {
    return { ok: false, error: "Enter a product name." };
  }

  if (name.length > PRODUCT_TEXT_LIMITS.name) {
    return {
      ok: false,
      error: `Product name must be ${PRODUCT_TEXT_LIMITS.name} characters or fewer.`,
    };
  }

  // An empty slug field falls back to the name, so a submission that arrives
  // before the browser filled the suggestion still saves the slug the form
  // would have offered rather than being refused for a field the administrator
  // never had to touch.
  const submittedSlug = normalizeText(input.slug);
  const slug = submittedSlug === "" ? slugifyProductName(name) : submittedSlug;

  if (!slug) {
    return { ok: false, error: "Enter a product slug." };
  }

  if (!isValidProductSlug(slug)) {
    return {
      ok: false,
      error: `The slug must be lowercase letters and numbers joined by single hyphens, up to ${MAX_PRODUCT_SLUG_LENGTH} characters, as in maison-margiela-replica-jazz-club.`,
    };
  }

  const brandId = normalizeText(input.brandId);

  if (!UUID_PATTERN.test(brandId)) {
    return { ok: false, error: "Select a brand." };
  }

  const categoryId = normalizeText(input.categoryId);

  if (!UUID_PATTERN.test(categoryId)) {
    return { ok: false, error: "Select a category." };
  }

  const sizeLabel = normalizeOptionalText(input.sizeLabel);
  const shortDescription = normalizeOptionalText(input.shortDescription);
  const description = normalizeOptionalText(input.description);

  const lengthChecks = [
    ["Size label", sizeLabel, PRODUCT_TEXT_LIMITS.sizeLabel],
    [
      "Short description",
      shortDescription,
      PRODUCT_TEXT_LIMITS.shortDescription,
    ],
    ["Description", description, PRODUCT_TEXT_LIMITS.description],
  ] as const;

  for (const [label, value, limit] of lengthChecks) {
    if (value !== null && value.length > limit) {
      return {
        ok: false,
        error: `${label} must be ${limit} characters or fewer.`,
      };
    }
  }

  const priceText = normalizeText(input.price);

  if (!priceText) {
    return { ok: false, error: "Enter a Sombre price." };
  }

  const price = parseProductPrice(priceText, "Sombre price");

  if (!price.ok) {
    return price;
  }

  // Optional: an empty field is a product with no published retail price, which
  // the nullable column stores as null rather than as a guessed figure.
  const retailPriceText = normalizeText(input.retailPrice);
  let retailPrice: string | null = null;

  if (retailPriceText !== "") {
    const parsed = parseProductPrice(retailPriceText, "Retail price");

    if (!parsed.ok) {
      return parsed;
    }

    retailPrice = parsed.value;
  }

  const stockText = normalizeText(input.stockQuantity);

  // An empty field means the column's own default of nothing in stock, which is
  // a legitimate state: a product can be added before its stock arrives.
  if (stockText !== "" && !STOCK_PATTERN.test(stockText)) {
    return {
      ok: false,
      error: "Stock quantity must be a whole number of 0 or more.",
    };
  }

  const stockQuantity =
    stockText === "" ? 0 : normalizeStockQuantity(stockText);

  // normalizeStockQuantity answers what an untrusted value means and collapses
  // anything it cannot trust to 0. The pattern above already refused the
  // ordinary mistakes, so a 0 here from a non-zero entry means the figure is
  // beyond safe integer range, and it is refused rather than quietly saved as
  // no stock at all.
  if (stockQuantity === 0 && stockText !== "" && Number(stockText) !== 0) {
    return { ok: false, error: "Stock quantity is too large." };
  }

  return {
    ok: true,
    value: {
      name,
      slug,
      brand_id: brandId,
      category_id: categoryId,
      size_label: sizeLabel,
      short_description: shortDescription,
      description,
      price: price.value,
      retail_price: retailPrice,
      stock_quantity: stockQuantity,
      is_active: input.isActive === true,
    },
  };
}

/**
 * Narrows a validated submission to the columns an edit may write.
 *
 * Written out field by field rather than spread from the insert shape, so the
 * set of editable columns is stated here and adding a column to the insert can
 * never silently make it editable. `stock_quantity` is what this is protecting.
 */
function toProductUpdate(
  value: ValidatedProductInsert,
): ValidatedProductUpdate {
  return {
    name: value.name,
    slug: value.slug,
    brand_id: value.brand_id,
    category_id: value.category_id,
    size_label: value.size_label,
    short_description: value.short_description,
    description: value.description,
    price: value.price,
    retail_price: value.retail_price,
    is_active: value.is_active,
  };
}

/**
 * Validates an edit of an existing product.
 *
 * Every rule a create is held to applies unchanged; the one difference is the
 * slug. A create may leave the field empty and take the suggestion derived from
 * the name, but an existing product's slug is a live URL that the sitemap and
 * every shared link already point at, so an omitted slug is refused here rather
 * than quietly moving the product to a new address.
 */
export function validateAdminProductUpdate(
  input: AdminProductSubmission,
): ProductUpdateValidationResult {
  if (normalizeText(input.slug) === "") {
    return { ok: false, error: "Enter a product slug." };
  }

  const validated = validateAdminProductSubmission(input);

  if (!validated.ok) {
    return validated;
  }

  return { ok: true, value: toProductUpdate(validated.value) };
}

/**
 * The decimal string a price input should start with.
 *
 * PostgREST returns numeric columns as strings to avoid float rounding, but a
 * number is accepted too so this does not depend on that. Anything unreadable
 * becomes "", which shows an empty field rather than NaN.
 */
export function formatProductPriceInput(value: unknown): string {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value.toFixed(2) : "";
  }

  const text = normalizeText(value);

  if (text === "") {
    return "";
  }

  try {
    return formatHkdCentsForDatabase(parseHkdDecimalToCents(text));
  } catch {
    return "";
  }
}
