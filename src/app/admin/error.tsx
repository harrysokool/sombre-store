"use client";

import Link from "next/link";

// Error boundary for the admin area. The storefront keeps its own branded
// boundary inside the `(storefront)` group; this one renders without any public
// chrome and says nothing about the underlying failure.
export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16 sm:px-6">
      <div
        role="alert"
        aria-live="assertive"
        className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center"
      >
        <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
          Sombre Admin
        </p>
        <h1 className="text-2xl font-medium tracking-[0.08em] text-stone-100">
          Something went wrong
        </h1>
        <p className="text-sm leading-6 text-stone-400">
          This admin page could not be loaded. No order, payment, or stock data
          was changed by this error.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            Try again
          </button>
          <Link
            href="/admin"
            className="rounded-full border border-white/10 px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-stone-400 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            Back to orders
          </Link>
        </div>
      </div>
    </main>
  );
}
