import type { CartItem } from "@/lib/cart/cart";

export function getCartLineTotal(price: number, quantity: number) {
  return price * quantity;
}

export function getCartSubtotal(items: CartItem[]) {
  return items.reduce(
    (total, item) => total + getCartLineTotal(item.price, item.quantity),
    0,
  );
}
