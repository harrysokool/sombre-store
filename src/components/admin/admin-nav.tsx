"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  adminNavigation,
  isAdminNavigationItemActive,
} from "@/components/admin/admin-navigation";

type AdminNavProps = {
  variant?: "desktop" | "mobile";
  collapsed?: boolean;
  ariaLabel?: string;
  onNavigate?: () => void;
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-200/50 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950";

export function AdminNav({
  variant = "desktop",
  collapsed = false,
  ariaLabel = "Admin navigation",
  onNavigate,
}: AdminNavProps) {
  const pathname = usePathname() ?? "";
  const isCollapsed = variant === "desktop" && collapsed;
  const linkSize =
    variant === "mobile"
      ? "min-h-12 px-4 py-3 text-base"
      : isCollapsed
        ? "min-h-11 justify-center px-2 py-2.5 text-sm"
        : "min-h-11 px-3 py-2.5 text-sm";

  return (
    <nav aria-label={ariaLabel} className="min-w-0">
      {adminNavigation.map((group) => (
        <div key={group.id}>
          {group.label ? (
            <p
              className={
                isCollapsed
                  ? "sr-only"
                  : "mb-2 px-3 text-xs uppercase tracking-[0.2em] text-stone-400"
              }
            >
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
                    title={isCollapsed ? item.label : undefined}
                    onClick={onNavigate}
                    className={`group flex w-full items-center rounded-lg tracking-[0.02em] transition-colors ${isCollapsed ? "gap-0" : "gap-3"} ${linkSize} ${focusRing} ${
                      isActive
                        ? "bg-white/[0.08] font-medium text-stone-100"
                        : "font-normal text-stone-300 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    {variant === "desktop" ? (
                      <Icon
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0"
                        strokeWidth={isActive ? 2.25 : 1.75}
                      />
                    ) : null}
                    <span className={isCollapsed ? "sr-only" : undefined}>
                      {item.label}
                    </span>
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
