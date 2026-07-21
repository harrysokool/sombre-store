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
    stock_quantity: number;
  };
};

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const [didAddToCart, setDidAddToCart] = useState(false);
  const isSoldOut = product.stock_quantity <= 0;

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
    if (isSoldOut) {
      return;
    }

    addItemToCart({
      ...product,
      price: Number(product.price),
    });
    setDidAddToCart(true);
  }

  return (
    <button
      type="button"
      onClick={handleAddToCart}
      disabled={isSoldOut}
      className="rounded-full border border-white/10 px-6 py-3 text-sm uppercase tracking-[0.22em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/5 disabled:cursor-not-allowed disabled:text-stone-500 disabled:hover:border-white/10 disabled:hover:bg-transparent"
    >
      {isSoldOut ? "Sold out" : didAddToCart ? "Added" : "Add to Cart"}
    </button>
  );
}
