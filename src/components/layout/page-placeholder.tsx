type PagePlaceholderProps = {
  eyebrow?: string;
  title: string;
};

export function PagePlaceholder({
  eyebrow = "Sombre",
  title,
}: PagePlaceholderProps) {
  return (
    <section className="flex min-h-[calc(100vh-169px)] items-center justify-center px-6 py-24 sm:px-10 lg:px-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-5 text-center">
        <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
          {eyebrow}
        </p>
        <h1 className="text-4xl font-medium tracking-[0.16em] text-stone-100 sm:text-6xl">
          {title}
        </h1>
      </div>
    </section>
  );
}
