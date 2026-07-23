import Image from "next/image";
import Link from "next/link";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950";

const principles = [
  {
    number: "01",
    title: "Mood",
    text: "We consider how a fragrance might sit within a moment—quiet, bright, warm, or unfamiliar—without reducing it to a single label.",
  },
  {
    number: "02",
    title: "Memory",
    text: "Scent often becomes attached to places and routines. The store leaves space for those connections to form in the wearer’s own way.",
  },
  {
    number: "03",
    title: "Expression",
    text: "Choosing fragrance is personal. The edit is intended as a starting point, not a rulebook.",
  },
];

export default function AboutPage() {
  return (
    <div className="overflow-x-clip">
      <section className="px-6 pb-24 pt-20 sm:px-10 sm:pb-32 sm:pt-28 lg:px-12 lg:pb-40">
        <div className="mx-auto w-full max-w-7xl">
          <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-500 sm:text-xs">
            About Sombre
          </p>
          <h1 className="mt-7 max-w-6xl font-display text-[3.25rem] font-light leading-[0.96] text-stone-100 sm:text-6xl lg:text-[5.5rem]">
            Fragrance, considered through mood and memory.
          </h1>
          <p className="ml-auto mt-12 max-w-2xl text-sm leading-8 text-stone-400 sm:mt-16 sm:text-base">
            Sombre is an online fragrance store with a focused point of view.
            The current edit centres on Maison Margiela Replica, presented with
            room to notice what feels personal.
          </p>
        </div>
      </section>

      <section
        aria-labelledby="about-store-heading"
        className="px-6 sm:px-10 lg:px-12"
      >
        <div className="mx-auto grid w-full max-w-7xl gap-10 border-y border-white/10 py-14 sm:py-18 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:py-20">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-500 sm:text-xs">
              The Store
            </p>
            <h2
              id="about-store-heading"
              className="mt-5 max-w-md font-display text-3xl font-light leading-[1.1] text-stone-100 sm:text-4xl lg:text-5xl"
            >
              A focused way to discover scent.
            </h2>
          </div>

          <div className="max-w-2xl space-y-6 text-sm leading-8 text-stone-400 sm:text-base">
            <p>
              Sombre is an emerging fragrance retailer. The fragrances remain
              the work of the brands that make them; our role is to present a
              focused edit with clarity and atmosphere.
            </p>
            <p>
              The collection begins narrowly, allowing each fragrance more room
              and keeping the experience deliberate rather than crowded.
            </p>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="personal-language-heading"
        className="px-6 py-24 sm:px-10 sm:py-32 lg:px-12 lg:py-40"
      >
        <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-12 lg:items-start lg:gap-6">
          <figure className="relative aspect-[4/5] overflow-hidden lg:col-span-5">
            <Image
              src="/images/products/maison-margiela/model-3.jpg"
              alt="Model holding a Maison Margiela Replica fragrance bottle"
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover object-center"
            />
          </figure>

          <div className="flex flex-col lg:col-span-7 lg:pl-14 xl:pl-20">
            <div className="max-w-xl lg:ml-auto lg:pt-12">
              <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-500 sm:text-xs">
                A Personal Language
              </p>
              <h2
                id="personal-language-heading"
                className="mt-5 font-display text-4xl font-light leading-[1.08] text-stone-100 sm:text-5xl lg:text-6xl"
              >
                What a fragrance means is never fixed.
              </h2>
              <p className="mt-7 text-sm leading-8 text-stone-400 sm:text-base">
                A scent may recall a place, alter the mood of an evening, or
                simply become familiar through repetition. Sombre treats those
                associations as personal: suggestions to explore, not stories
                prescribed in advance.
              </p>
            </div>

            <figure className="relative mt-16 aspect-[4/3] overflow-hidden sm:mt-20 lg:mt-28">
              <Image
                src="/images/products/maison-margiela/model-4.png"
                alt="Model holding a Maison Margiela Replica fragrance bottle among pale flowers"
                fill
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="object-cover object-center"
              />
            </figure>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="fragrance-philosophy-heading"
        className="px-6 pb-24 sm:px-10 sm:pb-32 lg:px-12 lg:pb-40"
      >
        <div className="mx-auto w-full max-w-7xl border-t border-white/10">
          <div className="grid gap-8 py-12 sm:py-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-500 sm:text-xs">
                Fragrance Philosophy
              </p>
              <h2
                id="fragrance-philosophy-heading"
                className="mt-5 max-w-md font-display text-3xl font-light leading-[1.1] text-stone-100 sm:text-4xl lg:text-5xl"
              >
                Space for your own associations.
              </h2>
            </div>

            <ol className="border-t border-white/10 lg:border-t-0">
              {principles.map((principle) => (
                <li
                  key={principle.number}
                  className="grid gap-4 border-b border-white/10 py-7 sm:grid-cols-[4rem_10rem_1fr] sm:items-baseline sm:gap-6 sm:py-8"
                >
                  <p className="text-[0.65rem] tracking-[0.24em] text-stone-600">
                    {principle.number}
                  </p>
                  <h3 className="font-display text-2xl font-light text-stone-100">
                    {principle.title}
                  </h3>
                  <p className="max-w-xl text-sm leading-7 text-stone-400">
                    {principle.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="about-collection-heading"
        className="px-6 pb-24 sm:px-10 sm:pb-32 lg:px-12 lg:pb-40"
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 border-t border-white/10 pt-12 sm:pt-16 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-500 sm:text-xs">
              Current Edit
            </p>
            <h2
              id="about-collection-heading"
              className="mt-5 max-w-2xl font-display text-4xl font-light leading-[1.08] text-stone-100 sm:text-5xl lg:text-6xl"
            >
              Begin with the collection.
            </h2>
            <p className="mt-6 max-w-xl text-sm leading-8 text-stone-400 sm:text-base">
              Explore the fragrances currently available through Sombre.
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
