import type { Metadata } from "next";
import Link from "next/link";

import { BUSINESS_DETAILS } from "@/lib/legal/business-details";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Reach Sombre about an order, delivery, or a product in the current edit.",
  alternates: { canonical: "/contact" },
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950";

const contactTopics = [
  {
    number: "01",
    title: "Orders",
    text: "Checkout confirmation, payment status, and questions about an existing order.",
  },
  {
    number: "02",
    title: "Delivery",
    text: "Questions about the shipping details and delivery information published by Sombre.",
  },
  {
    number: "03",
    title: "Products",
    text: "Questions about the fragrance sizes and availability currently shown in the shop.",
  },
];

export default function ContactPage() {
  return (
    <div className="overflow-x-clip">
      <section className="px-6 pb-24 pt-20 sm:px-10 sm:pb-32 sm:pt-28 lg:px-12 lg:pb-40">
        <div className="mx-auto w-full max-w-7xl">
          <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-400 sm:text-xs">
            Contact Sombre
          </p>
          <h1 className="mt-7 max-w-6xl font-display text-[3.25rem] font-light leading-[0.96] text-stone-100 sm:text-6xl lg:text-[5.5rem]">
            Reach Sombre by email.
          </h1>
          <p className="ml-auto mt-12 max-w-2xl text-sm leading-8 text-stone-400 sm:mt-16 sm:text-base">
            Sombre can be reached by email for questions about an order,
            delivery, or a product in the current edit.
          </p>
        </div>
      </section>

      <section
        aria-labelledby="contact-availability-heading"
        className="px-6 sm:px-10 lg:px-12"
      >
        <div className="mx-auto grid w-full max-w-7xl gap-10 border-y border-white/10 py-14 sm:py-18 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:py-20">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-400 sm:text-xs">
              Contact Availability
            </p>
            <h2
              id="contact-availability-heading"
              className="mt-5 max-w-md font-display text-3xl font-light leading-[1.1] text-stone-100 sm:text-4xl lg:text-5xl"
            >
              How to reach us.
            </h2>
          </div>

          <div className="max-w-2xl">
            <p className="text-sm leading-8 text-stone-400 sm:text-base">
              Email is the current way to reach Sombre. A connected contact
              form is not yet available.
            </p>

            <dl className="mt-10 divide-y divide-white/10 border-t border-white/10">
              <div className="grid gap-2 py-5 sm:grid-cols-[10rem_1fr] sm:items-baseline sm:gap-8">
                <dt className="text-[0.65rem] uppercase tracking-[0.24em] text-stone-400">
                  Email
                </dt>
                <dd className="text-sm leading-7 text-stone-300">
                  {BUSINESS_DETAILS.supportEmail}
                </dd>
              </div>
              <div className="grid gap-2 py-5 sm:grid-cols-[10rem_1fr] sm:items-baseline sm:gap-8">
                <dt className="text-[0.65rem] uppercase tracking-[0.24em] text-stone-400">
                  Contact form
                </dt>
                <dd className="text-sm leading-7 text-stone-300">
                  Not currently available
                </dd>
              </div>
              <div className="grid gap-2 py-5 sm:grid-cols-[10rem_1fr] sm:items-baseline sm:gap-8">
                <dt className="text-[0.65rem] uppercase tracking-[0.24em] text-stone-400">
                  Response time
                </dt>
                <dd className="text-sm leading-7 text-stone-300">
                  Not stated
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="contact-topics-heading"
        className="px-6 py-24 sm:px-10 sm:py-32 lg:px-12 lg:py-40"
      >
        <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-400 sm:text-xs">
              Contact Topics
            </p>
            <h2
              id="contact-topics-heading"
              className="mt-5 max-w-md font-display text-3xl font-light leading-[1.1] text-stone-100 sm:text-4xl lg:text-5xl"
            >
              The questions this page is intended to cover.
            </h2>
          </div>

          <ol className="border-t border-white/10">
            {contactTopics.map((topic) => (
              <li
                key={topic.number}
                className="grid min-w-0 gap-4 border-b border-white/10 py-7 sm:grid-cols-[4rem_10rem_1fr] sm:items-baseline sm:gap-6 sm:py-8"
              >
                <p className="text-[0.65rem] tracking-[0.24em] text-stone-400">
                  {topic.number}
                </p>
                <h3 className="font-display text-2xl font-light text-stone-100">
                  {topic.title}
                </h3>
                <p className="min-w-0 break-words text-sm leading-7 text-stone-400 [overflow-wrap:anywhere]">
                  {topic.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        aria-labelledby="contact-collection-heading"
        className="px-6 pb-24 sm:px-10 sm:pb-32 lg:px-12 lg:pb-40"
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 border-t border-white/10 pt-12 sm:pt-16 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-400 sm:text-xs">
              Current Edit
            </p>
            <h2
              id="contact-collection-heading"
              className="mt-5 max-w-2xl font-display text-4xl font-light leading-[1.08] text-stone-100 sm:text-5xl lg:text-6xl"
            >
              Continue with the collection.
            </h2>
            <p className="mt-6 max-w-xl text-sm leading-8 text-stone-400 sm:text-base">
              Browse the fragrances currently available through Sombre.
            </p>
          </div>

          <Link
            href="/shop"
            className={`inline-flex min-h-12 w-fit items-center justify-center border-b border-stone-600 pb-1 text-xs uppercase tracking-[0.28em] text-stone-200 transition-colors hover:border-stone-300 hover:text-white ${focusRing}`}
          >
            Explore the collection
          </Link>
        </div>
      </section>
    </div>
  );
}
