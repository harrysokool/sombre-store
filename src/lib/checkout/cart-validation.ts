import { MAX_CART_ITEM_QUANTITY } from "../cart/limits";

export const MAX_CHECKOUT_BODY_BYTES = 16 * 1024;
export const MAX_CART_LINE_ITEMS = 100;
export const MAX_PRODUCT_SLUG_LENGTH = 200;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CheckoutCartReference = {
  id: string;
  slug: string;
  quantity: number;
};

export function getCartItemReferenceError(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return "One or more cart items are invalid.";
  }

  const item = value as Record<string, unknown>;
  const quantity = item.quantity;

  if (typeof item.id !== "string" || !UUID_PATTERN.test(item.id.trim())) {
    return "One or more cart items reference an unknown product.";
  }

  if (
    typeof item.slug !== "string" ||
    item.slug.trim().length === 0 ||
    item.slug.trim().length > MAX_PRODUCT_SLUG_LENGTH
  ) {
    return "One or more cart items reference an unknown product.";
  }

  if (
    typeof quantity !== "number" ||
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    return "Cart quantities must be whole numbers of at least 1.";
  }

  if (quantity > MAX_CART_ITEM_QUANTITY) {
    return `You can order at most ${MAX_CART_ITEM_QUANTITY} of each product.`;
  }

  return null;
}

export function isCheckoutCartReference(
  value: unknown,
): value is CheckoutCartReference {
  return getCartItemReferenceError(value) === null;
}

export function hasDuplicateCartProductIds(
  items: readonly Pick<CheckoutCartReference, "id">[],
) {
  const productIds = items.map((item) => item.id);
  return new Set(productIds).size !== productIds.length;
}
