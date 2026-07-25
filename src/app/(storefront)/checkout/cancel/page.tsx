import type { Metadata } from "next";
import Link from "next/link";

// A checkout outcome page, not public content, so keep it out of search indexes.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    noimageindex: true,
  },
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950";

export default function CheckoutCancelPage() {
  return (
    <section className="px-6 py-20 sm:px-10 sm:py-28 lg:px-12">
      <div className="mx-auto w-full max-w-6xl">
        <header
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="mx-auto max-w-3xl text-center"
        >
          <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-500 sm:text-xs">
            Payment not completed
          </p>
          <h1 className="mt-5 font-display text-5xl font-light leading-[0.95] text-stone-100 sm:text-6xl lg:text-7xl">
            Checkout canceled
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-sm leading-8 text-stone-400 sm:text-base">
            No payment was completed and no order was confirmed. Your cart has
            been preserved exactly as you left it.
          </p>
        </header>

        <div className="mx-auto mt-16 max-w-3xl border-y border-white/10 py-10 text-center sm:mt-20 sm:py-12">
          <h2 className="font-display text-2xl font-light text-stone-100 sm:text-3xl">
            Your selections are still in your cart
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-stone-500">
            Return to checkout when you are ready to try again, or review your
            cart before continuing. Stock has not been reserved.
          </p>
        </div>

        <div className="flex flex-col items-stretch justify-center gap-5 pt-10 sm:flex-row sm:items-center">
          <Link
            href="/checkout"
            className={`inline-flex min-h-12 items-center justify-center rounded-full bg-stone-100 px-8 py-4 text-xs uppercase tracking-[0.28em] text-stone-950 transition-colors hover:bg-white ${focusRing}`}
          >
            Retry checkout
          </Link>
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
