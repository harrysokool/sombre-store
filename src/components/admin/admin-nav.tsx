"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  adminNavigation,
  isAdminNavigationItemActive,
} from "@/components/admin/admin-navigation";

type AdminNavProps = {
  variant?: "desktop" | "mobile";
  ariaLabel?: string;
  onNavigate?: () => void;
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-200/50 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950";

export function AdminNav({
  variant = "desktop",
  ariaLabel = "Admin navigation",
  onNavigate,
}: AdminNavProps) {
  const pathname = usePathname() ?? "";
  const linkSize =
    variant === "mobile"
      ? "min-h-12 px-4 py-3 text-base"
      : "min-h-11 px-3 py-2.5 text-sm";

  return (
    <nav aria-label={ariaLabel} className="min-w-0">
      {adminNavigation.map((group) => (
        <div key={group.id}>
          {group.label ? (
            <p className="mb-2 px-3 text-xs uppercase tracking-[0.2em] text-stone-400">
              {group.label}
            </p>
          ) : null}

          <ul className="space-y-1">
            {group.items.map((item) => {
              const isActive = isAdminNavigationItemActive(item, pathname);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={onNavigate}
                    className={`group flex w-full items-center gap-3 rounded-lg border-l-2 tracking-[0.02em] transition-colors ${linkSize} ${focusRing} ${
                      isActive
                        ? "border-stone-200 bg-white/[0.08] font-medium text-stone-100"
                        : "border-transparent font-normal text-stone-300 hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    {Icon ? (
                      <Icon
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0"
                      />
                    ) : null}
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
