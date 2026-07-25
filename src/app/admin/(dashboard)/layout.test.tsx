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

  it("keeps the admin dashboard navigation", async () => {
    render(
      await AdminDashboardLayout({ children: <p>admin page body</p> }),
    );

    const nav = screen.getByRole("navigation", { name: "Admin" });

    expect(within(nav).getByRole("link", { name: "Orders" })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(within(nav).getByRole("link", { name: "Coupons" })).toHaveAttribute(
      "href",
      "/admin/coupons",
    );
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    expect(
      within(screen.getByRole("main")).getByText("admin page body"),
    ).toBeInTheDocument();
  });

  it("renders no storefront navbar, drawer, search, or footer", async () => {
    render(await AdminDashboardLayout({ children: <p>admin page body</p> }));

    expect(screen.queryByRole("contentinfo")).toBeNull();
    expect(screen.queryByRole("link", { name: "Sombre home" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Open navigation menu" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Open search" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Cart" })).toBeNull();
    // Storefront-only destinations that appear in the public navbar drawer and
    // footer, and must not be reachable from admin chrome.
    for (const publicLink of [
      "/shop",
      "/cart",
      "/about",
      "/contact",
      "/terms",
      "/privacy-policy",
    ]) {
      expect(
        document.querySelector(`a[href="${publicLink}"]`),
      ).toBeNull();
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
