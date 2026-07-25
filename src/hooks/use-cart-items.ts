"use client";

import { useEffect, useState } from "react";

import {
  CART_UPDATED_EVENT,
  getCartItems,
  isCartStorageChange,
  type CartItem,
} from "@/lib/cart/cart";

export function useCartItems() {
  const [cartItems, setCartItems] = useState<CartItem[] | null>(null);

  useEffect(() => {
    function syncCartItems() {
      setCartItems(getCartItems());
    }

    // Cross-tab events are filtered by key rather than resyncing on every
    // unrelated write. Both the check and the read are guarded, so event data
    // from another tab can never throw in here.
    function handleStorage(event: StorageEvent) {
      if (isCartStorageChange(event)) {
        syncCartItems();
      }
    }

    syncCartItems();

    window.addEventListener(CART_UPDATED_EVENT, syncCartItems);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, syncCartItems);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return {
    cartItems,
    setCartItems,
  };
}
