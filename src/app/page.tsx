import Image from "next/image";
import Link from "next/link";

import { formatPrice } from "@/lib/storefront/format-price";

const maisonMargielaShopHref = "/shop?category=perfume&brand=maison-margiela";

const featuredProducts = [
  {
    name: "Replica Lazy Sunday Morning",
    slug: "maison-margiela-replica-lazy-sunday-morning",
    size: "100 mL",
    price: formatPrice(165),
    image: "/images/products/maison-margiela/replica-lazy-sunday-morning-01.jpg",
    alt: "Maison Margiela Replica Lazy Sunday Morning perfume bottle",
  },
  {
    name: "Replica By the Fireplace",
    slug: "maison-margiela-replica-by-the-fireplace",
    size: "100 mL",
    price: formatPrice(165),
    image: "/images/products/maison-margiela/replica-by-the-fireplace-01.jpg",
    alt: "Maison Margiela Replica By the Fireplace perfume bottle",
  },
  {
    name: "Replica Jazz Club",
    slug: "maison-margiela-replica-jazz-club",
    size: "100 mL",
    price: formatPrice(165),
    image: "/images/products/maison-margiela/replica-jazz-club-01.jpg",
    alt: "Maison Margiela Replica Jazz Club perfume bottle",
  },
];

const trustPoints = [
  {
    title: "Curated selection",
    text: "A focused edit of Maison Margiela Replica fragrances.",
  },
  {
    title: "Secure checkout",
    text: "Payment is handled through Stripe-hosted checkout.",
  },
  {
    title: "Simple fragrance shopping",
    text: "Clear product pages, direct pricing, and a small considered catalog.",
  },
];

export default function Home() {
  return (
    <div className="overflow-hidden">
      <section className="px-6 py-14 sm:px-10 sm:py-20 lg:px-12">
        <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div className="max-w-2xl space-y-8">
            <div className="space-y-5">
              <p className="text-xs uppercase tracking-[0.28em] text-stone-500">
                Sombre Fragrance
              </p>
              <h1 className="text-4xl font-medium leading-tight text-stone-100 sm:text-5xl">
                Curated fragrance, quietly chosen.
              </h1>
              <p className="max-w-xl text-base leading-8 text-stone-400">
                A focused edit of Maison Margiela Replica scents, selected for
                everyday ritual and personal atmosphere.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={maisonMargielaShopHref}
                className="inline-flex items-center justify-center rounded-full bg-stone-100 px-6 py-3 text-sm uppercase tracking-[0.18em] text-stone-950 transition-colors hover:bg-white"
              >
                Shop the edit
              </Link>
              <Link
                href={maisonMargielaShopHref}
                className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm uppercase tracking-[0.18em] text-stone-100 transition-colors hover:border-white/30 hover:bg-white/5"
              >
                View Maison Margiela
              </Link>
            </div>
          </div>

          <Link
            href="/products/maison-margiela-replica-lazy-sunday-morning"
            className="group block"
          >
            <div className="overflow-hidden rounded-lg border border-white/10 bg-stone-900">
              <Image
                src="/images/products/maison-margiela/replica-lazy-sunday-morning-01.jpg"
                alt="Maison Margiela Replica Lazy Sunday Morning perfume bottle"
                width={1000}
                height={1250}
                priority
                className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </div>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                  Featured scent
                </p>
                <p className="mt-1 text-lg font-medium text-stone-100">
                  Replica Lazy Sunday Morning
                </p>
              </div>
              <p className="text-sm uppercase tracking-[0.2em] text-stone-400 transition-colors group-hover:text-stone-100">
                View product
              </p>
            </div>
          </Link>
        </div>
      </section>

      <section className="px-6 py-14 sm:px-10 sm:py-18 lg:px-12">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 border-t border-white/10 pt-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.28em] text-stone-500">
                Featured products
              </p>
              <h2 className="text-3xl font-medium text-stone-100">
                Maison Margiela Replica
              </h2>
            </div>
            <Link
              href={maisonMargielaShopHref}
              className="text-sm uppercase tracking-[0.2em] text-stone-300 transition-colors hover:text-stone-100"
            >
              Shop all
            </Link>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {featuredProducts.map((product) => (
              <Link
                key={product.slug}
                href={`/products/${product.slug}`}
                className="group block"
              >
                <article className="space-y-4">
                  <div className="overflow-hidden rounded-lg border border-white/10 bg-stone-900">
                    <Image
                      src={product.image}
                      alt={product.alt}
                      width={720}
                      height={900}
                      className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
                        Maison Margiela Replica
                      </p>
                      <h3 className="text-xl font-medium text-stone-100">
                        {product.name}
                      </h3>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-3">
                      <p className="text-sm text-stone-400">{product.size}</p>
                      <p className="text-sm font-medium text-stone-100">
                        {product.price}
                      </p>
                    </div>
                    <p className="text-sm uppercase tracking-[0.2em] text-stone-500 transition-colors group-hover:text-stone-200">
                      View product
                    </p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-14 sm:px-10 sm:py-18 lg:px-12">
        <div className="mx-auto grid w-full max-w-7xl gap-6 border-y border-white/10 py-10 md:grid-cols-3">
          {trustPoints.map((point) => (
            <div key={point.title} className="space-y-3">
              <h2 className="text-base font-medium text-stone-100">
                {point.title}
              </h2>
              <p className="max-w-sm text-sm leading-7 text-stone-400">
                {point.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 pb-24 pt-10 sm:px-10 sm:pb-32 lg:px-12">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 text-center">
          <p className="max-w-2xl text-2xl font-medium leading-snug text-stone-100 sm:text-3xl">
            Explore the Maison Margiela Replica edit.
          </p>
          <Link
            href={maisonMargielaShopHref}
            className="inline-flex items-center justify-center rounded-full bg-white/5 px-6 py-3 text-sm uppercase tracking-[0.18em] text-stone-100 transition-colors hover:bg-white/10"
          >
            Shop fragrance
          </Link>
        </div>
      </section>
    </div>
  );
}
