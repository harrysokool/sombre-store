"use client";

import Link from "next/link";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950";

export default function CheckoutSuccessError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="px-6 py-20 sm:px-10 sm:py-28 lg:px-12">
      <div className="mx-auto w-full max-w-6xl">
        <div
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          className="mx-auto max-w-3xl text-center"
        >
          <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-500 sm:text-xs">
            Status unavailable
          </p>
          <h1 className="mt-5 font-display text-5xl font-light leading-[0.95] text-stone-100 sm:text-6xl lg:text-7xl">
            We could not check your order
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-sm leading-8 text-stone-400 sm:text-base">
            The latest checkout status is temporarily unavailable. This message
            does not confirm a payment or an order.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-3xl border-y border-white/10 py-10 text-center sm:mt-20 sm:py-12">
          <p className="text-sm leading-7 text-stone-500">
            You can safely try the status check again. If it remains
            unavailable, your cart can still be reviewed.
          </p>
        </div>

        <div className="flex flex-col items-stretch justify-center gap-5 pt-10 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={reset}
            className={`inline-flex min-h-12 items-center justify-center rounded-full bg-stone-100 px-8 py-4 text-xs uppercase tracking-[0.28em] text-stone-950 transition-colors hover:bg-white ${focusRing}`}
          >
            Try again
          </button>
          <Link
            href="/cart"
            className={`inline-flex min-h-12 items-center justify-center px-4 py-3 text-xs uppercase tracking-[0.24em] text-stone-400 transition-colors hover:text-stone-100 ${focusRing}`}
          >
            Return to cart
          </Link>
        </div>
      </div>
    </section>
  );
}
