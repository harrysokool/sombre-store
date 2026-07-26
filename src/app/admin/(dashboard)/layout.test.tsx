// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminUser: vi.fn(),
  signOutAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  requireAdminUser: mocks.requireAdminUser,
}));

vi.mock("@/app/admin/actions", () => ({
  signOutAdmin: mocks.signOutAdmin,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import AdminDashboardLayout from "./layout";

describe("admin dashboard layout", () => {
  beforeEach(() => {
    mocks.requireAdminUser.mockReset();
    mocks.requireAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the shared navigation in a permanent 240px desktop sidebar", async () => {
    render(
      await AdminDashboardLayout({ children: <p>admin page body</p> }),
    );

    const sidebar = screen.getByRole("complementary", {
      name: "Admin sidebar",
    });
    const nav = within(sidebar).getByRole("navigation", {
      name: "Admin primary navigation",
    });

    expect(sidebar).toHaveClass(
      "sticky",
      "top-0",
      "hidden",
      "h-dvh",
      "w-60",
      "border-r",
      "lg:flex",
    );
    expect(sidebar.parentElement).toHaveClass(
      "overflow-x-clip",
      "lg:grid",
      "lg:grid-cols-[15rem_minmax(0,1fr)]",
    );

    const expectedDestinations = [
      ["Home", "/admin"],
      ["Orders", "/admin/orders"],
      ["Inventory", "/admin/inventory"],
      ["Coupons", "/admin/coupons"],
      ["Operations", "/admin/operations"],
    ];

    for (const [label, href] of expectedDestinations) {
      expect(within(nav).getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }
  });

  it("keeps account actions at the bottom and includes a safe store link", async () => {
    render(await AdminDashboardLayout({ children: <p>admin page body</p> }));

    const sidebar = screen.getByRole("complementary", {
      name: "Admin sidebar",
    });

    expect(within(sidebar).getByText("Signed in as")).toBeInTheDocument();
    expect(within(sidebar).getByText("admin@example.com")).toBeInTheDocument();
    expect(
      within(sidebar).getByRole("link", { name: "View store" }),
    ).toHaveAttribute("href", "/");
    expect(
      within(sidebar).getByRole("button", { name: "Sign Out" }),
    ).toBeInTheDocument();
  });

  it("renders a mobile header and keeps the content column shrinkable", async () => {
    render(await AdminDashboardLayout({ children: <p>admin page body</p> }));

    const mobileHeader = screen.getByRole("banner");
    const main = screen.getByRole("main");

    expect(mobileHeader).toHaveClass("lg:hidden");
    expect(
      within(mobileHeader).getByRole("button", {
        name: "Open admin navigation",
      }),
    ).toHaveAttribute("aria-controls", "admin-navigation-drawer");
    expect(within(mobileHeader).getByText("Home")).toBeInTheDocument();
    expect(main).toHaveClass("min-w-0");
    expect(main).toHaveTextContent("admin page body");
    expect(main.parentElement?.parentElement).toHaveClass("min-w-0");
  });

  it("renders no storefront navbar, search, cart, or footer", async () => {
    render(await AdminDashboardLayout({ children: <p>admin page body</p> }));

    expect(screen.queryByRole("contentinfo")).toBeNull();
    expect(screen.queryByRole("link", { name: "Sombre home" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Open navigation menu" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Open search" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Cart" })).toBeNull();

    for (const publicLink of [
      "/shop",
      "/cart",
      "/about",
      "/contact",
      "/terms",
      "/privacy-policy",
    ]) {
      expect(document.querySelector(`a[href="${publicLink}"]`)).toBeNull();
    }
  });

  it("does not use failing normal-text contrast classes in the new shell", async () => {
    const { container } = render(
      await AdminDashboardLayout({ children: <p>admin page body</p> }),
    );

    for (const element of container.querySelectorAll<HTMLElement>(
      '[class*="text-stone-"]',
    )) {
      expect(element.className).not.toContain("text-stone-500");
      expect(element.className).not.toContain("text-stone-600");
    }
  });

  it("checks admin eligibility before rendering any chrome", async () => {
    mocks.requireAdminUser.mockRejectedValue(
      new Error("redirect to admin login"),
    );

    await expect(
      AdminDashboardLayout({ children: <p>admin page body</p> }),
    ).rejects.toThrow("redirect to admin login");
  });
});
