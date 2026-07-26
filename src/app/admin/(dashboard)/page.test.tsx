// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminHomeData } from "@/lib/admin/home-data";

const mocks = vi.hoisted(() => ({
  loadAdminHomeData: vi.fn(),
  requireAdminUser: vi.fn(),
}));

vi.mock("@/lib/admin/home-data", () => ({
  loadAdminHomeData: mocks.loadAdminHomeData,
}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  requireAdminUser: mocks.requireAdminUser,
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

import AdminHomePage, { metadata } from "./page";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const FAILURE_ORDER_ID = "22222222-2222-4222-8222-222222222222";

function homeData(): AdminHomeData {
  return {
    dayBounds: {
      startInclusive: "2026-07-24T16:00:00.000Z",
      endExclusive: "2026-07-25T16:00:00.000Z",
    },
    summary: {
      ordersToday: { value: 7, hasError: false },
      revenueTodayCents: { value: 234_567, hasError: false },
      awaitingFulfilment: { value: 3, hasError: false },
      lowStockProducts: { value: 2, hasError: false },
      outOfStockProducts: { value: 1, hasError: false },
    },
    recentOrders: {
      hasError: false,
      items: [
        {
          id: ORDER_ID,
          created_at: "2026-07-24T20:30:00.000Z",
          customer_name:
            "A Customer With A Deliberately Long Name That Still Wraps",
          customer_email:
            "a.deliberately.long.address@a-very-long-domain.example.com",
          total: "1650.00",
          currency: "hkd",
          payment_status: "paid",
          order_status: "confirmed",
          fulfilment_status: "unfulfilled",
        },
      ],
    },
    recentFailures: {
      hasError: false,
      items: [
        {
          source: "webhook",
          id: "failure-1",
          orderId: FAILURE_ORDER_ID,
          title: "checkout.session.completed",
          status: "permanent",
          occurredAt: "2026-07-24T21:00:00.000Z",
        },
      ],
    },
  };
}

describe("Admin Home page", () => {
  beforeEach(() => {
    mocks.requireAdminUser.mockReset();
    mocks.loadAdminHomeData.mockReset();
    mocks.requireAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
    mocks.loadAdminHomeData.mockResolvedValue(homeData());
  });

  afterEach(() => {
    cleanup();
  });

  it("makes /admin the Home dashboard rather than the order list", async () => {
    render(await AdminHomePage());

    expect(metadata).toEqual({ title: "Home" });
    expect(
      screen.getByRole("heading", { level: 1, name: "Home" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Orders" }),
    ).toBeNull();
    expect(screen.queryByRole("table", { name: "Orders" })).toBeNull();
  });

  it("checks the admin session before loading protected dashboard data", async () => {
    mocks.requireAdminUser.mockRejectedValue(
      new Error("redirect to admin login"),
    );

    await expect(AdminHomePage()).rejects.toThrow("redirect to admin login");
    expect(mocks.loadAdminHomeData).not.toHaveBeenCalled();
  });

  it("renders all five summary values and their exact definitions", async () => {
    render(await AdminHomePage());

    const summary = within(screen.getByLabelText("Admin Home summary"));

    expect(summary.getByText("Orders today")).toBeInTheDocument();
    expect(summary.getByText("7")).toBeInTheDocument();
    expect(summary.getByText("Revenue today")).toBeInTheDocument();
    expect(summary.getByText("HK$2,345.67")).toBeInTheDocument();
    expect(
      summary.getByText(
        "Normal confirmed HKD sales, excluding every order with a recorded refund.",
      ),
    ).toBeInTheDocument();
    expect(summary.getByText("Orders awaiting fulfilment")).toBeInTheDocument();
    expect(summary.getByText("3")).toBeInTheDocument();
    expect(summary.getByText("Low stock products")).toBeInTheDocument();
    expect(summary.getByText("2")).toBeInTheDocument();
    expect(
      summary.getByText("Products with 1–5 units remaining."),
    ).toBeInTheDocument();
    expect(summary.getByText("Out of stock products")).toBeInTheDocument();
    expect(summary.getByText("1")).toBeInTheDocument();
  });

  it("links recent orders and formats their dates in Hong Kong time", async () => {
    render(await AdminHomePage());

    const recentOrders = within(
      screen.getByRole("list", { name: "Recent orders" }),
    );
    const orderLink = recentOrders.getByRole("link", {
      name: `Open order ${ORDER_ID}`,
    });

    expect(orderLink).toHaveAttribute("href", `/admin/orders/${ORDER_ID}`);
    expect(recentOrders.getByText("HK$1,650.00")).toBeInTheDocument();
    expect(recentOrders.getByText(/25 Jul 2026/)).toBeInTheDocument();
    expect(recentOrders.getByText("Paid")).toBeInTheDocument();
    expect(recentOrders.getByText("Unfulfilled")).toBeInTheDocument();

    const email = recentOrders.getByText(
      "a.deliberately.long.address@a-very-long-domain.example.com",
    );
    expect(email).toHaveClass("break-words", "[overflow-wrap:anywhere]");
  });

  it("shows recent operational issues with a safe related-order link", async () => {
    render(await AdminHomePage());

    const issues = within(
      screen.getByRole("list", { name: "Recent operational issues" }),
    );

    expect(
      issues.getByText("Checkout.session.completed"),
    ).toBeInTheDocument();
    expect(issues.getByText("Permanent")).toBeInTheDocument();
    expect(
      issues.getByRole("link", {
        name: `Open related order ${FAILURE_ORDER_ID}`,
      }),
    ).toHaveAttribute(
      "href",
      `/admin/orders/${FAILURE_ORDER_ID}`,
    );
  });

  it("shows understandable empty states for both recent lists", async () => {
    const data = homeData();
    data.recentOrders.items = [];
    data.recentFailures.items = [];
    mocks.loadAdminHomeData.mockResolvedValue(data);

    render(await AdminHomePage());

    expect(screen.getByText("No recent orders.")).toBeInTheDocument();
    expect(
      screen.getByText("No recent operational issues."),
    ).toBeInTheDocument();
  });

  it("does not turn failed summary or activity queries into misleading zeroes", async () => {
    const data = homeData();
    data.summary.revenueTodayCents = { value: null, hasError: true };
    data.recentOrders = { items: [], hasError: true };
    data.recentFailures = { items: [], hasError: true };
    mocks.loadAdminHomeData.mockResolvedValue(data);

    render(await AdminHomePage());

    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("This metric could not be loaded. Try again."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Recent orders could not be loaded. Please try again.",
      ),
    ).toHaveAttribute("role", "status");
    expect(
      screen.getByText(
        "Recent operational issues could not be loaded. Please try again.",
      ),
    ).toHaveAttribute("role", "status");
  });

  it("keeps available operational results visible when only one source fails", async () => {
    const data = homeData();
    data.recentFailures.hasError = true;
    mocks.loadAdminHomeData.mockResolvedValue(data);

    render(await AdminHomePage());

    expect(
      screen.getByText(
        "Some operational issues could not be loaded. Available items are shown below.",
      ),
    ).toHaveAttribute("role", "status");
    expect(
      screen.getByRole("list", { name: "Recent operational issues" }),
    ).toBeInTheDocument();
  });

  it("provides every requested quick action at its migrated route", async () => {
    render(await AdminHomePage());

    const actions = within(
      screen.getByRole("navigation", { name: "Admin quick actions" }),
    );

    expect(actions.getByRole("link", { name: /View orders/ })).toHaveAttribute(
      "href",
      "/admin/orders",
    );
    expect(
      actions.getByRole("link", { name: /View inventory/ }),
    ).toHaveAttribute("href", "/admin/inventory");
    expect(actions.getByRole("link", { name: /View coupons/ })).toHaveAttribute(
      "href",
      "/admin/coupons",
    );
    expect(
      actions.getByRole("link", { name: /View operations/ }),
    ).toHaveAttribute("href", "/admin/operations");
  });

  it("keeps normal dark-background copy off low-contrast stone 500 and 600", async () => {
    const { container } = render(await AdminHomePage());

    expect(container.querySelector('[class*="text-stone-500"]')).toBeNull();
    expect(container.querySelector('[class*="text-stone-600"]')).toBeNull();
  });
});
