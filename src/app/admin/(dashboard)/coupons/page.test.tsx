// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
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

const BASE_COUPON = {
  id: COUPON_ID,
  code_normalized: "SOMBRE",
  is_active: true,
  starts_at: null,
  expires_at: null,
  created_at: "2026-07-24T00:00:00.000Z",
  updated_at: "2026-07-24T00:00:00.000Z",
  assigned_product_count: 2,
};

// Cards for small screens, the table from `lg` up. Assertions scope to one.
function mobileCards() {
  return within(screen.getByRole("list", { name: "Coupons" }));
}

function desktopTable() {
  return within(screen.getByRole("table", { name: "Coupons" }));
}

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
    mocks.listAdminCoupons.mockResolvedValue([BASE_COUPON]);

    render(await AdminCouponsPage());

    expect(
      screen.getByRole("heading", { name: "Coupons" }),
    ).toBeInTheDocument();
    expect(desktopTable().getByRole("link", { name: "SOMBRE" })).toHaveAttribute(
      "href",
      `/admin/coupons/${COUPON_ID}`,
    );
    expect(desktopTable().getByText("Active")).toBeInTheDocument();
    expect(desktopTable().getByText("2")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "New coupon" }),
    ).toHaveAttribute("href", "/admin/coupons/new");
  });

  it("stacks each coupon into a card for small screens", async () => {
    mocks.listAdminCoupons.mockResolvedValue([
      {
        ...BASE_COUPON,
        starts_at: "2026-07-24T20:00:00.000Z",
        expires_at: "2026-08-24T20:00:00.000Z",
      },
    ]);

    render(await AdminCouponsPage());

    const card = within(mobileCards().getAllByRole("listitem")[0]);

    // Code, status, dates, and assigned-product count.
    expect(card.getByRole("link", { name: "SOMBRE" })).toHaveAttribute(
      "href",
      `/admin/coupons/${COUPON_ID}`,
    );
    expect(card.getByText("Active")).toBeInTheDocument();
    expect(card.getByText("Starts")).toBeInTheDocument();
    // 20:00Z on 24 July is already 25 July in Hong Kong.
    expect(card.getByText(/25 Jul 2026/)).toBeInTheDocument();
    expect(card.getByText("Expires")).toBeInTheDocument();
    expect(card.getByText(/25 Aug 2026/)).toBeInTheDocument();
    expect(card.getByText("Assigned products")).toBeInTheDocument();
    expect(card.getByText("2")).toBeInTheDocument();
  });

  it("hides the cards at desktop widths and the table below them", async () => {
    mocks.listAdminCoupons.mockResolvedValue([BASE_COUPON]);

    render(await AdminCouponsPage());

    expect(screen.getByRole("list", { name: "Coupons" })).toHaveClass(
      "lg:hidden",
    );
    expect(
      screen.getByRole("table", { name: "Coupons" }).parentElement,
    ).toHaveClass("hidden", "lg:block");
  });

  it("keeps the desktop table with a row per coupon", async () => {
    mocks.listAdminCoupons.mockResolvedValue([
      BASE_COUPON,
      {
        ...BASE_COUPON,
        id: "22222222-2222-4222-8222-222222222222",
        code_normalized: "ARCHIVE",
        is_active: false,
        assigned_product_count: 0,
      },
    ]);

    render(await AdminCouponsPage());

    const table = desktopTable();

    for (const header of [
      "Code",
      "Status",
      "Starts",
      "Expires",
      "Assigned products",
    ]) {
      expect(
        table.getByRole("columnheader", { name: header }),
      ).toBeInTheDocument();
    }

    expect(table.getAllByRole("row")).toHaveLength(3);
    expect(table.getByRole("link", { name: "ARCHIVE" })).toHaveAttribute(
      "href",
      "/admin/coupons/22222222-2222-4222-8222-222222222222",
    );
    // Both dates unset on the second coupon, so an em dash stands in.
    expect(table.getAllByText("—").length).toBeGreaterThanOrEqual(4);
  });

  it("tones active and inactive coupons while keeping the words readable", async () => {
    mocks.listAdminCoupons.mockResolvedValue([
      BASE_COUPON,
      {
        ...BASE_COUPON,
        id: "22222222-2222-4222-8222-222222222222",
        code_normalized: "ARCHIVE",
        is_active: false,
      },
    ]);

    render(await AdminCouponsPage());

    expect(desktopTable().getByText("Active")).toHaveAttribute(
      "data-tone",
      "success",
    );
    expect(desktopTable().getByText("Inactive")).toHaveAttribute(
      "data-tone",
      "neutral",
    );
    expect(mobileCards().getByText("Inactive")).toHaveAttribute(
      "data-tone",
      "neutral",
    );
  });

  it("wraps a long coupon code instead of forcing horizontal scroll", async () => {
    const longCode = "SUMMER-CLEARANCE-EXTRA-LONG-CODE";

    mocks.listAdminCoupons.mockResolvedValue([
      { ...BASE_COUPON, code_normalized: longCode },
    ]);

    render(await AdminCouponsPage());

    expect(mobileCards().getByRole("link", { name: longCode })).toHaveClass(
      "break-words",
      "[overflow-wrap:anywhere]",
    );
    expect(
      desktopTable().getByRole("link", { name: longCode }).closest("td"),
    ).toHaveClass("break-words", "[overflow-wrap:anywhere]");
  });

  it("renders neither presentation when there are no coupons", async () => {
    mocks.listAdminCoupons.mockResolvedValue([]);

    render(await AdminCouponsPage());

    expect(screen.getByText("No coupons yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("list", { name: "Coupons" })).toBeNull();
  });
});
