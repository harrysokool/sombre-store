export const CART_STORAGE_KEY = "sombre-cart";

export type CartItem = {
  id: string;
  slug: string;
  name: string;
  price: number | string;
  size_label: string | null;
  image_url: string | null;
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
    (typeof item.price === "number" || typeof item.price === "string") &&
    (typeof item.size_label === "string" || item.size_label === null) &&
    (typeof item.image_url === "string" || item.image_url === null) &&
    typeof item.quantity === "number"
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

function saveCartItems(items: CartItem[]) {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

function updateCartItems(updater: (items: CartItem[]) => CartItem[]) {
  const updatedItems = updater(getCartItems());
  saveCartItems(updatedItems);

  return updatedItems;
}

export function addItemToCart(item: Omit<CartItem, "quantity">) {
  return updateCartItems((currentItems) => {
    const existingItem = currentItems.find(
      (currentItem) => currentItem.id === item.id,
    );

    if (existingItem) {
      return currentItems.map((currentItem) =>
        currentItem.id === item.id
          ? { ...currentItem, quantity: currentItem.quantity + 1 }
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
        ? { ...currentItem, quantity: currentItem.quantity + 1 }
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
