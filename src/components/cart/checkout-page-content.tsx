"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { getCartItemCount, getCartItems, type CartItem } from "@/lib/cart/cart";
import { getCartLineTotal, getCartSubtotal } from "@/lib/cart/math";
import { formatPrice } from "@/lib/storefront/format-price";

export function CheckoutPageContent() {
  const [cartItems] = useState<CartItem[]>(() => getCartItems());

  const itemCount = getCartItemCount(cartItems);
  const subtotal = getCartSubtotal(cartItems);

  return (
    <section className="px-6 py-24 sm:px-10 sm:py-32 lg:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-14">
        <div className="max-w-2xl space-y-5">
          <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
            Sombre
          </p>
          <div className="space-y-4">
            <h1 className="text-4xl font-medium tracking-[0.16em] text-stone-100 sm:text-6xl">
              Checkout
            </h1>
            <p className="text-base leading-8 text-stone-400">
              A final review before payment and order confirmation are added.
            </p>
          </div>
        </div>

        {cartItems.length > 0 ? (
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6 rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 sm:p-8">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                  Customer Information
                </p>
                <h2 className="text-2xl font-medium text-stone-100">
                  Delivery details
                </h2>
              </div>

              <form className="grid gap-5 sm:grid-cols-2">
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-xs uppercase tracking-[0.24em] text-stone-500">
                    Full name
                  </span>
                  <input
                    type="text"
                    name="fullName"
                    className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-stone-100 outline-none transition-colors placeholder:text-stone-600 focus:border-white/20"
                    placeholder="Your full name"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.24em] text-stone-500">
                    Email
                  </span>
                  <input
                    type="email"
                    name="email"
                    className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-stone-100 outline-none transition-colors placeholder:text-stone-600 focus:border-white/20"
                    placeholder="you@example.com"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.24em] text-stone-500">
                    Phone
                  </span>
                  <input
                    type="tel"
                    name="phone"
                    className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-stone-100 outline-none transition-colors placeholder:text-stone-600 focus:border-white/20"
                    placeholder="Optional"
                  />
                </label>

                <label className="space-y-2 sm:col-span-2">
                  <span className="text-xs uppercase tracking-[0.24em] text-stone-500">
                    Address line 1
                  </span>
                  <input
                    type="text"
                    name="addressLine1"
                    className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-stone-100 outline-none transition-colors placeholder:text-stone-600 focus:border-white/20"
                    placeholder="Street address"
                  />
                </label>

                <label className="space-y-2 sm:col-span-2">
                  <span className="text-xs uppercase tracking-[0.24em] text-stone-500">
                    Address line 2
                  </span>
                  <input
                    type="text"
                    name="addressLine2"
                    className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-stone-100 outline-none transition-colors placeholder:text-stone-600 focus:border-white/20"
                    placeholder="Apartment, suite, or floor"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.24em] text-stone-500">
                    City
                  </span>
                  <input
                    type="text"
                    name="city"
                    className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-stone-100 outline-none transition-colors placeholder:text-stone-600 focus:border-white/20"
                    placeholder="City"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.24em] text-stone-500">
                    Postal code
                  </span>
                  <input
                    type="text"
                    name="postalCode"
                    className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-stone-100 outline-none transition-colors placeholder:text-stone-600 focus:border-white/20"
                    placeholder="Postal code"
                  />
                </label>

                <label className="space-y-2 sm:col-span-2">
                  <span className="text-xs uppercase tracking-[0.24em] text-stone-500">
                    Country
                  </span>
                  <input
                    type="text"
                    name="country"
                    className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-stone-100 outline-none transition-colors placeholder:text-stone-600 focus:border-white/20"
                    placeholder="Country"
                  />
                </label>
              </form>
            </div>

            <div className="space-y-6">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 sm:p-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                      Order Summary
                    </p>
                    <h2 className="text-2xl font-medium text-stone-100">
                      Final review
                    </h2>
                  </div>

                  <div className="space-y-4 border-t border-white/10 pt-6">
                    {cartItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 border-b border-white/5 pb-4 last:border-b-0 last:pb-0"
                      >
                        <div className="overflow-hidden rounded-2xl bg-white/[0.02]">
                          {item.image_url ? (
                            <Image
                              src={item.image_url}
                              alt={`${item.name} checkout image`}
                              width={120}
                              height={150}
                              className="h-20 w-16 object-cover"
                            />
                          ) : (
                            <div className="flex h-20 w-16 items-center justify-center bg-white/[0.02]">
                              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                                No image
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-1 items-start justify-between gap-4">
                          <div className="space-y-1">
                            <p className="text-base font-medium text-stone-100">
                              {item.name}
                            </p>
                            {item.size_label ? (
                              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                                {item.size_label}
                              </p>
                            ) : null}
                            <p className="text-sm text-stone-500">
                              Qty {item.quantity}
                            </p>
                          </div>

                          <p className="text-sm font-medium text-stone-200">
                            {formatPrice(
                              getCartLineTotal(item.price, item.quantity),
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
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

                  <div className="space-y-4 pt-2">
                    <button
                      type="button"
                      className="w-full rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm uppercase tracking-[0.22em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10"
                    >
                      Payment Coming Next
                    </button>

                    <p className="text-center text-xs leading-6 text-stone-500">
                      Payment, taxes, and shipping calculations will be added in the
                      next checkout step.
                    </p>
                  </div>
                </div>
              </div>

              <Link
                href="/cart"
                className="inline-flex items-center text-sm uppercase tracking-[0.22em] text-stone-400 transition-colors hover:text-stone-100"
              >
                Return to Cart
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <h2 className="text-2xl font-medium text-stone-100">
              Your checkout is empty
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-stone-400">
              Add products to your cart before continuing to checkout.
            </p>
            <Link
              href="/shop"
              className="mt-6 inline-flex items-center text-sm uppercase tracking-[0.22em] text-stone-300 transition-colors hover:text-stone-100"
            >
              Continue Shopping
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
