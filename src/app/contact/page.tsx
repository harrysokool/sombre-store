import Link from "next/link";

export default function ContactPage() {
  return (
    <div className="overflow-hidden">
      <section className="relative px-6 pb-20 pt-24 sm:px-10 sm:pb-24 sm:pt-32 lg:px-12">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(168,162,158,0.08),transparent_26%),linear-gradient(180deg,rgba(20,18,17,0.08)_0%,rgba(20,18,17,0)_42%,rgba(20,18,17,0.62)_100%)]" />

        <div className="mx-auto grid w-full max-w-7xl gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div className="space-y-5">
            <p className="text-xs uppercase tracking-[0.4em] text-stone-500">
              Contact Sombre
            </p>
            <h1 className="max-w-3xl text-4xl font-medium leading-tight tracking-[0.12em] text-stone-100 sm:text-6xl">
              Reach the house.
            </h1>
          </div>

          <p className="max-w-2xl text-base leading-8 text-stone-400">
            For customer care, product questions, or partnership inquiries, we
            welcome thoughtful correspondence and will respond as promptly as we
            can.
          </p>
        </div>
      </section>

      <section className="px-6 py-20 sm:px-10 sm:py-24 lg:px-12">
        <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
              Customer Care
            </p>
            <h2 className="max-w-lg text-3xl font-medium leading-tight tracking-[0.1em] text-stone-100 sm:text-4xl">
              Support for orders, products, and general enquiries.
            </h2>
          </div>

          <div className="grid gap-8 border-t border-white/10 pt-8 text-base leading-8 text-stone-400 sm:grid-cols-2 lg:border-t-0 lg:pt-0">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                Email
              </p>
              <a
                href="mailto:care@sombre-house.com"
                className="text-lg font-medium text-stone-100 transition-colors hover:text-white"
              >
                care@sombre-house.com
              </a>
            </div>

            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                Response Time
              </p>
              <p>
                We aim to reply within two business days for order support,
                product guidance, and general customer care.
              </p>
            </div>

            <p>
              You can contact us regarding order updates, product availability,
              fragrance questions, gifting guidance, or any details related to
              the online store experience.
            </p>

            <p>
              We prefer clear, considered communication and try to respond with
              the same level of care reflected throughout the collection.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-20 sm:px-10 sm:py-24 lg:px-12">
        <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[2.5rem] bg-[linear-gradient(155deg,rgba(39,36,33,0.88),rgba(24,24,29,0.5),rgba(20,18,17,0.96))] p-8 sm:p-10">
            <div className="space-y-5">
              <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
                Wholesale & Partnerships
              </p>
              <h2 className="max-w-lg text-3xl font-medium leading-tight tracking-[0.1em] text-stone-100 sm:text-4xl">
                For select retail, editorial, and collaboration enquiries.
              </h2>
              <p className="max-w-xl text-base leading-8 text-stone-400">
                If you are interested in thoughtful retail placement,
                hospitality partnerships, or editorial collaboration, please
                contact our partnerships desk.
              </p>
            </div>
          </div>

          <div className="grid gap-8 border-t border-white/10 pt-8 text-base leading-8 text-stone-400 lg:border-t-0 lg:pt-0">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                Partnerships
              </p>
              <a
                href="mailto:partnerships@sombre-house.com"
                className="text-lg font-medium text-stone-100 transition-colors hover:text-white"
              >
                partnerships@sombre-house.com
              </a>
            </div>

            <p>
              Please include a short introduction, relevant context, and any
              timelines if you are reaching out about a collaboration or retail
              opportunity.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-20 sm:px-10 sm:py-24 lg:px-12">
        <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
              Availability
            </p>
            <h2 className="max-w-lg text-3xl font-medium leading-tight tracking-[0.1em] text-stone-100 sm:text-4xl">
              Sombre is currently available online.
            </h2>
          </div>

          <div className="grid gap-8 border-t border-white/10 pt-8 text-base leading-8 text-stone-400 sm:grid-cols-2 lg:border-t-0 lg:pt-0">
            <p>
              At this stage, the collection is offered through the online store.
              This keeps the experience focused, direct, and carefully
              presented.
            </p>
            <p>
              Future physical availability or selected stockists may be
              announced in time, but for now the house remains centered online.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24 pt-10 sm:px-10 sm:pb-32 lg:px-12">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 border-t border-white/10 pt-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
              Explore
            </p>
            <h2 className="max-w-2xl text-3xl font-medium leading-tight tracking-[0.1em] text-stone-100 sm:text-4xl">
              Return to the collection and continue discovering the house.
            </h2>
          </div>

          <Link
            href="/shop"
            className="border-b border-white/30 pb-1 text-sm uppercase tracking-[0.28em] text-stone-100 transition-colors hover:border-white/60 hover:text-white"
          >
            Visit the Shop
          </Link>
        </div>
      </section>
    </div>
  );
}
