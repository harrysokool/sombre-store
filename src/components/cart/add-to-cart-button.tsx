"use client";

import { useEffect, useState } from "react";

import { addItemToCart } from "@/lib/cart/cart";

type AddToCartButtonProps = {
  product: {
    id: string;
    slug: string;
    name: string;
    price: number | string;
    size_label: string | null;
    image_url: string | null;
  };
};

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const [didAddToCart, setDidAddToCart] = useState(false);

  useEffect(() => {
    if (!didAddToCart) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDidAddToCart(false);
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [didAddToCart]);

  function handleAddToCart() {
    addItemToCart(product);
    setDidAddToCart(true);
  }

  return (
    <button
      type="button"
      onClick={handleAddToCart}
      className="rounded-full border border-white/10 px-6 py-3 text-sm uppercase tracking-[0.22em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/5"
    >
      {didAddToCart ? "Added" : "Add to Cart"}
    </button>
  );
}
