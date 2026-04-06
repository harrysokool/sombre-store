import Link from "next/link";

const featuredProducts = [
    {
        name: "Velvet Ember",
        slug: "velvet-ember",
        description:
            "Amber, smoke, black tea, and a soft shadow that lingers after dusk.",
        meta: "Extrait • 50 mL",
    },
    {
        name: "Quiet Flame Candle",
        slug: "quiet-flame-candle",
        description:
            "Warm resin, charred fig wood, and dim light shaped for intimate rooms.",
        meta: "Home Fragrance • 280 g",
    },
    {
        name: "Silken Resin Body Lotion",
        slug: "silken-resin-body-lotion",
        description:
            "A daily body ritual layered with mineral woods and softened incense.",
        meta: "Body Care • 250 mL",
    },
];

const categories = [
    {
        name: "Perfume",
        description:
            "Compositions built to stay close to the skin, precise and atmospheric.",
        href: "/shop",
    },
    {
        name: "Bath & Body",
        description:
            "Quiet formulas that make cleansing and care feel deliberate again.",
        href: "/shop",
    },
    {
        name: "Home Fragrance",
        description:
            "Objects for the interior: softened light, resin, smoke, and calm.",
        href: "/shop",
    },
];

const rituals = [
    {
        title: "Evening Wear",
        text: "Scents chosen for close rooms, dark fabric, and quieter hours.",
    },
    {
        title: "Daily Ritual",
        text: "Body care treated as atmosphere: texture, warmth, and presence.",
    },
    {
        title: "Gifted Intention",
        text: "Pieces chosen for mood and memory, not excess or display.",
    },
];

export default function Home() {
    return (
        <div className="overflow-hidden">
            <section className="relative px-6 pb-24 pt-24 sm:px-10 sm:pb-32 sm:pt-32 lg:px-12 lg:pb-36">
                <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(168,162,158,0.12),transparent_28%),linear-gradient(180deg,rgba(20,18,17,0.12)_0%,rgba(20,18,17,0)_40%,rgba(20,18,17,0.68)_100%)]" />
                <div className="absolute right-[-12rem] top-10 -z-10 h-[32rem] w-[32rem] rounded-full bg-stone-400/5 blur-3xl" />
                <div className="absolute left-[-10rem] top-72 -z-10 h-[28rem] w-[28rem] rounded-full bg-stone-700/10 blur-3xl" />

                <div className="mx-auto grid w-full max-w-7xl gap-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
                    <div className="space-y-12">
                        <div className="space-y-5">
                            <p className="text-xs uppercase tracking-[0.42em] text-stone-500">
                                Sombre Fragrance House
                            </p>
                            <h1 className="max-w-4xl text-4xl font-medium leading-[0.94] tracking-[0.1em] text-stone-100 sm:text-6xl lg:text-[4.75rem]">
                                Scent, quietly composed.
                            </h1>
                            <p className="max-w-xl text-base leading-8 text-stone-400">
                                Fragrance, body care, and objects for dim rooms
                                and slower rituals.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-5">
                            <Link
                                href="/shop"
                                className="border-b border-white/30 pb-1 text-sm uppercase tracking-[0.28em] text-stone-100 transition-colors hover:border-white/60 hover:text-white"
                            >
                                Explore Collection
                            </Link>
                            <Link
                                href="/about"
                                className="text-sm uppercase tracking-[0.28em] text-stone-500 transition-colors hover:text-stone-200"
                            >
                                Read the House Story
                            </Link>
                        </div>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-[0.72fr_1fr]">
                        <div className="hidden min-h-[23rem] rounded-[2rem] bg-[linear-gradient(180deg,rgba(68,64,60,0.12),rgba(20,18,17,0.02))] sm:block" />
                        <div className="min-h-[27rem] rounded-[2.75rem] bg-[linear-gradient(165deg,rgba(39,36,33,0.82),rgba(24,24,29,0.45),rgba(20,18,17,0.92))] p-8 sm:p-10">
                            <div className="flex h-full items-end">
                                <div className="space-y-4">
                                    <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
                                        Evening Notes
                                    </p>
                                    <p className="max-w-sm text-xl font-medium leading-tight text-stone-100 sm:text-[1.7rem]">
                                        Amber, tea, cedar, iris, and pale smoke.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="px-6 py-20 sm:px-10 sm:py-24 lg:px-12">
                <div className="mx-auto grid w-full max-w-7xl gap-14 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-[0.36em] text-stone-500">
                            House Story
                        </p>
                        <h2 className="max-w-xl text-3xl font-medium leading-tight tracking-[0.1em] text-stone-100 sm:text-4xl">
                            Fragrance as atmosphere, not performance.
                        </h2>
                    </div>

                    <div className="grid gap-8 border-t border-white/10 pt-8 text-base leading-8 text-stone-400 sm:grid-cols-2 lg:border-t-0 lg:pt-0">
                        <p>
                            Sombre is built around the emotional architecture of
                            scent: softened rooms, evening fabric, polished
                            stone, and the feeling that remains after someone
                            has left.
                        </p>
                        <p>
                            The collection moves through perfume, body care, and
                            home fragrance with one sensibility, where every
                            object feels tactile, cinematic, and deeply
                            restrained.
                        </p>
                    </div>
                </div>
            </section>

            <section className="px-6 py-20 sm:px-10 sm:py-24 lg:px-12">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-12">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="space-y-4">
                            <p className="text-xs uppercase tracking-[0.36em] text-stone-500">
                                Featured Edit
                            </p>
                            <h2 className="max-w-3xl text-3xl font-medium tracking-[0.1em] text-stone-100 sm:text-4xl">
                                Three pieces chosen for skin, interior, and
                                ritual.
                            </h2>
                        </div>
                        <Link
                            href="/shop"
                            className="text-sm uppercase tracking-[0.28em] text-stone-500 transition-colors hover:text-stone-100"
                        >
                            View All
                        </Link>
                    </div>

                    <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
                        {featuredProducts.map((product, index) => (
                            <Link
                                key={product.slug}
                                href={`/products/${product.slug}`}
                                className={`group flex min-h-[20rem] flex-col justify-end rounded-[2.5rem] bg-[linear-gradient(180deg,rgba(87,83,78,0.08),rgba(20,18,17,0.02),rgba(20,18,17,0.82))] p-8 transition-colors hover:bg-[linear-gradient(180deg,rgba(87,83,78,0.12),rgba(20,18,17,0.04),rgba(20,18,17,0.9))] ${
                                    index === 0 ? "lg:min-h-[32rem]" : ""
                                }`}
                            >
                                <div className="space-y-4">
                                    <p className="text-xs uppercase tracking-[0.28em] text-stone-500">
                                        {product.meta}
                                    </p>
                                    <h3 className="text-2xl font-medium tracking-[0.08em] text-stone-100">
                                        {product.name}
                                    </h3>
                                    <p className="max-w-sm text-sm leading-7 text-stone-400">
                                        {product.description}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <section className="px-6 py-20 sm:px-10 sm:py-24 lg:px-12">
                <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-[0.36em] text-stone-500">
                            Discover
                        </p>
                        <h2 className="max-w-lg text-3xl font-medium leading-tight tracking-[0.1em] text-stone-100 sm:text-4xl">
                            A collection arranged by mood, ritual, and setting.
                        </h2>
                    </div>

                    <div className="grid gap-8 border-t border-white/10 pt-8 sm:grid-cols-3 lg:border-t-0 lg:pt-0">
                        {categories.map((category) => (
                            <Link
                                key={category.name}
                                href={category.href}
                                className="space-y-4 transition-colors hover:text-stone-100"
                            >
                                <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                                    Category
                                </p>
                                <h3 className="text-2xl font-medium tracking-[0.08em] text-stone-100">
                                    {category.name}
                                </h3>
                                <p className="text-sm leading-7 text-stone-400">
                                    {category.description}
                                </p>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <section className="px-6 py-20 sm:px-10 sm:py-24 lg:px-12">
                <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[1fr_1.05fr]">
                    <div className="min-h-[24rem] rounded-[2.75rem] bg-[linear-gradient(145deg,rgba(39,39,42,0.84),rgba(41,37,36,0.78),rgba(20,18,17,0.98))] p-8 sm:p-10">
                        <div className="flex h-full flex-col justify-between">
                            <div className="space-y-5">
                                <p className="text-xs uppercase tracking-[0.36em] text-stone-500">
                                    Ritual & Gifting
                                </p>
                                <h2 className="max-w-md text-3xl font-medium leading-tight tracking-[0.1em] text-stone-100 sm:text-4xl">
                                    Objects selected for the feeling they leave
                                    behind.
                                </h2>
                            </div>

                            <p className="max-w-lg text-base leading-8 text-stone-400">
                                Whether worn, lit, or gifted, each piece is
                                designed to feel intimate and deliberate rather
                                than merely decorative.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-8 sm:grid-cols-3">
                        {rituals.map((ritual) => (
                            <div
                                key={ritual.title}
                                className="space-y-4 border-t border-white/10 pt-5"
                            >
                                <h3 className="text-xl font-medium tracking-[0.08em] text-stone-100">
                                    {ritual.title}
                                </h3>
                                <p className="text-sm leading-7 text-stone-400">
                                    {ritual.text}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="px-6 pb-24 pt-8 sm:px-10 sm:pb-32 lg:px-12">
                <div className="mx-auto max-w-5xl border-t border-white/10 pt-12 text-center sm:pt-16">
                    <div className="space-y-6">
                        <p className="text-xs uppercase tracking-[0.36em] text-stone-500">
                            Enter the Collection
                        </p>
                        <h2 className="text-3xl font-medium leading-tight tracking-[0.12em] text-stone-100 sm:text-5xl">
                            Begin with scent. Stay for the atmosphere.
                        </h2>
                        <p className="mx-auto max-w-2xl text-base leading-8 text-stone-400">
                            Explore a quieter kind of luxury across perfume,
                            body care, and interior fragrance.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-5 pt-2">
                            <Link
                                href="/shop"
                                className="border-b border-white/30 pb-1 text-sm uppercase tracking-[0.28em] text-stone-100 transition-colors hover:border-white/60 hover:text-white"
                            >
                                Shop Sombre
                            </Link>
                            <Link
                                href="/brands"
                                className="text-sm uppercase tracking-[0.28em] text-stone-500 transition-colors hover:text-stone-100"
                            >
                                View Brand World
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
