export default function Home() {
  return (
    <section className="flex items-center justify-center px-6 py-24 sm:px-10 sm:py-32 lg:px-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 text-center">
        <p className="text-xs uppercase tracking-[0.36em] text-stone-400">
          Luxury E-commerce
        </p>
        <h1 className="text-5xl font-medium tracking-[0.18em] text-stone-100 sm:text-7xl">
          Sombre
        </h1>
        <p className="max-w-2xl text-base leading-8 text-stone-300 sm:text-lg">
          Curated luxury fragrances and lifestyle products
        </p>
      </div>
    </section>
  );
}
