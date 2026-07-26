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
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
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

function allClearHomeData(): AdminHomeData {
  const data = homeData();
  data.summary.awaitingFulfilment = { value: 0, hasError: false };
  data.summary.lowStockProducts = { value: 0, hasError: false };
  data.summary.outOfStockProducts = { value: 0, hasError: false };
  data.recentFailures = { items: [], hasError: false };
  return data;
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

  it("renders all five summary values and their exact definitions in one connected overview", async () => {
    render(await AdminHomePage());

    const summary = within(screen.getByLabelText("Admin Home summary"));

    expect(summary.getByText("Revenue today")).toBeInTheDocument();
    expect(summary.getByText("HK$2,345.67")).toBeInTheDocument();
    expect(
      summary.getByText(
        "Normal confirmed HKD sales, excluding every order with a recorded refund.",
      ),
    ).toBeInTheDocument();

    expect(summary.getByText("Orders today")).toBeInTheDocument();
    expect(summary.getByText("7")).toBeInTheDocument();
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

  it("does not turn a failed summary query into a misleading zero", async () => {
    const data = homeData();
    data.summary.revenueTodayCents = { value: null, hasError: true };
    mocks.loadAdminHomeData.mockResolvedValue(data);

    render(await AdminHomePage());

    const summary = within(screen.getByLabelText("Admin Home summary"));
    expect(summary.getByText("Unavailable")).toBeInTheDocument();
    expect(
      summary.getByText("This metric could not be loaded. Try again."),
    ).toBeInTheDocument();
  });

  it("shows a Needs attention row for every non-zero condition, each linking to the correct page", async () => {
    render(await AdminHomePage());

    const tasks = within(screen.getByRole("list", { name: "Needs attention" }));

    const awaiting = tasks.getByRole("link", {
      name: /^Orders awaiting fulfilment: 3\./,
    });
    expect(awaiting).toHaveAttribute("href", "/admin/orders");

    const lowStock = tasks.getByRole("link", {
      name: /^Low stock products: 2\./,
    });
    expect(lowStock).toHaveAttribute(
      "href",
      "/admin/inventory?stock=low-stock",
    );

    const outOfStock = tasks.getByRole("link", {
      name: /^Out of stock products: 1\./,
    });
    expect(outOfStock).toHaveAttribute(
      "href",
      "/admin/inventory?stock=out-of-stock",
    );

    const operational = tasks.getByRole("link", {
      name: /^Operational issues: 1\./,
    });
    expect(operational).toHaveAttribute("href", "/admin/operations");
  });

  it("hides zero-count tasks and shows one calm all-clear state when nothing needs attention", async () => {
    mocks.loadAdminHomeData.mockResolvedValue(allClearHomeData());

    render(await AdminHomePage());

    expect(
      screen.queryByRole("list", { name: "Needs attention" }),
    ).toBeNull();
    expect(
      screen.getByText("All clear — nothing needs attention right now."),
    ).toHaveAttribute("role", "status");
  });

  it("does not render a success row for every zero-count condition", async () => {
    const data = allClearHomeData();
    data.summary.awaitingFulfilment = { value: 3, hasError: false };
    mocks.loadAdminHomeData.mockResolvedValue(data);

    render(await AdminHomePage());

    const tasks = within(screen.getByRole("list", { name: "Needs attention" }));
    expect(tasks.getAllByRole("link")).toHaveLength(1);
    expect(
      tasks.queryByText(/Low stock products/),
    ).toBeNull();
    expect(
      tasks.queryByText(/Out of stock products/),
    ).toBeNull();
    expect(tasks.queryByText(/Operational issues/)).toBeNull();
  });

  it("shows an unavailable Needs attention row instead of hiding a failed check as zero", async () => {
    const data = allClearHomeData();
    data.summary.awaitingFulfilment = { value: null, hasError: true };
    mocks.loadAdminHomeData.mockResolvedValue(data);

    render(await AdminHomePage());

    const tasks = within(screen.getByRole("list", { name: "Needs attention" }));
    expect(
      tasks.getByRole("link", {
        name: /^Orders awaiting fulfilment: unavailable\./,
      }),
    ).toHaveAttribute("href", "/admin/orders");
    expect(
      screen.queryByText("All clear — nothing needs attention right now."),
    ).toBeNull();
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

  it("shows understandable empty and error states for recent orders", async () => {
    const data = homeData();
    data.recentOrders.items = [];
    mocks.loadAdminHomeData.mockResolvedValue(data);

    render(await AdminHomePage());
    expect(screen.getByText("No recent orders.")).toBeInTheDocument();
    cleanup();

    const errorData = homeData();
    errorData.recentOrders = { items: [], hasError: true };
    mocks.loadAdminHomeData.mockResolvedValue(errorData);

    render(await AdminHomePage());
    expect(
      screen.getByText("Recent orders could not be loaded. Please try again."),
    ).toHaveAttribute("role", "status");
  });

  it("shows Recent operational issues with a safe related-order link only when there are real issues", async () => {
    render(await AdminHomePage());

    const issues = within(
      screen.getByRole("list", { name: "Recent operational issues" }),
    );

    expect(issues.getByText("Checkout.session.completed")).toBeInTheDocument();
    expect(issues.getByText("Permanent")).toBeInTheDocument();
    expect(
      issues.getByRole("link", {
        name: `Open related order ${FAILURE_ORDER_ID}`,
      }),
    ).toHaveAttribute("href", `/admin/orders/${FAILURE_ORDER_ID}`);
  });

  it("omits the Recent operational issues section entirely when there is nothing to show", async () => {
    mocks.loadAdminHomeData.mockResolvedValue(allClearHomeData());

    render(await AdminHomePage());

    expect(
      screen.queryByRole("list", { name: "Recent operational issues" }),
    ).toBeNull();
    expect(screen.queryByText("No recent operational issues.")).toBeNull();
  });

  it("omits Recent operational issues on a load failure too, surfacing it only via Needs attention", async () => {
    const data = allClearHomeData();
    data.recentFailures = { items: [], hasError: true };
    mocks.loadAdminHomeData.mockResolvedValue(data);

    render(await AdminHomePage());

    expect(
      screen.queryByRole("list", { name: "Recent operational issues" }),
    ).toBeNull();
    const tasks = within(screen.getByRole("list", { name: "Needs attention" }));
    expect(
      tasks.getByRole("link", { name: /^Operational issues: unavailable\./ }),
    ).toHaveAttribute("href", "/admin/operations");
  });

  it("keeps available operational issues visible when only one source fails to load", async () => {
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

    expect(actions.getByRole("link", { name: "View orders" })).toHaveAttribute(
      "href",
      "/admin/orders",
    );
    expect(
      actions.getByRole("link", { name: "View inventory" }),
    ).toHaveAttribute("href", "/admin/inventory");
    expect(actions.getByRole("link", { name: "View coupons" })).toHaveAttribute(
      "href",
      "/admin/coupons",
    );
    expect(
      actions.getByRole("link", { name: "View operations" }),
    ).toHaveAttribute("href", "/admin/operations");
  });

  it("keeps normal dark-background copy off low-contrast stone 500 and 600", async () => {
    const { container } = render(await AdminHomePage());

    expect(container.querySelector('[class*="text-stone-500"]')).toBeNull();
    expect(container.querySelector('[class*="text-stone-600"]')).toBeNull();
  });

  it("keeps headings in a logical order: one h1 followed only by h2 sections", async () => {
    render(await AdminHomePage());

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
    const h2s = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(h2s).toEqual([
      "Overview",
      "Needs attention",
      "Recent orders",
      "Recent operational issues",
      "Quick actions",
    ]);
  });
});
