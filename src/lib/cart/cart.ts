export const CART_STORAGE_KEY = "sombre-cart";
export const CART_UPDATED_EVENT = "sombre-cart-updated";
export const MAX_CART_ITEM_QUANTITY = 10;
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

export function getCartItems(): CartItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  const rawCart = window.localStorage.getItem(CART_STORAGE_KEY);

  if (!rawCart) {
    return [];
  }

  try {
    const parsedCart = JSON.parse(rawCart);

    if (!Array.isArray(parsedCart)) {
      return [];
    }

    return parsedCart.filter(isCartItem);
  } catch {
    return [];
  }
}

export function getCartItemCount(items: CartItem[] = getCartItems()) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

function saveCartItems(items: CartItem[]) {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
}

function getCheckoutSnapshotStorageKey(sessionId: string) {
  return `${CHECKOUT_SNAPSHOT_KEY_PREFIX}:${sessionId}`;
}

function updateCartItems(updater: (items: CartItem[]) => CartItem[]) {
  const updatedItems = updater(getCartItems());
  saveCartItems(updatedItems);

  return updatedItems;
}

export function addItemToCart(item: Omit<CartItem, "quantity">) {
  return updateCartItems((currentItems) => {
    const quantityLimit = getCartItemQuantityLimit(item);

    if (quantityLimit < 1) {
      return currentItems;
    }

    const existingItem = currentItems.find(
      (currentItem) => currentItem.id === item.id,
    );

    if (existingItem) {
      return currentItems.map((currentItem) =>
        currentItem.id === item.id
          ? {
              ...currentItem,
              ...item,
              quantity:
                currentItem.quantity < quantityLimit
                  ? currentItem.quantity + 1
                  : currentItem.quantity,
            }
          : currentItem,
      );
    }

    return [...currentItems, { ...item, quantity: 1 }];
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

export function saveCheckoutCartSnapshot(sessionId: string, items: CartItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getCheckoutSnapshotStorageKey(sessionId),
    JSON.stringify(items),
  );
}

export function reconcileCartWithCheckoutSession(sessionId: string) {
  if (typeof window === "undefined") {
    return getCartItems();
  }

  const snapshot = window.localStorage.getItem(
    getCheckoutSnapshotStorageKey(sessionId),
  );

  if (!snapshot) {
    return getCartItems();
  }

  try {
    const parsedSnapshot = JSON.parse(snapshot);

    if (!Array.isArray(parsedSnapshot)) {
      window.localStorage.removeItem(getCheckoutSnapshotStorageKey(sessionId));
      return getCartItems();
    }

    const checkoutItems = parsedSnapshot.filter(isCartItem);

    const reconciledItems = updateCartItems((currentItems) => {
      const checkoutQuantities = new Map(
        checkoutItems.map((item) => [item.id, item.quantity]),
      );

      return currentItems.flatMap((currentItem) => {
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
      });
    });

    window.localStorage.removeItem(getCheckoutSnapshotStorageKey(sessionId));

    return reconciledItems;
  } catch {
    window.localStorage.removeItem(getCheckoutSnapshotStorageKey(sessionId));
    return getCartItems();
  }
}
