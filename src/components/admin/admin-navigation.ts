import {
  Activity,
  ClipboardList,
  House,
  Megaphone,
  Package,
  TicketPercent,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type AdminNavigationIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type AdminNavigationItem = Readonly<{
  label: string;
  href: `/admin${string}`;
  match: "exact" | "section";
  icon: AdminNavigationIcon;
}>;

export type AdminNavigationGroup = Readonly<{
  id: string;
  /**
   * Current navigation stays deliberately flat. A future group can opt into a
   * visible label without changing either the desktop or mobile renderer.
   */
  label?: string;
  items: readonly AdminNavigationItem[];
}>;

/**
 * One unlabeled group keeps the current navigation flat. The group structure
 * lets the sidebar grow later without replacing its renderers or data shape.
 */
export const adminNavigation: readonly AdminNavigationGroup[] = [
  {
    id: "primary",
    items: [
      {
        label: "Home",
        href: "/admin",
        match: "exact",
        icon: House,
      },
      {
        label: "Orders",
        href: "/admin/orders",
        match: "section",
        icon: ClipboardList,
      },
      {
        label: "Inventory",
        href: "/admin/inventory",
        match: "section",
        icon: Package,
      },
      {
        label: "Coupons",
        href: "/admin/coupons",
        match: "section",
        icon: TicketPercent,
      },
      {
        label: "Announcements",
        href: "/admin/announcements",
        match: "section",
        icon: Megaphone,
      },
      {
        label: "Operations",
        href: "/admin/operations",
        match: "section",
        icon: Activity,
      },
    ],
  },
];

export const adminNavigationItems: readonly AdminNavigationItem[] =
  adminNavigation.flatMap((group) => group.items);

function normalizePathname(pathname: string) {
  if (pathname.length <= 1) {
    return pathname;
  }

  return pathname.replace(/\/+$/, "");
}

export function isAdminNavigationItemActive(
  item: AdminNavigationItem,
  pathname: string,
) {
  const normalizedPathname = normalizePathname(pathname);

  if (item.match === "exact") {
    return normalizedPathname === item.href;
  }

  return (
    normalizedPathname === item.href ||
    normalizedPathname.startsWith(`${item.href}/`)
  );
}

export function getActiveAdminNavigationItem(pathname: string) {
  return adminNavigationItems.find((item) =>
    isAdminNavigationItemActive(item, pathname),
  );
}
