// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mocks.usePathname,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    ...props
  }: ComponentProps<"a">) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </a>
  ),
}));

import { AdminNav } from "./admin-nav";

function renderAt(
  pathname: string,
  props: ComponentProps<typeof AdminNav> = {},
) {
  mocks.usePathname.mockReturnValue(pathname);
  return render(<AdminNav {...props} />);
}

function navigation() {
  return screen.getByRole("navigation", { name: "Admin navigation" });
}

function getNavLinks() {
  const nav = within(navigation());

  return {
    home: nav.getByRole("link", { name: "Home" }),
    orders: nav.getByRole("link", { name: "Orders" }),
    inventory: nav.getByRole("link", { name: "Inventory" }),
    coupons: nav.getByRole("link", { name: "Coupons" }),
    operations: nav.getByRole("link", { name: "Operations" }),
  };
}

describe("AdminNav", () => {
  afterEach(() => {
    cleanup();
  });

  it.each([
    ["/admin", "Home"],
    ["/admin/", "Home"],
    ["/admin/orders", "Orders"],
    ["/admin/orders/11111111-1111-4111-8111-111111111111", "Orders"],
    ["/admin/inventory", "Inventory"],
    ["/admin/inventory/product-1", "Inventory"],
    ["/admin/coupons", "Coupons"],
    ["/admin/coupons/new", "Coupons"],
    ["/admin/coupons/11111111-1111-4111-8111-111111111111", "Coupons"],
    ["/admin/operations", "Operations"],
  ])("marks only %s's owning item active", (pathname, activeLabel) => {
    renderAt(pathname);

    const links = within(navigation()).getAllByRole("link");
    const activeLinks = links.filter(
      (link) => link.getAttribute("aria-current") === "page",
    );

    expect(activeLinks).toHaveLength(1);
    expect(activeLinks[0]).toHaveAccessibleName(activeLabel);
  });

  it("keeps Home exact and uses path-segment boundaries for sections", () => {
    renderAt("/admin/orders-archive");

    const { home, orders, inventory, coupons, operations } = getNavLinks();

    expect(home).not.toHaveAttribute("aria-current");
    expect(orders).not.toHaveAttribute("aria-current");
    expect(inventory).not.toHaveAttribute("aria-current");
    expect(coupons).not.toHaveAttribute("aria-current");
    expect(operations).not.toHaveAttribute("aria-current");
  });

  it("renders every destination and visible label in the shared renderer", () => {
    renderAt("/admin");

    const { home, orders, inventory, coupons, operations } = getNavLinks();

    expect(home).toHaveAttribute("href", "/admin");
    expect(orders).toHaveAttribute("href", "/admin/orders");
    expect(inventory).toHaveAttribute("href", "/admin/inventory");
    expect(coupons).toHaveAttribute("href", "/admin/coupons");
    expect(operations).toHaveAttribute("href", "/admin/operations");
  });

  it("uses shape and weight as well as colour for the active state", () => {
    renderAt("/admin/inventory");

    const { home, inventory } = getNavLinks();

    expect(inventory).toHaveClass(
      "border-stone-200",
      "bg-white/[0.08]",
      "font-medium",
    );
    expect(home).toHaveClass("border-transparent", "font-normal");
  });

  it("supports desktop and mobile sizing without changing destinations", () => {
    const { rerender } = renderAt("/admin/orders", {
      variant: "desktop",
    });
    const desktopHrefs = within(navigation())
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    rerender(<AdminNav variant="mobile" />);

    const mobileLinks = within(navigation()).getAllByRole("link");

    expect(mobileLinks.map((link) => link.getAttribute("href"))).toEqual(
      desktopHrefs,
    );
    expect(mobileLinks[0]).toHaveClass("min-h-12", "text-base");
  });

  it("accepts a specific accessible label and closes its owner on selection", () => {
    const onNavigate = vi.fn();

    renderAt("/admin", {
      ariaLabel: "Admin mobile navigation",
      onNavigate,
    });

    const nav = screen.getByRole("navigation", {
      name: "Admin mobile navigation",
    });
    fireEvent.click(within(nav).getByRole("link", { name: "Coupons" }));

    expect(onNavigate).toHaveBeenCalledOnce();
  });
});
