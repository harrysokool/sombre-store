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
      <div className="mx-auto w-full max-w-7xl px-6 py-10 text-sm text-stone-400 sm:px-10 lg:px-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-base font-medium uppercase tracking-[0.28em] text-stone-100">
              Sombre
            </p>
            <p className="max-w-sm leading-6">
              A curated store for perfume, body care, and home fragrance from
              luxury and independent brands.
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="flex flex-wrap gap-x-6 gap-y-2 text-stone-300"
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
          className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-6 text-xs text-stone-500"
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
