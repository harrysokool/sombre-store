const footerLinks = ["Privacy", "Contact", "Journal"];

export function Footer() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 text-sm text-stone-400 sm:flex-row sm:items-end sm:justify-between sm:px-10 lg:px-12">
        <div className="space-y-2">
          <p className="text-base font-medium uppercase tracking-[0.28em] text-stone-100">
            Sombre
          </p>
          <p className="max-w-sm leading-6">
            A minimal foundation for elevated fragrance and lifestyle retail.
          </p>
        </div>

        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-x-6 gap-y-2 text-stone-300"
        >
          {footerLinks.map((link) => (
            <a
              key={link}
              href="#"
              className="transition-colors hover:text-stone-100"
            >
              {link}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
