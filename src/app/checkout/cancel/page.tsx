import Link from "next/link";

export default function CheckoutCancelPage() {
  return (
    <section className="px-6 py-24 sm:px-10 sm:py-32 lg:px-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 rounded-[2rem] border border-white/10 bg-white/[0.02] px-6 py-14 text-center sm:px-10">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
            Sombre
          </p>
          <h1 className="text-4xl font-medium tracking-[0.14em] text-stone-100 sm:text-5xl">
            Checkout canceled
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-8 text-stone-400">
            No payment was completed. Your cart is still available if you would
            like to review it and continue.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/checkout"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm uppercase tracking-[0.22em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10"
          >
            Return to Checkout
          </Link>
          <Link
            href="/cart"
            className="inline-flex items-center justify-center text-sm uppercase tracking-[0.22em] text-stone-400 transition-colors hover:text-stone-100"
          >
            Review Cart
          </Link>
        </div>
      </div>
    </section>
  );
}
