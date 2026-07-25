// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminUser: vi.fn(),
  listAdminCoupons: vi.fn(),
}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  requireAdminUser: mocks.requireAdminUser,
}));

vi.mock("@/lib/admin/coupons", () => ({
  listAdminCoupons: mocks.listAdminCoupons,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import AdminCouponsPage from "./page";

const COUPON_ID = "11111111-1111-4111-8111-111111111111";

describe("admin coupon list page", () => {
  beforeEach(() => {
    mocks.requireAdminUser.mockReset();
    mocks.listAdminCoupons.mockReset();
    mocks.requireAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("checks admin authentication before reading coupons", async () => {
    mocks.requireAdminUser.mockRejectedValue(
      new Error("redirect to admin login"),
    );

    await expect(AdminCouponsPage()).rejects.toThrow(
      "redirect to admin login",
    );
    expect(mocks.listAdminCoupons).not.toHaveBeenCalled();
  });

  it("lists saved coupons, status, assignment count, and edit link", async () => {
    mocks.listAdminCoupons.mockResolvedValue([
      {
        id: COUPON_ID,
        code_normalized: "SOMBRE",
        is_active: true,
        starts_at: null,
        expires_at: null,
        created_at: "2026-07-24T00:00:00.000Z",
        updated_at: "2026-07-24T00:00:00.000Z",
        assigned_product_count: 2,
      },
    ]);

    render(await AdminCouponsPage());

    expect(
      screen.getByRole("heading", { name: "Coupons" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SOMBRE" })).toHaveAttribute(
      "href",
      `/admin/coupons/${COUPON_ID}`,
    );
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "New coupon" }),
    ).toHaveAttribute("href", "/admin/coupons/new");
  });
});
