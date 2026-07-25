// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mocks.usePathname,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { AdminNav } from "./admin-nav";

function renderAt(pathname: string) {
  mocks.usePathname.mockReturnValue(pathname);
  return render(<AdminNav />);
}

describe("AdminNav active link", () => {
  afterEach(() => {
    cleanup();
  });

  it("marks Orders active on the order list", () => {
    renderAt("/admin");

    const orders = screen.getByRole("link", { name: "Orders" });
    const coupons = screen.getByRole("link", { name: "Coupons" });

    expect(orders).toHaveAttribute("aria-current", "page");
    expect(coupons).not.toHaveAttribute("aria-current");
  });

  it("marks Orders active on an order detail route", () => {
    renderAt("/admin/orders/11111111-1111-4111-8111-111111111111");

    const orders = screen.getByRole("link", { name: "Orders" });
    const coupons = screen.getByRole("link", { name: "Coupons" });

    expect(orders).toHaveAttribute("aria-current", "page");
    expect(coupons).not.toHaveAttribute("aria-current");
  });

  it.each([
    ["/admin/coupons", "the coupons list"],
    ["/admin/coupons/new", "coupon create"],
    ["/admin/coupons/11111111-1111-4111-8111-111111111111", "coupon edit"],
  ])("marks Coupons active on %s (%s)", (pathname) => {
    renderAt(pathname);

    const orders = screen.getByRole("link", { name: "Orders" });
    const coupons = screen.getByRole("link", { name: "Coupons" });

    expect(coupons).toHaveAttribute("aria-current", "page");
    expect(orders).not.toHaveAttribute("aria-current");
  });

  it("never marks Orders active while on a coupon route", () => {
    renderAt("/admin/coupons/new");

    expect(
      screen.getByRole("link", { name: "Orders" }),
    ).not.toHaveAttribute("aria-current");
  });

  it.each([
    "/admin",
    "/admin/orders/11111111-1111-4111-8111-111111111111",
    "/admin/coupons",
    "/admin/coupons/new",
    "/admin/coupons/11111111-1111-4111-8111-111111111111",
  ])("keeps exactly one link active on %s", (pathname) => {
    renderAt(pathname);

    const active = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");

    expect(active).toHaveLength(1);
  });

  it("keeps both nav destinations and their labels regardless of route", () => {
    renderAt("/admin/coupons");

    expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(screen.getByRole("link", { name: "Coupons" })).toHaveAttribute(
      "href",
      "/admin/coupons",
    );
  });
});
