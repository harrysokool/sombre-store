import {
  Activity,
  ClipboardList,
  House,
  Megaphone,
  Package,
  TicketPercent,
} from "lucide-react";
import { describe, expect, it } from "vitest";

import {
  adminNavigation,
  adminNavigationItems,
  getActiveAdminNavigationItem,
  isAdminNavigationItemActive,
} from "./admin-navigation";

describe("admin navigation configuration", () => {
  it("contains every current destination exactly once in one flat group", () => {
    expect(adminNavigation).toHaveLength(1);
    expect(adminNavigation[0].label).toBeUndefined();
    expect(
      adminNavigationItems.map(({ label, href }) => ({ label, href })),
    ).toEqual([
      { label: "Home", href: "/admin" },
      { label: "Orders", href: "/admin/orders" },
      { label: "Inventory", href: "/admin/inventory" },
      { label: "Coupons", href: "/admin/coupons" },
      { label: "Announcements", href: "/admin/announcements" },
      { label: "Operations", href: "/admin/operations" },
    ]);
    expect(new Set(adminNavigationItems.map((item) => item.href)).size).toBe(
      adminNavigationItems.length,
    );
  });

  it("assigns an icon to every item while retaining visible text", () => {
    expect(
      adminNavigationItems.map(({ label, icon }) => ({ label, icon })),
    ).toEqual([
      { label: "Home", icon: House },
      { label: "Orders", icon: ClipboardList },
      { label: "Inventory", icon: Package },
      { label: "Coupons", icon: TicketPercent },
      { label: "Announcements", icon: Megaphone },
      { label: "Operations", icon: Activity },
    ]);
  });

  it.each([
    ["/admin", "Home"],
    ["/admin/", "Home"],
    ["/admin/orders", "Orders"],
    ["/admin/orders/order-1", "Orders"],
    ["/admin/inventory/product-1", "Inventory"],
    ["/admin/coupons/new", "Coupons"],
    ["/admin/announcements", "Announcements"],
    ["/admin/operations", "Operations"],
  ])("resolves %s to %s", (pathname, expectedLabel) => {
    expect(getActiveAdminNavigationItem(pathname)?.label).toBe(expectedLabel);
  });

  it("does not let Home or similarly named prefixes match another section", () => {
    const home = adminNavigationItems[0];
    const orders = adminNavigationItems[1];

    expect(isAdminNavigationItemActive(home, "/admin/orders")).toBe(false);
    expect(
      isAdminNavigationItemActive(orders, "/admin/orders-archive"),
    ).toBe(false);
    expect(getActiveAdminNavigationItem("/admin/unknown")).toBeUndefined();
  });
});
