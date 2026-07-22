import Link from "next/link";

type ShopNavLink = {
  label: string;
  href: string;
  isActive: boolean;
};

type ShopCategoryNavProps = {
  categoryLinks: ShopNavLink[];
  brandLinks: ShopNavLink[];
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950";

export function ShopCategoryNav({
  categoryLinks,
  brandLinks,
}: ShopCategoryNavProps) {
  return (
    <div className="space-y-5">
      {/* Scrolls rather than wraps on narrow screens, so the row stays a single
          line of text instead of collapsing into a block of links. */}
      <nav
        aria-label="Product categories"
        className="flex justify-start gap-8 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:justify-center sm:gap-10 [&::-webkit-scrollbar]:hidden"
      >
        {categoryLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={link.isActive ? "page" : undefined}
            className={`shrink-0 border-b pb-2 text-xs uppercase tracking-[0.22em] transition-colors ${focusRing} ${
              link.isActive
                ? "border-stone-300 text-stone-100"
                : "border-transparent text-stone-500 hover:text-stone-200"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {brandLinks.length > 0 ? (
        <nav
          aria-label="Brands"
          className="flex justify-start gap-6 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:justify-center sm:gap-8 [&::-webkit-scrollbar]:hidden"
        >
          {brandLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.isActive ? "page" : undefined}
              className={`shrink-0 text-[0.7rem] tracking-[0.16em] transition-colors ${focusRing} ${
                link.isActive
                  ? "text-stone-300"
                  : "text-stone-600 hover:text-stone-400"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
