import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="overflow-hidden">
      <section className="relative px-6 pb-20 pt-24 sm:px-10 sm:pb-24 sm:pt-32 lg:px-12">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(168,162,158,0.08),transparent_26%),linear-gradient(180deg,rgba(20,18,17,0.08)_0%,rgba(20,18,17,0)_42%,rgba(20,18,17,0.62)_100%)]" />

        <div className="mx-auto grid w-full max-w-7xl gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div className="space-y-5">
            <p className="text-xs uppercase tracking-[0.4em] text-stone-500">
              About Sombre
            </p>
            <h1 className="max-w-3xl text-4xl font-medium leading-tight tracking-[0.12em] text-stone-100 sm:text-6xl">
              A quieter approach to fragrance.
            </h1>
          </div>

          <p className="max-w-2xl text-base leading-8 text-stone-400">
            Sombre is a modern fragrance house shaped by restraint, atmosphere,
            and the pleasure of beautifully considered objects. The collection
            brings perfume, body care, and interior rituals into one calm,
            refined world.
          </p>
        </div>
      </section>

      <section className="px-6 py-20 sm:px-10 sm:py-24 lg:px-12">
        <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
              Brand Story
            </p>
            <h2 className="max-w-lg text-3xl font-medium leading-tight tracking-[0.1em] text-stone-100 sm:text-4xl">
              Built around mood, restraint, and modern luxury.
            </h2>
          </div>

          <div className="grid gap-8 border-t border-white/10 pt-8 text-base leading-8 text-stone-400 sm:grid-cols-2 lg:border-t-0 lg:pt-0">
            <p>
              Sombre began with a simple idea: fragrance should not feel loud or
              decorative. It should shape a room, settle on the skin, and remain
              memorable through detail rather than excess.
            </p>
            <p>
              The brand is designed for people who value calm composition,
              tactile presentation, and a slower, more deliberate relationship
              with scent and ritual.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-20 sm:px-10 sm:py-24 lg:px-12">
        <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[2.5rem] bg-[linear-gradient(155deg,rgba(39,36,33,0.88),rgba(24,24,29,0.5),rgba(20,18,17,0.96))] p-8 sm:p-10">
            <div className="space-y-5">
              <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
                Fragrance Philosophy
              </p>
              <h2 className="max-w-lg text-3xl font-medium leading-tight tracking-[0.1em] text-stone-100 sm:text-4xl">
                Texture, atmosphere, and curation over noise.
              </h2>
              <p className="max-w-xl text-base leading-8 text-stone-400">
                Every selection is guided by tone and composition. Notes, finish,
                packaging, and presentation are considered together so the
                experience feels complete from the first impression to the final
                trace.
              </p>
            </div>
          </div>

          <div className="grid gap-8 border-t border-white/10 pt-8 text-base leading-8 text-stone-400 lg:border-t-0 lg:pt-0">
            <p>
              Sombre values precision in the same way a well-made interior or a
              carefully cut garment does. Nothing is included for effect alone.
              Each element should contribute to the mood with clarity and
              purpose.
            </p>
            <p>
              The result is a fragrance perspective that feels intimate rather
              than performative: softened woods, mineral warmth, smoke, stone,
              fabric, skin, and light held in balance.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-20 sm:px-10 sm:py-24 lg:px-12">
        <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
              Quality & Curation
            </p>
            <h2 className="max-w-lg text-3xl font-medium leading-tight tracking-[0.1em] text-stone-100 sm:text-4xl">
              Thoughtful selection, elevated presentation, and lasting appeal.
            </h2>
          </div>

          <div className="grid gap-8 border-t border-white/10 pt-8 text-base leading-8 text-stone-400 sm:grid-cols-2 lg:border-t-0 lg:pt-0">
            <p>
              The assortment is intentionally concise. Products are chosen for
              coherence, character, and the ability to sit comfortably within
              the wider world of the house.
            </p>
            <p>
              That same care extends to presentation. From imagery to packaging
              and page design, Sombre aims to make discovery feel considered,
              calm, and quietly luxurious.
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
              Discover the collection and the rituals that shape it.
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
