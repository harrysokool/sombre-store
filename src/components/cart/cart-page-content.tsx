"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import {
  decrementCartItemQuantity,
  getCartItemCount,
  getCartItems,
  incrementCartItemQuantity,
  removeCartItem,
  type CartItem,
} from "@/lib/cart/cart";
import { getCartLineTotal, getCartSubtotal } from "@/lib/cart/math";
import { formatPrice } from "@/lib/storefront/format-price";

export function CartPageContent() {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => getCartItems());

  const subtotal = getCartSubtotal(cartItems);
  const itemCount = getCartItemCount(cartItems);

  function handleIncrement(itemId: string) {
    setCartItems(incrementCartItemQuantity(itemId));
  }

  function handleDecrement(itemId: string) {
    setCartItems(decrementCartItemQuantity(itemId));
  }

  function handleRemove(itemId: string) {
    setCartItems(removeCartItem(itemId));
  }

  return (
    <section className="px-6 py-24 sm:px-10 sm:py-32 lg:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-14">
        <div className="max-w-2xl space-y-5">
          <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
            Sombre
          </p>
          <div className="space-y-4">
            <h1 className="text-4xl font-medium tracking-[0.16em] text-stone-100 sm:text-6xl">
              Cart
            </h1>
            <p className="text-base leading-8 text-stone-400">
              A quiet review of the items currently saved in your cart.
            </p>
          </div>
        </div>

        {cartItems.length > 0 ? (
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-5 rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:grid-cols-[160px_1fr] sm:p-6"
                >
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-stone-900/80">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={`${item.name} cart image`}
                        width={640}
                        height={800}
                        className="aspect-[4/5] w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[4/5] items-center justify-center bg-white/[0.02]">
                        <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                          No image
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col justify-between gap-6">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <Link
                          href={`/products/${item.slug}`}
                          className="text-2xl font-medium tracking-[0.08em] text-stone-100"
                        >
                          {item.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleRemove(item.id)}
                          className="text-xs uppercase tracking-[0.22em] text-stone-500 transition-colors hover:text-stone-200"
                        >
                          Remove
                        </button>
                      </div>
                      {item.size_label ? (
                        <p className="text-sm uppercase tracking-[0.18em] text-stone-500">
                          {item.size_label}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-4">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                          Unit price
                        </p>
                        <p className="text-base text-stone-300">
                          {formatPrice(item.price)}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                          Quantity
                        </p>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleDecrement(item.id)}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-stone-200 transition-colors hover:border-white/20 hover:text-stone-100"
                            aria-label={`Decrease quantity for ${item.name}`}
                          >
                            -
                          </button>
                          <p className="min-w-6 text-center text-base text-stone-300">
                            {item.quantity}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleIncrement(item.id)}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-stone-200 transition-colors hover:border-white/20 hover:text-stone-100"
                            aria-label={`Increase quantity for ${item.name}`}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1 text-right">
                        <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                          Line total
                        </p>
                        <p className="text-lg font-medium text-stone-100">
                          {formatPrice(
                            getCartLineTotal(item.price, item.quantity),
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="h-fit rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 sm:p-8">
              <div className="space-y-8">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                    Summary
                  </p>
                  <h2 className="text-2xl font-medium text-stone-100">
                    Ready for checkout
                  </h2>
                </div>

                <div className="space-y-4 border-t border-white/10 pt-6">
                  <div className="flex items-end justify-between gap-4">
                    <p className="text-sm uppercase tracking-[0.18em] text-stone-400">
                      Items
                    </p>
                    <p className="text-base text-stone-300">{itemCount}</p>
                  </div>

                  <div className="flex items-end justify-between gap-4">
                    <p className="text-sm uppercase tracking-[0.18em] text-stone-400">
                      Subtotal
                    </p>
                    <p className="text-2xl font-medium text-stone-100">
                      {formatPrice(subtotal)}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <Link
                    href="/checkout"
                    className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm uppercase tracking-[0.22em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10"
                  >
                    Proceed to Checkout
                  </Link>

                  <Link
                    href="/shop"
                    className="inline-flex w-full items-center justify-center text-sm uppercase tracking-[0.22em] text-stone-400 transition-colors hover:text-stone-100"
                  >
                    Continue Shopping
                  </Link>

                  <p className="text-center text-xs leading-6 text-stone-500">
                    Taxes and shipping calculated at checkout.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <h2 className="text-2xl font-medium text-stone-100">
              Your cart is empty
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-stone-400">
              Add a product from the catalog and it will appear here
              automatically.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
