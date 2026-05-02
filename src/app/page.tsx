import Image from "next/image";
import Link from "next/link";

const featuredProducts = [
    {
        name: "Velvet Ember",
        slug: "velvet-ember",
        type: "Perfume extrait",
        image: "/images/products/velvet-ember-01.jpg",
    },
    {
        name: "Quiet Flame Candle",
        slug: "quiet-flame-candle",
        type: "Home fragrance",
        image: "/images/products/quiet-flame-candle-01.jpg",
    },
    {
        name: "Silken Resin Body Lotion",
        slug: "silken-resin-body-lotion",
        type: "Body care",
        image: "/images/products/silken-resin-body-lotion-01.jpg",
    },
];

const categories = [
    {
        name: "Perfume",
        description: "Personal scents with amber, woods, smoke, and soft musk.",
    },
    {
        name: "Body Care",
        description:
            "Daily cleansing and care products with refined fragrance.",
    },
    {
        name: "Home Fragrance",
        description: "Candles and room scents for calm, intimate spaces.",
    },
];

const promises = [
    "Carefully selected scents",
    "Minimal luxury design",
    "Made for daily rituals",
];

export default function Home() {
    return (
        <div className="overflow-hidden">
            <section className="px-6 py-16 sm:px-10 sm:py-20 lg:px-12">
                <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
                    <div className="space-y-8">
                        <div className="space-y-5">
                            <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
                                Sombre Fragrance House
                            </p>
                            <h1 className="max-w-3xl text-4xl font-medium leading-tight tracking-[0.08em] text-stone-100 sm:text-5xl lg:text-6xl">
                                Luxury fragrance for quiet moments
                            </h1>
                            <p className="max-w-xl text-base leading-8 text-stone-400">
                                Discover perfume, body care, and home fragrance
                                made for calm daily rituals and refined spaces.
                            </p>
                        </div>

                        <div className="flex flex-col gap-4 sm:flex-row">
                            <Link
                                href="/shop"
                                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-stone-100 px-6 py-3 text-sm uppercase tracking-[0.2em] text-stone-950 transition-colors hover:bg-white"
                            >
                                Shop Fragrance
                            </Link>
                            <Link
                                href="/about"
                                className="inline-flex items-center justify-center rounded-full border border-white/10 px-6 py-3 text-sm uppercase tracking-[0.2em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/5"
                            >
                                Explore Sombre
                            </Link>
                        </div>
                    </div>

                    <div className="relative min-h-[28rem] overflow-hidden rounded-[2rem] bg-stone-900 sm:min-h-[34rem]">
                        <Image
                            src="/images/products/velvet-ember-01.jpg"
                            alt="Velvet Ember fragrance bottle"
                            fill
                            priority
                            className="object-cover"
                        />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,18,17,0.02),rgba(20,18,17,0.16),rgba(20,18,17,0.72))]" />
                        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                            <p className="text-xs uppercase tracking-[0.26em] text-stone-400">
                                Featured fragrance
                            </p>
                            <h2 className="mt-2 text-2xl font-medium tracking-[0.08em] text-stone-100">
                                Velvet Ember
                            </h2>
                        </div>
                    </div>
                </div>
            </section>

            <section className="px-6 py-16 sm:px-10 sm:py-20 lg:px-12">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="space-y-3">
                            <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
                                Featured Products
                            </p>
                            <h2 className="text-3xl font-medium tracking-[0.08em] text-stone-100 sm:text-4xl">
                                Shop the Sombre edit
                            </h2>
                        </div>
                        <Link
                            href="/shop"
                            className="text-sm uppercase tracking-[0.22em] text-stone-300 transition-colors hover:text-stone-100"
                        >
                            View all products
                        </Link>
                    </div>

                    <div className="grid gap-8 md:grid-cols-3">
                        {featuredProducts.map((product) => (
                            <Link
                                key={product.slug}
                                href={`/products/${product.slug}`}
                                className="group block"
                            >
                                <article className="space-y-5">
                                    <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-stone-900">
                                        <Image
                                            src={product.image}
                                            alt={product.name}
                                            fill
                                            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                                            {product.type}
                                        </p>
                                        <h3 className="text-2xl font-medium tracking-[0.06em] text-stone-100">
                                            {product.name}
                                        </h3>
                                        <p className="text-sm uppercase tracking-[0.2em] text-stone-400 transition-colors group-hover:text-stone-100">
                                            View product
                                        </p>
                                    </div>
                                </article>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <section className="px-6 py-16 sm:px-10 sm:py-20 lg:px-12">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 border-y border-white/10 py-12">
                    <div className="space-y-3">
                        <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
                            Shop by Category
                        </p>
                        <h2 className="text-3xl font-medium tracking-[0.08em] text-stone-100 sm:text-4xl">
                            Find your ritual
                        </h2>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        {categories.map((category) => (
                            <Link
                                key={category.name}
                                href="/shop"
                                className="rounded-[1.5rem] border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
                            >
                                <h3 className="text-xl font-medium tracking-[0.06em] text-stone-100">
                                    {category.name}
                                </h3>
                                <p className="mt-3 text-sm leading-7 text-stone-400">
                                    {category.description}
                                </p>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <section className="px-6 py-16 sm:px-10 sm:py-20 lg:px-12">
                <div className="mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
                    <div className="space-y-3">
                        <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
                            Our Promise
                        </p>
                        <h2 className="max-w-xl text-3xl font-medium leading-tight tracking-[0.08em] text-stone-100 sm:text-4xl">
                            Fragrance that feels considered, simple, and
                            lasting.
                        </h2>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                        {promises.map((promise) => (
                            <div
                                key={promise}
                                className="rounded-[1.5rem] border border-white/10 bg-white/[0.02] p-6"
                            >
                                <p className="text-base font-medium leading-7 text-stone-100">
                                    {promise}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="px-6 pb-24 pt-10 sm:px-10 sm:pb-32 lg:px-12">
                <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 border-t border-white/10 pt-12 text-center">
                    <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
                        Sombre Collection
                    </p>
                    <h2 className="max-w-3xl text-3xl font-medium leading-tight tracking-[0.08em] text-stone-100 sm:text-4xl">
                        Choose a scent for the moments you return to every day.
                    </h2>
                    <Link
                        href="/shop"
                        className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm uppercase tracking-[0.2em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10"
                    >
                        Shop the Collection
                    </Link>
                </div>
            </section>
        </div>
    );
}
