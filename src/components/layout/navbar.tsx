import Link from "next/link";

import { NavbarCartIndicator } from "@/components/cart/navbar-cart-indicator";

const navigationItems = [
  { label: "Shop", href: "/shop" },
  { label: "Brands", href: "/brands" },
  { label: "About", href: "/about" },
];

export function Navbar() {
  return (
    <header className="border-b border-white/10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-5 sm:px-10 md:flex-row md:items-center md:justify-between lg:px-12">
        <Link
          href="/"
          className="text-sm font-medium uppercase tracking-[0.32em] text-stone-100"
        >
          Sombre
        </Link>

        <nav
          aria-label="Primary"
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-stone-300 md:flex-1"
        >
          {navigationItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="transition-colors hover:text-stone-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 self-center sm:gap-4 md:self-auto">
          <NavbarCartIndicator />

          <Link
            href="/login"
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-stone-100 transition-colors hover:border-white/20 hover:bg-white/5"
          >
            Login
          </Link>
        </div>
      </div>
    </header>
  );
}
