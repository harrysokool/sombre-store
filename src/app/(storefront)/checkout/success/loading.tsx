export default function CheckoutSuccessLoading() {
  return (
    <section
      aria-busy="true"
      aria-labelledby="checkout-status-loading-heading"
      className="px-6 py-20 sm:px-10 sm:py-28 lg:px-12"
    >
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mx-auto w-full max-w-3xl text-center"
      >
        <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-500 sm:text-xs">
          Checking order status
        </p>
        <h1
          id="checkout-status-loading-heading"
          className="mt-5 font-display text-5xl font-light leading-[0.95] text-stone-100 sm:text-6xl lg:text-7xl"
        >
          Verifying your checkout
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-sm leading-8 text-stone-400 sm:text-base">
          We are securely checking the latest checkout information. Payment and
          order confirmation have not yet been established.
        </p>
        <div
          aria-hidden="true"
          className="mx-auto mt-10 h-px w-24 overflow-hidden bg-white/10"
        >
          <span className="block h-full w-1/2 bg-stone-400" />
        </div>
      </div>
    </section>
  );
}
