import Link from "next/link";

const philosophyLines = [
  "Quiet scents with depth, warmth, and restraint.",
  "Objects chosen for daily rituals, not passing trends.",
  "A focused edit from luxury and independent fragrance brands.",
];

export default function AboutPage() {
  return (
    <div className="overflow-hidden">
      <section className="px-6 py-20 sm:px-10 sm:py-28 lg:px-12">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
            About Sombre
          </p>
          <h1 className="max-w-4xl text-4xl font-medium leading-tight tracking-[0.08em] text-stone-100 sm:text-5xl">
            A curated view of modern fragrance.
          </h1>
          <p className="max-w-2xl text-base leading-8 text-stone-400">
            Sombre is an online store selecting perfume, body care, and home
            scent from brands with a quiet point of view.
          </p>
        </div>
      </section>

      <section className="px-6 py-14 sm:px-10 sm:py-18 lg:px-12">
        <div className="mx-auto grid w-full max-w-5xl gap-10 border-y border-white/10 py-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
              Brand Story
            </p>
            <h2 className="text-2xl font-medium tracking-[0.08em] text-stone-100 sm:text-3xl">
              Chosen with restraint.
            </h2>
          </div>

          <p className="max-w-2xl text-base leading-8 text-stone-400">
            The collection is shaped by atmosphere, texture, and simplicity.
            Each product is selected to feel refined, useful, and easy to return
            to every day.
          </p>
        </div>
      </section>

      <section className="px-6 py-14 sm:px-10 sm:py-18 lg:px-12">
        <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
              Curatorial Philosophy
            </p>
            <h2 className="text-2xl font-medium tracking-[0.08em] text-stone-100 sm:text-3xl">
              Soft presence. Lasting detail.
            </h2>
          </div>

          <div className="space-y-4">
            {philosophyLines.map((line) => (
              <p
                key={line}
                className="border-b border-white/10 pb-4 text-base leading-8 text-stone-400 last:border-b-0 last:pb-0"
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24 pt-14 sm:px-10 sm:pb-32 sm:pt-18 lg:px-12">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 border-t border-white/10 pt-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
              Collection
            </p>
            <h2 className="max-w-2xl text-2xl font-medium leading-tight tracking-[0.08em] text-stone-100 sm:text-3xl">
              Discover scents selected for the moments you return to daily.
            </h2>
          </div>

          <Link
            href="/shop"
            className="border-b border-white/30 pb-1 text-sm uppercase tracking-[0.24em] text-stone-100 transition-colors hover:border-white/60 hover:text-white"
          >
            Explore the Collection
          </Link>
        </div>
      </section>
    </div>
  );
}
