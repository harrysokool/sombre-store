// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminUser: vi.fn(),
  listAdminOrders: vi.fn(),
}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  requireAdminUser: mocks.requireAdminUser,
}));

vi.mock("@/lib/admin/orders", () => ({
  listAdminOrders: mocks.listAdminOrders,
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

import AdminOrdersPage from "./page";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

const BASE_ORDER = {
  id: ORDER_ID,
  created_at: "2026-07-24T20:00:00.000Z",
  customer_name: "Sombre Customer",
  customer_email: "customer@example.com",
  total: "1650.00",
  currency: "hkd",
  payment_status: "paid",
  order_status: "confirmed",
  fulfilment_status: "unfulfilled",
};

// The list renders twice on purpose: stacked cards for small screens and the
// table for `lg` and up. Every assertion scopes to one of them, so a value can
// never be found in the wrong presentation.
function mobileCards() {
  return within(screen.getByRole("list", { name: "Orders" }));
}

function desktopTable() {
  return within(screen.getByRole("table", { name: "Orders" }));
}

describe("admin orders list page", () => {
  beforeEach(() => {
    mocks.requireAdminUser.mockReset();
    mocks.listAdminOrders.mockReset();
    mocks.requireAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("formats the order date in Hong Kong time regardless of the host timezone", async () => {
    // 2026-07-24T20:00:00Z is still 2026-07-24 in UTC, but already
    // 2026-07-25 in Asia/Hong_Kong (UTC+8). Asserting on the shifted day
    // proves the explicit timeZone option is applied.
    mocks.listAdminOrders.mockResolvedValue([BASE_ORDER]);

    render(await AdminOrdersPage());

    expect(desktopTable().getByText(/25 Jul 2026/)).toBeInTheDocument();
    expect(mobileCards().getByText(/25 Jul 2026/)).toBeInTheDocument();
  });

  it("stacks each order into a labelled card for small screens", async () => {
    mocks.listAdminOrders.mockResolvedValue([BASE_ORDER]);

    render(await AdminOrdersPage());

    const cards = mobileCards();
    const card = within(cards.getAllByRole("listitem")[0]);

    // Order id, customer, date, payment/order status, fulfilment, and total.
    expect(card.getByRole("link", { name: "11111111" })).toHaveAttribute(
      "href",
      `/admin/orders/${ORDER_ID}`,
    );
    expect(card.getByText("Customer")).toBeInTheDocument();
    expect(card.getByText("Sombre Customer")).toBeInTheDocument();
    expect(card.getByText("customer@example.com")).toBeInTheDocument();
    expect(card.getByText("Date")).toBeInTheDocument();
    expect(card.getByText(/25 Jul 2026/)).toBeInTheDocument();
    expect(card.getByText("Payment")).toBeInTheDocument();
    expect(card.getByText("Paid")).toBeInTheDocument();
    expect(card.getByText("Status")).toBeInTheDocument();
    expect(card.getByText("Confirmed")).toBeInTheDocument();
    expect(card.getByText("Fulfilment")).toBeInTheDocument();
    expect(card.getByText("Unfulfilled")).toBeInTheDocument();
    expect(card.getByText("Total")).toBeInTheDocument();
    expect(card.getByText("HK$1,650.00")).toBeInTheDocument();
  });

  it("hides the cards at desktop widths and the table below them", async () => {
    mocks.listAdminOrders.mockResolvedValue([BASE_ORDER]);

    render(await AdminOrdersPage());

    // Only one presentation is visible at any width, so the two can never
    // overlap on screen.
    expect(screen.getByRole("list", { name: "Orders" })).toHaveClass(
      "lg:hidden",
    );
    expect(
      screen.getByRole("table", { name: "Orders" }).parentElement,
    ).toHaveClass("hidden", "lg:block");
  });

  it("keeps the desktop table with a row per order", async () => {
    mocks.listAdminOrders.mockResolvedValue([
      BASE_ORDER,
      {
        ...BASE_ORDER,
        id: "22222222-2222-4222-8222-222222222222",
        customer_name: "Second Customer",
        customer_email: "second@example.com",
        payment_status: "failed",
        order_status: "unfulfillable",
        fulfilment_status: "delivered",
        total: "250.00",
      },
    ]);

    render(await AdminOrdersPage());

    const table = desktopTable();

    for (const header of [
      "Order",
      "Customer",
      "Date",
      "Payment",
      "Status",
      "Fulfilment",
      "Total",
    ]) {
      expect(table.getByRole("columnheader", { name: header })).toBeInTheDocument();
    }

    // Header row plus one row per order.
    expect(table.getAllByRole("row")).toHaveLength(3);
    expect(table.getByText("Sombre Customer")).toBeInTheDocument();
    expect(table.getByText("Second Customer")).toBeInTheDocument();
    expect(table.getByText("HK$250.00")).toBeInTheDocument();
    expect(table.getByRole("link", { name: "22222222" })).toHaveAttribute(
      "href",
      "/admin/orders/22222222-2222-4222-8222-222222222222",
    );
  });

  it("tones each status while keeping its word readable", async () => {
    mocks.listAdminOrders.mockResolvedValue([
      BASE_ORDER,
      {
        ...BASE_ORDER,
        id: "22222222-2222-4222-8222-222222222222",
        payment_status: "failed",
        order_status: "refund_pending",
        fulfilment_status: "delivered",
      },
    ]);

    render(await AdminOrdersPage());

    const table = desktopTable();

    expect(table.getByText("Paid")).toHaveAttribute("data-tone", "success");
    expect(table.getByText("Confirmed")).toHaveAttribute(
      "data-tone",
      "success",
    );
    expect(table.getByText("Unfulfilled")).toHaveAttribute(
      "data-tone",
      "neutral",
    );
    expect(table.getByText("Failed")).toHaveAttribute("data-tone", "danger");
    expect(table.getByText("Refund pending")).toHaveAttribute(
      "data-tone",
      "pending",
    );
    expect(table.getByText("Delivered")).toHaveAttribute(
      "data-tone",
      "success",
    );

    // The same values carry the same tones in the mobile cards.
    expect(mobileCards().getByText("Failed")).toHaveAttribute(
      "data-tone",
      "danger",
    );
  });

  it("wraps long customer values instead of forcing horizontal scroll", async () => {
    const longEmail =
      "an.extremely.long.customer.email.address.that.will.not.fit@a-very-long-domain-name.example.com";

    mocks.listAdminOrders.mockResolvedValue([
      {
        ...BASE_ORDER,
        customer_name: "Bartholomew Fitzgerald-Wellingtonshire-Montgomery III",
        customer_email: longEmail,
      },
    ]);

    render(await AdminOrdersPage());

    const cardValue = mobileCards().getByText(longEmail).closest("dd");
    expect(cardValue).toHaveClass("break-words", "[overflow-wrap:anywhere]");
    expect(cardValue).toHaveClass("min-w-0");

    const tableCell = desktopTable().getByText(longEmail).closest("td");
    expect(tableCell).toHaveClass("break-words", "[overflow-wrap:anywhere]");
    expect(tableCell).toHaveClass("max-w-[18rem]");
  });

  it("keeps the empty and failed states out of both presentations", async () => {
    mocks.listAdminOrders.mockResolvedValue([]);

    render(await AdminOrdersPage());

    expect(screen.getByText("No orders yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("list", { name: "Orders" })).toBeNull();
  });
});
