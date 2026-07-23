"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";

import { CheckoutFormField } from "@/components/cart/checkout-form-field";
import { CheckoutOrderSummary } from "@/components/cart/checkout-order-summary";
import { useCartItems } from "@/hooks/use-cart-items";
import { getCartItemCount, saveCheckoutCartSnapshot } from "@/lib/cart/cart";
import type { CheckoutSessionPayload } from "@/lib/checkout/payload";
import {
  getCheckoutTotal,
  SHIPPING_COUNTRY,
  SHIPPING_FEE_HKD,
} from "@/lib/checkout/shipping";
import { getCartSubtotal } from "@/lib/cart/math";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950";

const policyLinkClass = `text-stone-400 underline underline-offset-4 transition-colors hover:text-stone-200 ${focusRing}`;

export function CheckoutPageContent() {
  const formRef = useRef<HTMLFormElement>(null);
  const { cartItems } = useCartItems();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolvedCartItems = cartItems ?? [];
  const itemCount = getCartItemCount(resolvedCartItems);
  const subtotal = getCartSubtotal(resolvedCartItems);
  const total = getCheckoutTotal(subtotal);

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
        district: String(formData.get("district") ?? "").trim(),
        city: String(formData.get("city") ?? "").trim(),
        postalCode: String(formData.get("postalCode") ?? "").trim(),
        country: SHIPPING_COUNTRY,
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

  const hasItems = resolvedCartItems.length > 0;

  return (
    <section className="px-6 py-20 sm:px-10 sm:py-28 lg:px-12">
      <div className="mx-auto w-full max-w-7xl">
        <header className="border-b border-white/10 pb-8">
          <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-500 sm:text-xs">
            Sombre
          </p>
          <h1 className="mt-3 font-display text-4xl font-light leading-none text-stone-100 sm:text-6xl">
            Checkout
          </h1>
        </header>

        {cartItems === null ? (
          <p className="py-24 text-center text-sm text-stone-500">
            Loading your checkout&hellip;
          </p>
        ) : hasItems ? (
          // items-start keeps the summary from stretching to the full row height,
          // which would leave its sticky positioning no room to move.
          <div className="mt-12 grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:items-start lg:gap-16">
            <div className="space-y-8">
              <h2 className="font-display text-2xl font-light text-stone-100 sm:text-3xl">
                Shipping details
              </h2>

              <form
                id="checkout-form"
                ref={formRef}
                onSubmit={handleSubmit}
                className="grid gap-6 sm:grid-cols-2"
              >
                <CheckoutFormField
                  label="Full name"
                  name="fullName"
                  type="text"
                  placeholder="Your full name"
                  required
                  className="space-y-2.5 sm:col-span-2"
                />

                <CheckoutFormField
                  label="Email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                />

                <CheckoutFormField
                  label="Phone"
                  name="phone"
                  type="tel"
                  placeholder="Optional"
                />

                <CheckoutFormField
                  label="Address line 1"
                  name="addressLine1"
                  type="text"
                  placeholder="Street address"
                  required
                  className="space-y-2.5 sm:col-span-2"
                />

                <CheckoutFormField
                  label="Address line 2"
                  name="addressLine2"
                  type="text"
                  placeholder="Apartment, suite, or floor"
                  className="space-y-2.5 sm:col-span-2"
                />

                <CheckoutFormField
                  label="District"
                  name="district"
                  type="text"
                  placeholder="e.g. Wan Chai, Sha Tin, Tsuen Wan"
                  required
                  className="space-y-2.5 sm:col-span-2"
                />

                <CheckoutFormField
                  label="City"
                  name="city"
                  type="text"
                  placeholder="City"
                  required
                />

                <CheckoutFormField
                  label="Postal code"
                  name="postalCode"
                  type="text"
                  placeholder="Optional"
                />

                <CheckoutFormField
                  label="Country"
                  name="country"
                  type="text"
                  placeholder={SHIPPING_COUNTRY}
                  required
                  defaultValue={SHIPPING_COUNTRY}
                  readOnly
                  className="space-y-2.5 sm:col-span-2"
                />
                <p className="text-xs leading-6 text-stone-500 sm:col-span-2">
                  Sombre currently ships only to Hong Kong.
                </p>
              </form>
            </div>

            <CheckoutOrderSummary
              items={resolvedCartItems}
              itemCount={itemCount}
              subtotal={subtotal}
              shippingFee={SHIPPING_FEE_HKD}
              total={total}
            >
              <div className="space-y-5">
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={isSubmitting}
                  className={`w-full rounded-full bg-stone-100 px-6 py-4 text-xs uppercase tracking-[0.28em] text-stone-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-stone-500 ${focusRing}`}
                >
                  {isSubmitting
                    ? "Opening Stripe…"
                    : "Continue to Payment"}
                </button>

                {errorMessage ? (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3 text-center text-xs leading-6 text-red-300"
                  >
                    {errorMessage}
                  </p>
                ) : null}

                <p className="text-center text-[0.7rem] leading-6 text-stone-500">
                  You will be redirected to Stripe to enter your payment details
                  securely. Sombre never stores your card.
                </p>

                <p className="text-center text-[0.7rem] leading-6 text-stone-500">
                  By continuing you agree to our{" "}
                  <Link href="/terms" className={policyLinkClass}>
                    Terms and Conditions
                  </Link>
                  ,{" "}
                  <Link href="/shipping-policy" className={policyLinkClass}>
                    Shipping Policy
                  </Link>
                  ,{" "}
                  <Link href="/refund-policy" className={policyLinkClass}>
                    Return and Refund Policy
                  </Link>
                  , and{" "}
                  <Link href="/privacy-policy" className={policyLinkClass}>
                    Privacy Policy
                  </Link>
                  .
                </p>

                <Link
                  href="/cart"
                  className={`flex w-full items-center justify-center py-1 text-xs uppercase tracking-[0.24em] text-stone-400 transition-colors hover:text-stone-100 ${focusRing}`}
                >
                  Return to Cart
                </Link>
              </div>
            </CheckoutOrderSummary>
          </div>
        ) : (
          <div className="mx-auto mt-24 max-w-lg text-center sm:mt-32">
            <h2 className="font-display text-3xl font-light text-stone-200 sm:text-4xl">
              Your checkout is empty
            </h2>
            <p className="mt-5 text-sm leading-8 text-stone-500">
              Add a product to your cart before continuing to payment.
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
