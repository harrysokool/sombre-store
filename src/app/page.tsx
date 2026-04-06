import Image from "next/image";
import Link from "next/link";

const showcaseProducts = [
  {
    name: "Velvet Ember",
    slug: "velvet-ember",
    meta: "Extrait • 50 mL",
    image: "/images/products/velvet-ember-01.jpg",
  },
  {
    name: "Quiet Flame Candle",
    slug: "quiet-flame-candle",
    meta: "Home Fragrance • 280 g",
    image: "/images/products/quiet-flame-candle-01.jpg",
  },
  {
    name: "Silken Resin Body Lotion",
    slug: "silken-resin-body-lotion",
    meta: "Body Care • 250 mL",
    image: "/images/products/silken-resin-body-lotion-01.jpg",
  },
];

const categoryLinks = [
  {
    name: "Perfume",
    description: "Compositions held close to the skin.",
    image: "/images/products/velvet-ember-02.jpg",
  },
  {
    name: "Body",
    description: "Daily care with a quieter finish.",
    image: "/images/products/silken-resin-body-lotion-02.jpg",
  },
  {
    name: "Home",
    description: "Interior fragrance for dim rooms.",
    image: "/images/products/quiet-flame-candle-02.jpg",
  },
];

export default function Home() {
  return (
    <div className="overflow-hidden">
      <section className="relative min-h-[88vh] px-6 pb-16 pt-20 sm:px-10 sm:pb-20 sm:pt-24 lg:px-12">
        <div className="absolute inset-0 -z-20 bg-[#141211]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(168,162,158,0.12),transparent_22%),linear-gradient(180deg,rgba(20,18,17,0.06)_0%,rgba(20,18,17,0)_28%,rgba(20,18,17,0.84)_100%)]" />
        <div className="absolute left-1/2 top-0 -z-10 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-stone-200/5 blur-3xl" />

        <div className="mx-auto flex min-h-[calc(88vh-5rem)] w-full max-w-7xl flex-col justify-between gap-12">
          <div className="flex flex-1 flex-col items-center justify-center pt-10 text-center">
            <div className="space-y-6">
              <p className="text-xs uppercase tracking-[0.42em] text-stone-500">
                Sombre Fragrance House
              </p>
              <h1 className="text-5xl font-medium leading-[0.88] tracking-[0.08em] text-stone-100 sm:text-7xl lg:text-[7rem]">
                Scent, held
                <br />
                in shadow.
              </h1>
              <p className="mx-auto max-w-md text-base leading-8 text-stone-400">
                Perfume, body care, and interior fragrance with a darker, more
                restrained point of view.
              </p>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
              <Link
                href="/shop"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm uppercase tracking-[0.24em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10"
              >
                Explore Collection
              </Link>
              <Link
                href="/about"
                className="border-b border-white/30 pb-1 text-sm uppercase tracking-[0.28em] text-stone-300 transition-colors hover:border-white/60 hover:text-white"
              >
                About the House
              </Link>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.7fr_1.1fr_0.7fr]">
            <div className="hidden min-h-[22rem] overflow-hidden rounded-[2rem] bg-stone-900 lg:block">
              <Image
                src="/images/products/quiet-flame-candle-02.jpg"
                alt="Quiet Flame Candle"
                width={900}
                height={1200}
                className="h-full w-full object-cover opacity-85"
              />
            </div>

            <div className="relative min-h-[26rem] overflow-hidden rounded-[2.5rem] bg-stone-900 sm:min-h-[34rem]">
              <Image
                src="/images/products/velvet-ember-01.jpg"
                alt="Velvet Ember"
                fill
                className="object-cover opacity-90"
                priority
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,18,17,0.02),rgba(20,18,17,0.2),rgba(20,18,17,0.88))]" />
              <div className="absolute inset-x-0 bottom-0 p-8 sm:p-10">
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.34em] text-stone-400">
                    Signature Impression
                  </p>
                  <p className="max-w-lg text-2xl font-medium leading-tight text-stone-100 sm:text-[2rem]">
                    Amber, black tea, cedar, and a soft trail of smoke.
                  </p>
                </div>
              </div>
            </div>

            <div className="hidden min-h-[22rem] overflow-hidden rounded-[2rem] bg-stone-900 lg:block">
              <Image
                src="/images/products/silken-resin-body-lotion-02.jpg"
                alt="Silken Resin Body Lotion"
                width={900}
                height={1200}
                className="h-full w-full object-cover opacity-85"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-20 sm:px-10 sm:py-24 lg:px-12">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.36em] text-stone-500">
                Signature Edit
              </p>
              <h2 className="max-w-3xl text-3xl font-medium leading-tight tracking-[0.1em] text-stone-100 sm:text-4xl lg:text-[3.25rem]">
                A smaller, sharper view of the house.
              </h2>
            </div>

            <Link
              href="/shop"
              className="border-b border-white/30 pb-1 text-sm uppercase tracking-[0.28em] text-stone-300 transition-colors hover:border-white/60 hover:text-white"
            >
              View All
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr_0.85fr]">
            {showcaseProducts.map((product, index) => (
              <Link
                key={product.slug}
                href={`/products/${product.slug}`}
                className={`group relative overflow-hidden rounded-[2.25rem] bg-stone-900 ${
                  index === 0 ? "min-h-[34rem]" : "min-h-[26rem]"
                }`}
              >
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,18,17,0.04),rgba(20,18,17,0.18),rgba(20,18,17,0.9))]" />
                <div className="absolute inset-x-0 bottom-0 p-7 sm:p-8">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.24em] text-stone-400">
                      {product.meta}
                    </p>
                    <h3 className="text-2xl font-medium tracking-[0.08em] text-stone-100">
                      {product.name}
                    </h3>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 sm:px-10 sm:py-24 lg:px-12">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.36em] text-stone-500">
              Collection
            </p>
            <h2 className="max-w-3xl text-3xl font-medium leading-tight tracking-[0.1em] text-stone-100 sm:text-4xl">
              Three entries into the world of Sombre.
            </h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {categoryLinks.map((category) => (
              <Link
                key={category.name}
                href="/shop"
                className="group relative min-h-[24rem] overflow-hidden rounded-[2rem] bg-stone-900"
              >
                <Image
                  src={category.image}
                  alt={category.name}
                  fill
                  className="object-cover opacity-85 transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,18,17,0.08),rgba(20,18,17,0.2),rgba(20,18,17,0.88))]" />
                <div className="absolute inset-x-0 bottom-0 p-7">
                  <div className="space-y-3">
                    <h3 className="text-3xl font-medium tracking-[0.08em] text-stone-100">
                      {category.name}
                    </h3>
                    <p className="max-w-sm text-sm leading-7 text-stone-300">
                      {category.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24 pt-8 sm:px-10 sm:pb-32 lg:px-12">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 border-t border-white/10 pt-12 text-center sm:pt-16">
          <p className="text-xs uppercase tracking-[0.36em] text-stone-500">
            House Statement
          </p>
          <p className="mx-auto max-w-4xl text-2xl font-medium leading-relaxed tracking-[0.06em] text-stone-100 sm:text-3xl lg:text-[2.8rem]">
            A darker, quieter expression of modern fragrance and ritual.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm uppercase tracking-[0.24em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10"
            >
              Shop Sombre
            </Link>
            <Link
              href="/about"
              className="border-b border-white/30 pb-1 text-sm uppercase tracking-[0.28em] text-stone-300 transition-colors hover:border-white/60 hover:text-white"
            >
              About the House
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
