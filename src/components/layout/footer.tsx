import Link from "next/link";

const footerLinks = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Shop", href: "/shop" },
];

const policyLinks = [
  { label: "Shipping Policy", href: "/shipping-policy" },
  { label: "Return and Refund Policy", href: "/refund-policy" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms and Conditions", href: "/terms" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto w-full max-w-7xl px-6 py-16 text-sm text-stone-400 sm:px-10 sm:py-20 lg:px-12">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-4">
            <p className="font-display text-2xl font-normal tracking-[0.3em] text-stone-100">
              Sombre
            </p>
            <p className="max-w-sm leading-7 text-stone-500">
              A curated store for perfume, body care, and home fragrance from
              luxury and independent brands.
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="flex flex-wrap gap-x-8 gap-y-3 text-xs uppercase tracking-[0.22em] text-stone-300"
          >
            {footerLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="transition-colors hover:text-stone-100"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <nav
          aria-label="Store policies"
          className="mt-14 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-8 text-[0.7rem] uppercase tracking-[0.18em] text-stone-500"
        >
          {policyLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="transition-colors hover:text-stone-300"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
