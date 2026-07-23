"use client";

import Link from "next/link";

import { CartLineItem } from "@/components/cart/cart-line-item";
import { CartOrderSummary } from "@/components/cart/cart-order-summary";
import { useCartItems } from "@/hooks/use-cart-items";
import {
  decrementCartItemQuantity,
  getCartItemCount,
  incrementCartItemQuantity,
  removeCartItem,
} from "@/lib/cart/cart";
import { getCartSubtotal } from "@/lib/cart/math";
import { getCheckoutTotal, SHIPPING_FEE_HKD } from "@/lib/checkout/shipping";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950";

export function CartPageContent() {
  const { cartItems, setCartItems } = useCartItems();

  const resolvedCartItems = cartItems ?? [];
  const subtotal = getCartSubtotal(resolvedCartItems);
  const itemCount = getCartItemCount(resolvedCartItems);
  // Same source of truth as checkout: a flat fee plus subtotal. Nothing here is
  // computed differently from what the checkout session will charge.
  const total = getCheckoutTotal(subtotal);

  function handleIncrement(itemId: string) {
    setCartItems(incrementCartItemQuantity(itemId));
  }

  function handleDecrement(itemId: string) {
    setCartItems(decrementCartItemQuantity(itemId));
  }

  function handleRemove(itemId: string) {
    setCartItems(removeCartItem(itemId));
  }

  const hasItems = resolvedCartItems.length > 0;

  return (
    <section className="px-6 py-20 sm:px-10 sm:py-28 lg:px-12">
      <div
        className="mx-auto w-full max-w-7xl"
        aria-busy={cartItems === null || undefined}
      >
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-8">
          <div className="space-y-3">
            <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-500 sm:text-xs">
              Sombre
            </p>
            <h1 className="font-display text-4xl font-light leading-none text-stone-100 sm:text-6xl">
              Cart
            </h1>
          </div>
          {cartItems !== null && hasItems ? (
            <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </p>
          ) : null}
        </header>

        {cartItems === null ? (
          <p
            role="status"
            aria-live="polite"
            className="py-24 text-center text-sm text-stone-500"
          >
            Loading your cart&hellip;
          </p>
        ) : hasItems ? (
          // items-start keeps the summary from stretching to the full row
          // height, which would leave its sticky positioning no room to move.
          <div className="mt-12 grid gap-12 lg:grid-cols-[1.6fr_1fr] lg:items-start lg:gap-16">
            <div>
              {resolvedCartItems.map((item) => (
                <CartLineItem
                  key={item.id}
                  item={item}
                  onIncrement={handleIncrement}
                  onDecrement={handleDecrement}
                  onRemove={handleRemove}
                />
              ))}
            </div>

            <CartOrderSummary
              itemCount={itemCount}
              subtotal={subtotal}
              shippingFee={SHIPPING_FEE_HKD}
              total={total}
            />
          </div>
        ) : (
          <div className="mx-auto mt-24 max-w-lg text-center sm:mt-32">
            <h2 className="font-display text-3xl font-light text-stone-200 sm:text-4xl">
              Your cart is empty
            </h2>
            <p className="mt-5 text-sm leading-8 text-stone-500">
              Nothing has been added yet. Browse the collection and your
              selections will gather here.
            </p>
            <Link
              href="/shop"
              className={`mt-10 inline-block border-b border-stone-600 pb-1 text-xs uppercase tracking-[0.28em] text-stone-200 transition-colors hover:border-stone-300 hover:text-white ${focusRing}`}
            >
              Explore the shop
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
