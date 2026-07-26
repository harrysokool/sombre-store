"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";

import { CheckoutFormField } from "@/components/cart/checkout-form-field";
import { CheckoutOrderSummary } from "@/components/cart/checkout-order-summary";
import { useCartItems } from "@/hooks/use-cart-items";
import { useCouponPreview } from "@/hooks/use-coupon-preview";
import { getCartItemCount, saveCheckoutCartSnapshot } from "@/lib/cart/cart";
import type { CheckoutSessionPayload } from "@/lib/checkout/payload";
import {
  getCheckoutTotal,
  SHIPPING_COUNTRY,
  SHIPPING_FEE_HKD,
} from "@/lib/checkout/shipping";
import { getCartSubtotal } from "@/lib/cart/math";
import { formatPrice } from "@/lib/storefront/format-price";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950";

const policyLinkClass = `text-stone-400 underline underline-offset-4 transition-colors hover:text-stone-200 ${focusRing}`;

// How long to wait after handing the browser a Stripe URL before offering a
// manual link. Long enough that a working redirect always wins the race, short
// enough that a customer left sitting on this page is not stranded.
const REDIRECT_FALLBACK_DELAY_MS = 2500;

export function CheckoutPageContent() {
  const formRef = useRef<HTMLFormElement>(null);
  const { cartItems } = useCartItems();
  const {
    preview: couponPreview,
    isLoading: isCouponLoading,
    isReady: isCouponReady,
    errorMessage: couponErrorMessage,
    removeCoupon,
  } = useCouponPreview(cartItems);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set only once a Stripe Session exists but the browser has not left this
  // page. Rendering it offers a way forward without inviting a second payment.
  const [stalledRedirectUrl, setStalledRedirectUrl] = useState<string | null>(
    null,
  );
  // The real double-submit guard. `isSubmitting` drives the disabled state, but
  // it is React state and is not guaranteed to have flushed before a second
  // submit event is dispatched; this ref is updated synchronously, so a rapid
  // second submission is rejected outright.
  const isCheckoutLockedRef = useRef(false);

  const resolvedCartItems = cartItems ?? [];
  const itemCount = getCartItemCount(resolvedCartItems);
  const subtotal = getCartSubtotal(resolvedCartItems);
  const total = getCheckoutTotal(subtotal);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Checked before anything else and never reset once a Stripe Session
    // exists, so no repeat submission can reach Session creation.
    if (isCheckoutLockedRef.current) {
      return;
    }

    if (
      !formRef.current ||
      resolvedCartItems.length === 0 ||
      isSubmitting ||
      isCouponLoading ||
      !isCouponReady
    ) {
      return;
    }

    isCheckoutLockedRef.current = true;

    const formData = new FormData(formRef.current);

    const payload: CheckoutSessionPayload = {
      cartItems: resolvedCartItems,
      subtotal,
      couponCode: couponPreview?.couponCode ?? null,
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

    setIsSubmitting(true);
    setErrorMessage(null);

    // Phase 1 — create the Stripe Session.
    //
    // Nothing chargeable exists yet, so every failure in here is safe to
    // surface and safe to retry. This is the only phase that may release the
    // lock or show a checkout error.
    let session: { sessionId: string; url: string };

    try {
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

      session = { sessionId: data.sessionId, url: data.url };
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not start Stripe Checkout.",
      );
      setIsSubmitting(false);
      isCheckoutLockedRef.current = false;
      return;
    }

    // A payable Stripe Session now exists.
    //
    // Past this line the lock is never released and no failure message is
    // shown. Reporting "checkout failed" here would be untrue and would push
    // the customer into creating a second Session for the same cart.

    // Phase 2 — persist the snapshot, deliberately separated from Session
    // creation. Its result cannot block the redirect: losing it only means the
    // cart is left alone after payment instead of being reduced, which is
    // recoverable. A duplicate payment is not.
    //
    // The storage layer already guarantees this cannot throw. It is wrapped
    // anyway, because this is the exact boundary the original bug crossed: a
    // throw here would abort the redirect and strand the customer with a live
    // Session, and that must not depend on a promise made in another module.
    try {
      saveCheckoutCartSnapshot(session.sessionId, resolvedCartItems);
    } catch {
      // Deliberately swallowed. Cart cleanup after payment is the only
      // casualty, and reconciliation already treats a missing snapshot as
      // "leave the cart alone".
    }

    // Phase 3 — hand off to Stripe.
    try {
      window.location.assign(session.url);
    } catch {
      // Navigation refused outright: offer the link immediately.
      setStalledRedirectUrl(session.url);
      return;
    }

    // `assign` can also fail by simply doing nothing. If this page is still
    // here shortly afterwards, surface the same manual link.
    window.setTimeout(() => {
      setStalledRedirectUrl(session.url);
    }, REDIRECT_FALLBACK_DELAY_MS);
  }

  const hasItems = resolvedCartItems.length > 0;

  return (
    <section className="px-6 py-20 sm:px-10 sm:py-28 lg:px-12">
      <div
        className="mx-auto w-full max-w-7xl"
        aria-busy={cartItems === null || undefined}
      >
        <header className="border-b border-white/10 pb-8">
          <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-500 sm:text-xs">
            Sombre
          </p>
          <h1 className="mt-3 font-display text-4xl font-light leading-none text-stone-100 sm:text-6xl">
            Checkout
          </h1>
        </header>

        {cartItems === null ? (
          <p
            role="status"
            aria-live="polite"
            className="py-24 text-center text-sm text-stone-400"
          >
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
                {/* maxLength values mirror the server rules in
                    src/app/api/checkout/session/route.ts (CUSTOMER_FIELD_RULES)
                    so the form and API agree on limits without changing them. */}
                <CheckoutFormField
                  label="Full name"
                  name="fullName"
                  type="text"
                  placeholder="Your full name"
                  required
                  maxLength={120}
                  autoComplete="name"
                  className="space-y-2.5 sm:col-span-2"
                />

                <CheckoutFormField
                  label="Email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  maxLength={254}
                  autoComplete="email"
                  inputMode="email"
                />

                <CheckoutFormField
                  label="Phone"
                  name="phone"
                  type="tel"
                  placeholder="Optional"
                  maxLength={32}
                  autoComplete="tel"
                  inputMode="tel"
                />

                <CheckoutFormField
                  label="Address line 1"
                  name="addressLine1"
                  type="text"
                  placeholder="Street address"
                  required
                  maxLength={200}
                  autoComplete="address-line1"
                  className="space-y-2.5 sm:col-span-2"
                />

                <CheckoutFormField
                  label="Address line 2"
                  name="addressLine2"
                  type="text"
                  placeholder="Apartment, suite, or floor"
                  maxLength={200}
                  autoComplete="address-line2"
                  className="space-y-2.5 sm:col-span-2"
                />

                <CheckoutFormField
                  label="District"
                  name="district"
                  type="text"
                  placeholder="e.g. Wan Chai, Sha Tin, Tsuen Wan"
                  required
                  maxLength={85}
                  autoComplete="address-level2"
                  className="space-y-2.5 sm:col-span-2"
                />

                <CheckoutFormField
                  label="City"
                  name="city"
                  type="text"
                  placeholder="City"
                  required
                  maxLength={85}
                  autoComplete="address-level1"
                />

                <CheckoutFormField
                  label="Postal code"
                  name="postalCode"
                  type="text"
                  placeholder="Optional"
                  maxLength={32}
                  autoComplete="postal-code"
                  inputMode="numeric"
                />

                <CheckoutFormField
                  label="Country"
                  name="country"
                  type="text"
                  placeholder={SHIPPING_COUNTRY}
                  required
                  defaultValue={SHIPPING_COUNTRY}
                  readOnly
                  autoComplete="country-name"
                  describedBy="checkout-country-help"
                  className="space-y-2.5 sm:col-span-2"
                />
                <p
                  id="checkout-country-help"
                  className="text-xs leading-6 text-stone-400 sm:col-span-2"
                >
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
              couponPreview={couponPreview}
            >
              <div className="space-y-5">
                {isCouponLoading ? (
                  <p
                    role="status"
                    aria-live="polite"
                    className="border-t border-white/10 pt-6 text-xs leading-6 text-stone-400"
                  >
                    Revalidating your coupon&hellip;
                  </p>
                ) : null}

                {couponPreview ? (
                  <section
                    aria-label="Applied coupon"
                    className="space-y-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-4 py-3"
                  >
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="break-words text-xs leading-6 text-emerald-200 [overflow-wrap:anywhere]">
                          Coupon{" "}
                          <span className="font-medium">
                            {couponPreview.couponCode}
                          </span>{" "}
                          applied
                        </p>
                        <p className="text-xs leading-6 text-stone-300">
                          Discount: −
                          {formatPrice(couponPreview.discountMinor / 100)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={removeCoupon}
                        className={`self-start text-xs uppercase tracking-[0.2em] text-stone-300 underline decoration-stone-600 underline-offset-4 transition-colors hover:text-white sm:self-auto ${focusRing}`}
                        aria-label={`Remove ${couponPreview.couponCode} coupon`}
                      >
                        Remove
                      </button>
                    </div>
                  </section>
                ) : null}

                {couponErrorMessage ? (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3 text-xs leading-6 text-red-300"
                  >
                    {couponErrorMessage}
                  </p>
                ) : null}

                <button
                  type="submit"
                  form="checkout-form"
                  disabled={
                    isSubmitting || isCouponLoading || !isCouponReady
                  }
                  className={`w-full rounded-full bg-stone-100 px-6 py-4 text-xs uppercase tracking-[0.28em] text-stone-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-stone-500 ${focusRing}`}
                >
                  {isSubmitting
                    ? "Opening Stripe…"
                    : "Continue to Payment"}
                </button>

                {/* Shown only when a Stripe Session already exists and the
                    browser stayed on this page. It deliberately reads as
                    "continue", never "try again": the payment attempt is
                    already open on Stripe's side. */}
                {stalledRedirectUrl ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="space-y-3 rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-center text-xs leading-6 text-amber-200"
                  >
                    <p>
                      Your secure Stripe payment page is ready, but this browser
                      did not open it automatically. Continue with the link
                      below — do not start checkout again, or you may be charged
                      twice.
                    </p>
                    <a
                      href={stalledRedirectUrl}
                      className={`inline-block underline underline-offset-4 hover:text-amber-100 ${focusRing}`}
                    >
                      Continue to secure payment
                    </a>
                  </div>
                ) : null}

                {errorMessage && !stalledRedirectUrl ? (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3 text-center text-xs leading-6 text-red-300"
                  >
                    {errorMessage}
                  </p>
                ) : null}

                <p className="text-center text-[0.7rem] leading-6 text-stone-400">
                  You will be redirected to Stripe to enter your payment details
                  securely. Sombre never stores your card.
                </p>

                <p className="text-center text-[0.7rem] leading-6 text-stone-400">
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
            <p className="mt-5 text-sm leading-8 text-stone-400">
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
