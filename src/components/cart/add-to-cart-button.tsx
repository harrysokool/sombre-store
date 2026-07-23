"use client";

import { useEffect, useState } from "react";

import {
  addItemToCart,
  CART_UPDATED_EVENT,
  getCartItemQuantityLimit,
  getCartItems,
} from "@/lib/cart/cart";

type AddToCartButtonProps = {
  product: {
    id: string;
    slug: string;
    name: string;
    price: number | string;
    size_label: string | null;
    image_url: string | null;
    stock_quantity: number;
  };
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950";

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const isSoldOut = product.stock_quantity <= 0;
  // min(10, stock): the ceiling for this line, independent of what is held.
  const lineLimit = getCartItemQuantityLimit({
    stock_quantity: product.stock_quantity,
  });

  const [quantityInCart, setQuantityInCart] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [didAddToCart, setDidAddToCart] = useState(false);

  // Track how many of this product are already in the cart so the stepper only
  // ever offers what can still be added. Mirrors the subscription in
  // useCartItems, so a change from any surface keeps this in sync.
  useEffect(() => {
    function syncFromCart() {
      const line = getCartItems().find((item) => item.id === product.id);
      setQuantityInCart(line?.quantity ?? 0);
    }

    syncFromCart();

    window.addEventListener(CART_UPDATED_EVENT, syncFromCart);
    window.addEventListener("storage", syncFromCart);

    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, syncFromCart);
      window.removeEventListener("storage", syncFromCart);
    };
  }, [product.id]);

  useEffect(() => {
    if (!didAddToCart) {
      return;
    }

    const timeoutId = window.setTimeout(() => setDidAddToCart(false), 1800);

    return () => window.clearTimeout(timeoutId);
  }, [didAddToCart]);

  const remaining = Math.max(0, lineLimit - quantityInCart);
  const atMaxInCart = !isSoldOut && remaining === 0;
  const canAdd = !isSoldOut && remaining > 0;

  // Derived rather than stored, so the shown amount is always valid even if the
  // cart changed underneath a stale stepper value.
  const displayedQuantity = Math.min(
    Math.max(1, quantity),
    Math.max(1, remaining),
  );

  function decreaseQuantity() {
    setQuantity(Math.max(1, displayedQuantity - 1));
  }

  function increaseQuantity() {
    setQuantity(Math.min(remaining, displayedQuantity + 1));
  }

  function handleAddToCart() {
    if (!canAdd) {
      return;
    }

    addItemToCart(
      { ...product, price: Number(product.price) },
      displayedQuantity,
    );
    // The cart event refreshes quantityInCart; reset the stepper for the next add.
    setQuantity(1);
    setDidAddToCart(true);
  }

  const buttonLabel = isSoldOut
    ? "Sold out"
    : didAddToCart
      ? "Added"
      : "Add to Cart";

  return (
    <div className="space-y-5">
      {canAdd ? (
        <div className="flex items-center justify-between gap-6">
          <p
            id="quantity-label"
            className="text-xs uppercase tracking-[0.24em] text-stone-500"
          >
            Quantity
          </p>
          <div
            role="group"
            aria-labelledby="quantity-label"
            className="flex items-center gap-4"
          >
            <button
              type="button"
              onClick={decreaseQuantity}
              disabled={displayedQuantity <= 1}
              aria-label="Decrease quantity"
              className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-lg text-stone-200 transition-colors hover:border-white/25 hover:text-stone-100 disabled:cursor-not-allowed disabled:opacity-30 ${focusRing}`}
            >
              &minus;
            </button>
            <span
              aria-live="polite"
              className="min-w-8 text-center text-base tabular-nums text-stone-100"
            >
              {displayedQuantity}
            </span>
            <button
              type="button"
              onClick={increaseQuantity}
              disabled={displayedQuantity >= remaining}
              aria-label="Increase quantity"
              className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-lg text-stone-200 transition-colors hover:border-white/25 hover:text-stone-100 disabled:cursor-not-allowed disabled:opacity-30 ${focusRing}`}
            >
              +
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleAddToCart}
        disabled={!canAdd}
        aria-describedby={atMaxInCart ? "cart-limit-note" : undefined}
        className={`w-full rounded-full bg-stone-100 px-6 py-4 text-xs uppercase tracking-[0.28em] text-stone-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-stone-500 ${focusRing}`}
      >
        {buttonLabel}
      </button>

      {atMaxInCart ? (
        <p id="cart-limit-note" className="text-center text-xs text-stone-500">
          Maximum quantity already in cart.
        </p>
      ) : null}
    </div>
  );
}
