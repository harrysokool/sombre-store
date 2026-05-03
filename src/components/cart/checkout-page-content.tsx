"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";

import { CartProductImage } from "@/components/cart/cart-product-image";
import { OrderSummary } from "@/components/cart/order-summary";
import { useCartItems } from "@/hooks/use-cart-items";
import { getCartItemCount, saveCheckoutCartSnapshot } from "@/lib/cart/cart";
import type { CheckoutSessionPayload } from "@/lib/checkout/payload";
import { getCartLineTotal, getCartSubtotal } from "@/lib/cart/math";
import { formatPrice } from "@/lib/storefront/format-price";

export function CheckoutPageContent() {
  const formRef = useRef<HTMLFormElement>(null);
  const { cartItems } = useCartItems();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolvedCartItems = cartItems ?? [];
  const itemCount = getCartItemCount(resolvedCartItems);
  const subtotal = getCartSubtotal(resolvedCartItems);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formRef.current || resolvedCartItems.length === 0 || isSubmitting) {
      return;
    }

    const formData = new FormData(formRef.current);

    const payload: CheckoutSessionPayload = {
      cartItems: resolvedCartItems,
      subtotal,
      customer: {
        fullName: String(formData.get("fullName") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim(),
        phone: String(formData.get("phone") ?? "").trim(),
        addressLine1: String(formData.get("addressLine1") ?? "").trim(),
        addressLine2: String(formData.get("addressLine2") ?? "").trim(),
        city: String(formData.get("city") ?? "").trim(),
        postalCode: String(formData.get("postalCode") ?? "").trim(),
        country: String(formData.get("country") ?? "").trim(),
      },
    };

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const response = await fetch("/api/checkout/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        error?: string;
        sessionId?: string;
        url?: string;
      };

      if (!response.ok || !data.url || !data.sessionId) {
        throw new Error(data.error ?? "Could not start Stripe Checkout.");
      }

      saveCheckoutCartSnapshot(data.sessionId, resolvedCartItems);
      window.location.assign(data.url);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not start Stripe Checkout.",
      );
      setIsSubmitting(false);
    }
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
              Checkout
            </h1>
            <p className="text-base leading-8 text-stone-400">
              Enter your details, review your order, and complete payment
              securely through Stripe.
            </p>
          </div>
        </div>

        {cartItems === null ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <h2 className="text-2xl font-medium text-stone-100">
              Loading checkout
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-stone-400">
              Loading the products saved in your cart.
            </p>
          </div>
        ) : resolvedCartItems.length > 0 ? (
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6 rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 sm:p-8">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                  Customer Information
                </p>
                <h2 className="text-2xl font-medium text-stone-100">
                  Shipping details
                </h2>
              </div>

              <form
                id="checkout-form"
                ref={formRef}
                onSubmit={handleSubmit}
                className="grid gap-5 sm:grid-cols-2"
              >
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-xs uppercase tracking-[0.24em] text-stone-500">
                    Full name
                  </span>
                  <input
                    type="text"
                    name="fullName"
                    required
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
                    required
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
                    required
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
                    required
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
                    required
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
                    required
                    className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-stone-100 outline-none transition-colors placeholder:text-stone-600 focus:border-white/20"
                    placeholder="Country"
                  />
                </label>
              </form>
            </div>

            <div className="space-y-6">
              <OrderSummary
                eyebrow="Order Summary"
                title="Secure checkout"
                itemCount={itemCount}
                subtotal={subtotal}
                className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 sm:p-8"
                contentClassName="space-y-6"
                lineItems={
                  <div className="space-y-4 border-t border-white/10 pt-6">
                    {resolvedCartItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 border-b border-white/5 pb-4 last:border-b-0 last:pb-0"
                      >
                        <CartProductImage
                          imageUrl={item.image_url}
                          name={item.name}
                          variant="checkout"
                        />

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
                }
              >
                <div className="space-y-4 pt-2">
                  <button
                    type="submit"
                    form="checkout-form"
                    disabled={isSubmitting}
                    className="w-full rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm uppercase tracking-[0.22em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting
                      ? "Opening Stripe..."
                      : "Continue to Secure Payment"}
                  </button>

                  {errorMessage ? (
                    <p className="text-center text-xs leading-6 text-red-300">
                      {errorMessage}
                    </p>
                  ) : null}

                  <p className="text-center text-xs leading-6 text-stone-500">
                    You will be redirected to Stripe Checkout to enter your
                    payment details securely.
                  </p>

                  <Link
                    href="/cart"
                    className="inline-flex w-full items-center justify-center text-xs uppercase tracking-[0.22em] text-stone-500 transition-colors hover:text-stone-200"
                  >
                    Return to Cart
                  </Link>
                </div>
              </OrderSummary>
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
