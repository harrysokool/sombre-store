"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Orders owns `/admin` itself plus every order detail route; Coupons and
// Operations each own their own subtree. Orders matches `/admin` exactly rather
// than by prefix, and the three subtree prefixes are distinct
// (`/admin/orders`, `/admin/coupons`, `/admin/operations`), so at most one item
// is ever active.
const NAV_ITEMS = [
  {
    label: "Orders",
    href: "/admin",
    isActive: (pathname: string) =>
      pathname === "/admin" || pathname.startsWith("/admin/orders"),
  },
  {
    label: "Coupons",
    href: "/admin/coupons",
    isActive: (pathname: string) => pathname.startsWith("/admin/coupons"),
  },
  {
    label: "Operations",
    href: "/admin/operations",
    isActive: (pathname: string) => pathname.startsWith("/admin/operations"),
  },
] as const;

export function AdminNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Admin">
      <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {NAV_ITEMS.map((item) => {
          const isActive = item.isActive(pathname);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`text-xl font-medium tracking-[0.14em] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 sm:text-2xl ${
                  isActive ? "text-stone-100" : "text-stone-400"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
