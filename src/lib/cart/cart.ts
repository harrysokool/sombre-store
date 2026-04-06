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

export function addItemToCart(item: Omit<CartItem, "quantity">) {
  const currentItems = getCartItems();
  const existingItem = currentItems.find(
    (currentItem) => currentItem.id === item.id,
  );

  if (existingItem) {
    const updatedItems = currentItems.map((currentItem) =>
      currentItem.id === item.id
        ? { ...currentItem, quantity: currentItem.quantity + 1 }
        : currentItem,
    );

    saveCartItems(updatedItems);
    return updatedItems;
  }

  const updatedItems = [...currentItems, { ...item, quantity: 1 }];
  saveCartItems(updatedItems);

  return updatedItems;
}
