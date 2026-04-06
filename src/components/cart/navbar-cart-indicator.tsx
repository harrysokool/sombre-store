"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  CART_STORAGE_KEY,
  CART_UPDATED_EVENT,
  getCartItemCount,
} from "@/lib/cart/cart";

function CartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d="M3.75 4.5h1.386c.51 0 .955.347 1.08.841l.355 1.409m0 0 1.02 4.044a1.125 1.125 0 0 0 1.09.849h7.819a1.125 1.125 0 0 0 1.09-.85l1.195-4.778H6.57Zm2.18 11.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm9 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NavbarCartIndicator() {
  const [itemCount, setItemCount] = useState(0);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    function refreshCount() {
      setItemCount(getCartItemCount());
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === CART_STORAGE_KEY) {
        refreshCount();
      }
    }

    const timeoutId = window.setTimeout(() => {
      setHasMounted(true);
      refreshCount();
    }, 0);

    window.addEventListener(CART_UPDATED_EVENT, refreshCount);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener(CART_UPDATED_EVENT, refreshCount);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return (
    <Link
      href="/cart"
      aria-label={
        hasMounted && itemCount > 0 ? `Cart with ${itemCount} items` : "Cart"
      }
      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-stone-200 transition-colors hover:border-white/20 hover:text-stone-100"
    >
      <CartIcon />
      {hasMounted && itemCount > 0 ? (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-stone-100 px-1.5 py-0.5 text-center text-[10px] font-medium text-stone-950">
          {itemCount}
        </span>
      ) : null}
    </Link>
  );
}
