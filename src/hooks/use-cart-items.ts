"use client";

import { useEffect, useState } from "react";

import {
  CART_UPDATED_EVENT,
  getCartItems,
  type CartItem,
} from "@/lib/cart/cart";

export function useCartItems() {
  const [cartItems, setCartItems] = useState<CartItem[] | null>(null);

  useEffect(() => {
    function syncCartItems() {
      setCartItems(getCartItems());
    }

    syncCartItems();

    window.addEventListener(CART_UPDATED_EVENT, syncCartItems);
    window.addEventListener("storage", syncCartItems);

    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, syncCartItems);
      window.removeEventListener("storage", syncCartItems);
    };
  }, []);

  return {
    cartItems,
    setCartItems,
  };
}
