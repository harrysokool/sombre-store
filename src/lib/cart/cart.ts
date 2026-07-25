import { MAX_CART_ITEM_QUANTITY } from "./limits";
import {
  readStoredJson,
  removeStoredValue,
  writeStoredJson,
} from "./storage";

export { MAX_CART_ITEM_QUANTITY } from "./limits";

export const CART_STORAGE_KEY = "sombre-cart";
export const CART_UPDATED_EVENT = "sombre-cart-updated";
const CHECKOUT_SNAPSHOT_KEY_PREFIX = "sombre-checkout-session";

export type CartItem = {
  id: string;
  slug: string;
  name: string;
  price: number;
  size_label: string | null;
  image_url: string | null;
  stock_quantity?: number;
  quantity: number;
};

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    typeof item.slug === "string" &&
    typeof item.name === "string" &&
    typeof item.price === "number" &&
    (typeof item.size_label === "string" || item.size_label === null) &&
    (typeof item.image_url === "string" || item.image_url === null) &&
    (item.stock_quantity === undefined ||
      (typeof item.stock_quantity === "number" &&
        Number.isInteger(item.stock_quantity) &&
        item.stock_quantity >= 0)) &&
    typeof item.quantity === "number" &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0 &&
    item.quantity <= MAX_CART_ITEM_QUANTITY
  );
}

export function getCartItemQuantityLimit(
  item: Pick<CartItem, "stock_quantity">,
) {
  return Math.min(
    MAX_CART_ITEM_QUANTITY,
    item.stock_quantity ?? MAX_CART_ITEM_QUANTITY,
  );
}

/**
 * Rejects anything that is not an array outright, so a stored object, string,
 * or number can never be mistaken for a cart. Within a real array, individual
 * items that fail validation are dropped rather than condemning the whole
 * cart — one corrupt line should not lose the rest.
 */
function parseCartItems(value: unknown): CartItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter(isCartItem);
}

/**
 * The cart as it is actually persisted.
 *
 * Every failure — storage blocked, quota exhausted, malformed JSON, a value
 * that is not an array — resolves to an empty cart. That is deliberately the
 * same answer as "no cart yet": it is the only state that cannot mislead the
 * customer or the server, and it keeps every surface that calls this rendering
 * instead of throwing.
 */
export function getCartItems(): CartItem[] {
  const stored = readStoredJson(CART_STORAGE_KEY, parseCartItems);

  return stored.status === "ok" ? stored.value : [];
}

export function getCartItemCount(items: CartItem[] = getCartItems()) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

/**
 * Whether a `storage` event should make cart surfaces re-read.
 *
 * Takes `unknown` because listeners are shared with in-page CustomEvents and
 * because event data arriving from another tab is not worth trusting. An event
 * whose shape is unrecognised falls through to re-reading: the read is guarded
 * and cheap, so a needless resync is always safer than missing a real change.
 */
export function isCartStorageChange(event: unknown) {
  if (!event || typeof event !== "object" || !("key" in event)) {
    return true;
  }

  const { key } = event as { key: unknown };

  // A null key is the browser reporting that the whole area was cleared, which
  // does affect the cart.
  return key === null || key === CART_STORAGE_KEY;
}

/**
 * Persists the cart and tells every surface to re-read.
 *
 * The event is dispatched even when the write failed, and that is the point:
 * listeners re-read from storage, so the UI settles on what is actually saved
 * rather than on an optimistic value that would silently vanish at checkout.
 */
function saveCartItems(items: CartItem[]) {
  const persisted = writeStoredJson(CART_STORAGE_KEY, items);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
  }

  return persisted;
}

function getCheckoutSnapshotStorageKey(sessionId: string) {
  return `${CHECKOUT_SNAPSHOT_KEY_PREFIX}:${sessionId}`;
}

function updateCartItems(updater: (items: CartItem[]) => CartItem[]) {
  const updatedItems = updater(getCartItems());
  saveCartItems(updatedItems);

  return updatedItems;
}

export function addItemToCart(
  item: Omit<CartItem, "quantity">,
  quantity = 1,
) {
  return updateCartItems((currentItems) => {
    const quantityLimit = getCartItemQuantityLimit(item);

    if (quantityLimit < 1) {
      return currentItems;
    }

    // Only a whole, positive count adds anything. A malformed argument falls
    // back to a single unit, so it can never corrupt the line. The default of 1
    // keeps every existing caller identical to before.
    const requestedQuantity =
      Number.isInteger(quantity) && quantity > 0 ? quantity : 1;

    const existingItem = currentItems.find(
      (currentItem) => currentItem.id === item.id,
    );

    if (existingItem) {
      // Grow toward the limit, never past it, and never below what is already
      // held — a line that predates a stock drop is left untouched, matching the
      // previous single-unit behaviour exactly.
      const nextQuantity = Math.max(
        existingItem.quantity,
        Math.min(existingItem.quantity + requestedQuantity, quantityLimit),
      );

      return currentItems.map((currentItem) =>
        currentItem.id === item.id
          ? { ...currentItem, ...item, quantity: nextQuantity }
          : currentItem,
      );
    }

    return [
      ...currentItems,
      { ...item, quantity: Math.min(requestedQuantity, quantityLimit) },
    ];
  });
}

export function incrementCartItemQuantity(itemId: string) {
  return updateCartItems((currentItems) =>
    currentItems.map((currentItem) =>
      currentItem.id === itemId
        ? {
            ...currentItem,
            quantity:
              currentItem.quantity < getCartItemQuantityLimit(currentItem)
                ? currentItem.quantity + 1
                : currentItem.quantity,
          }
        : currentItem,
    ),
  );
}

export function decrementCartItemQuantity(itemId: string) {
  return updateCartItems((currentItems) =>
    currentItems.flatMap((currentItem) => {
      if (currentItem.id !== itemId) {
        return [currentItem];
      }

      if (currentItem.quantity <= 1) {
        return [];
      }

      return [{ ...currentItem, quantity: currentItem.quantity - 1 }];
    }),
  );
}

export function removeCartItem(itemId: string) {
  return updateCartItems((currentItems) =>
    currentItems.filter((currentItem) => currentItem.id !== itemId),
  );
}

export function clearCartItems() {
  return updateCartItems(() => []);
}

/**
 * Records which quantities were sent to a Stripe Checkout Session, so the cart
 * can later be reduced by exactly that much and nothing more.
 *
 * Returns whether the snapshot persisted. It never throws, because the caller
 * runs this immediately after a Stripe Session has been created: at that point
 * a thrown error would be indistinguishable from "checkout failed" and would
 * push the customer into paying twice. A lost snapshot only costs the cart
 * cleanup below, which is recoverable; a duplicate Session is not.
 */
export function saveCheckoutCartSnapshot(sessionId: string, items: CartItem[]) {
  return writeStoredJson(getCheckoutSnapshotStorageKey(sessionId), items);
}

/**
 * Subtracts a confirmed Session's quantities from the cart.
 *
 * Only ever called for an order the server has already verified as confirmed —
 * the success URL alone is never treated as proof. Even then, the snapshot is
 * what proves *which* quantities belonged to that Session.
 *
 * Without a usable snapshot there is no such proof, so the cart is returned
 * untouched. Leaving a few already-purchased items behind is a visible,
 * correctable annoyance; clearing items the customer never bought is silent
 * data loss, so the ambiguity always resolves toward keeping the cart.
 */
export function reconcileCartWithCheckoutSession(sessionId: string) {
  const snapshotKey = getCheckoutSnapshotStorageKey(sessionId);
  const stored = readStoredJson(snapshotKey, parseCartItems);

  // empty, invalid, or unavailable all mean the same thing here: the purchased
  // quantities cannot be proven, so nothing is removed. `readStoredJson` has
  // already cleared an invalid value.
  if (stored.status !== "ok") {
    return getCartItems();
  }

  const checkoutQuantities = new Map(
    stored.value.map((item) => [item.id, item.quantity]),
  );

  const reconciledItems = updateCartItems((currentItems) =>
    currentItems.flatMap((currentItem) => {
      const purchasedQuantity = checkoutQuantities.get(currentItem.id);

      if (!purchasedQuantity) {
        return [currentItem];
      }

      if (currentItem.quantity <= purchasedQuantity) {
        return [];
      }

      return [
        {
          ...currentItem,
          quantity: currentItem.quantity - purchasedQuantity,
        },
      ];
    }),
  );

  removeStoredValue(snapshotKey);

  return reconciledItems;
}
