// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AdminOrderDetail,
  AdminOrderItem,
} from "@/lib/admin/orders";

const mocks = vi.hoisted(() => ({
  getAdminOrder: vi.fn(),
  requireAdminUser: vi.fn(),
}));

vi.mock("@/lib/admin/orders", () => ({
  getAdminOrder: mocks.getAdminOrder,
}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  requireAdminUser: mocks.requireAdminUser,
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not found");
  }),
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

vi.mock(
  "@/app/admin/(dashboard)/orders/[id]/order-fulfilment-panel",
  () => ({
    OrderFulfilmentPanel: () => <div data-testid="fulfilment-panel" />,
  }),
);

import AdminOrderDetailPage from "./page";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

function adminOrder(
  overrides: Partial<AdminOrderDetail> = {},
): AdminOrderDetail {
  return {
    id: ORDER_ID,
    created_at: "2026-07-24T12:00:00.000Z",
    customer_name: "Sombre Customer",
    customer_email: "customer@example.com",
    customer_phone: null,
    address_line_1: "1 Fragrance Road",
    address_line_2: null,
    district: "Central",
    city: "Hong Kong",
    postal_code: null,
    country: "Hong Kong",
    coupon_code: "HAPPY2026",
    original_subtotal: "2000.00",
    discount_total: "400.00",
    subtotal: "1600.00",
    shipping_fee: "50.00",
    total: "1650.00",
    currency: "hkd",
    payment_status: "paid",
    order_status: "confirmed",
    fulfilment_status: "unfulfilled",
    refund_status: null,
    refund_id: null,
    refunded_at: null,
    courier: null,
    tracking_number: null,
    shipped_at: null,
    delivered_at: null,
    fulfilment_updated_at: null,
    ...overrides,
  };
}

function adminItem(
  overrides: Partial<AdminOrderItem> = {},
): AdminOrderItem {
  return {
    id: "item-123",
    product_name: "Product A",
    size_label: "100 mL",
    unit_price: "800.00",
    original_unit_price: "1000.00",
    discount_percent: "20.00",
    quantity: 2,
    original_line_total: "2000.00",
    discount_amount: "400.00",
    discounted_line_total: "1600.00",
    ...overrides,
  };
}

describe("admin saved discount display", () => {
  beforeEach(() => {
    mocks.getAdminOrder.mockReset();
    mocks.requireAdminUser.mockReset();
    mocks.requireAdminUser.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
  });

  it("shows discounted order and item snapshots in admin details", async () => {
    mocks.getAdminOrder.mockResolvedValue({
      order: adminOrder(),
      items: [adminItem()],
      hasUnresolvedRefundReview: false,
    });

    render(
      await AdminOrderDetailPage({
        params: Promise.resolve({ id: ORDER_ID }),
      }),
    );

    expect(screen.getByText("Original subtotal")).toBeInTheDocument();
    expect(screen.getByText("HAPPY2026")).toBeInTheDocument();
    expect(screen.getByText("Discounted subtotal")).toBeInTheDocument();
    expect(screen.getAllByText(/HK\$400\.00/)).not.toHaveLength(0);
    expect(screen.getAllByText("HK$1,600.00")).not.toHaveLength(0);
    expect(screen.getByText("HK$50.00")).toBeInTheDocument();
    expect(screen.getByText("HK$1,650.00")).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();
    expect(screen.getByText("Original unit price")).toBeInTheDocument();
    expect(screen.getByText("Final unit price")).toBeInTheDocument();
    expect(screen.getByText("Discount percentage")).toBeInTheDocument();
    expect(screen.getByText("Line discount")).toBeInTheDocument();
    expect(screen.getByText("Final line total")).toBeInTheDocument();
    expect(screen.getByTestId("fulfilment-panel")).toBeInTheDocument();
  });

  it("keeps legacy admin orders on existing subtotal and unit prices", async () => {
    mocks.getAdminOrder.mockResolvedValue({
      order: adminOrder({
        coupon_code: null,
        original_subtotal: null,
        discount_total: null,
        subtotal: "1000.00",
        total: "1050.00",
      }),
      items: [
        adminItem({
          unit_price: "1000.00",
          original_unit_price: null,
          discount_percent: null,
          quantity: 1,
          original_line_total: null,
          discount_amount: null,
          discounted_line_total: null,
        }),
      ],
      hasUnresolvedRefundReview: false,
    });

    render(
      await AdminOrderDetailPage({
        params: Promise.resolve({ id: ORDER_ID }),
      }),
    );

    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    expect(screen.getAllByText("HK$1,000.00")).not.toHaveLength(0);
    expect(screen.queryByText("Coupon")).toBeNull();
    expect(screen.queryByText("Original subtotal")).toBeNull();
    expect(screen.queryByText("Discounted subtotal")).toBeNull();
  });
});
