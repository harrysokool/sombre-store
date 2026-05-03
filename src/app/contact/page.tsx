import Link from "next/link";

const supportTopics = [
  {
    title: "Orders",
    text: "Help with checkout, payment confirmation, and order status.",
  },
  {
    title: "Delivery",
    text: "Questions about shipping details and delivery updates.",
  },
  {
    title: "Product Questions",
    text: "Guidance on scents, sizes, and availability.",
  },
];

export default function ContactPage() {
  return (
    <div className="overflow-hidden">
      <section className="relative px-6 pb-16 pt-24 sm:px-10 sm:pb-20 sm:pt-32 lg:px-12">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(168,162,158,0.08),transparent_26%),linear-gradient(180deg,rgba(20,18,17,0.08)_0%,rgba(20,18,17,0)_42%,rgba(20,18,17,0.62)_100%)]" />

        <div className="mx-auto w-full max-w-5xl space-y-5">
          <p className="text-xs uppercase tracking-[0.4em] text-stone-500">
            Contact
          </p>
          <h1 className="max-w-3xl text-4xl font-medium leading-tight tracking-[0.1em] text-stone-100 sm:text-5xl">
            We&apos;re here to help.
          </h1>
          <p className="max-w-2xl text-base leading-8 text-stone-400">
            For order support, delivery questions, or help choosing a scent,
            contact the Sombre team.
          </p>
        </div>
      </section>

      <section className="px-6 pb-24 sm:px-10 sm:pb-32 lg:px-12">
        <div className="mx-auto w-full max-w-5xl border-t border-white/10">
          <div className="grid gap-10 border-b border-white/10 py-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
                Customer Care
              </p>
              <h2 className="text-2xl font-medium leading-tight tracking-[0.08em] text-stone-100 sm:text-3xl">
                Support for your order.
              </h2>
            </div>

            <div className="grid gap-8 text-base leading-8 text-stone-400 sm:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                  Email
                </p>
                <a
                  href="mailto:support@sombre.com"
                  className="text-lg font-medium text-stone-100 transition-colors hover:text-white"
                >
                  support@sombre.com
                </a>
              </div>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                  Response Time
                </p>
                <p>We usually reply within 1-2 business days.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-10 border-b border-white/10 py-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
                Orders and Support
              </p>
              <h2 className="text-2xl font-medium leading-tight tracking-[0.08em] text-stone-100 sm:text-3xl">
                How we can help.
              </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              {supportTopics.map((item) => (
                <div key={item.title} className="space-y-3">
                  <h3 className="text-sm font-medium uppercase tracking-[0.24em] text-stone-200">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-7 text-stone-400">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-10 border-b border-white/10 py-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
                Partnerships
              </p>
              <h2 className="text-2xl font-medium leading-tight tracking-[0.08em] text-stone-100 sm:text-3xl">
                Business inquiries.
              </h2>
            </div>

            <div className="space-y-3 text-base leading-8 text-stone-400">
              <p>
                For brand, retail, or business inquiries, please contact us by
                email.
              </p>
              <a
                href="mailto:partnerships@sombre.com"
                className="text-lg font-medium text-stone-100 transition-colors hover:text-white"
              >
                partnerships@sombre.com
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-6 pt-10 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
                Continue Shopping
              </p>
              <p className="max-w-xl text-base leading-8 text-stone-400">
                Browse the collection or email us with any questions before you
                order.
              </p>
            </div>

            <Link
              href="/shop"
              className="w-fit border-b border-white/30 pb-1 text-sm uppercase tracking-[0.28em] text-stone-100 transition-colors hover:border-white/60 hover:text-white"
            >
              Shop Fragrance
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
