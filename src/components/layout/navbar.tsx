import Link from "next/link";

const navigationItems = [
  { label: "Shop", href: "/shop" },
  { label: "Brands", href: "/brands" },
  { label: "About", href: "/about" },
  { label: "Cart", href: "/cart" },
  { label: "Login", href: "/login" },
];

function CartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d="M3.75 4.5h1.386c.51 0 .955.347 1.08.841l.355 1.409m0 0 1.02 4.044a1.125 1.125 0 0 0 1.09.849h7.819a1.125 1.125 0 0 0 1.09-.85l1.195-4.778H6.57Zm2.18 11.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm9 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
          <Link
            href="/cart"
            aria-label="Cart"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-stone-200 transition-colors hover:border-white/20 hover:text-stone-100"
          >
            <CartIcon />
          </Link>

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
