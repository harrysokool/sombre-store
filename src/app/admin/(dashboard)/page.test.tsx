// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
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
    mocks.listAdminOrders.mockResolvedValue([
      {
        id: ORDER_ID,
        created_at: "2026-07-24T20:00:00.000Z",
        customer_name: "Sombre Customer",
        customer_email: "customer@example.com",
        total: "1650.00",
        currency: "hkd",
        payment_status: "paid",
        order_status: "confirmed",
        fulfilment_status: "unfulfilled",
      },
    ]);

    render(await AdminOrdersPage());

    expect(screen.getByText(/25 Jul 2026/)).toBeInTheDocument();
  });
});
