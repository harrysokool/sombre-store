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
  stockRestorationPanel: vi.fn(),
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

vi.mock(
  "@/app/admin/(dashboard)/orders/[id]/order-stock-restoration-panel",
  () => ({
    OrderStockRestorationPanel: (props: unknown) => {
      mocks.stockRestorationPanel(props);
      return <div data-testid="stock-restoration-panel" />;
    },
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
    stock_reduced_at: "2026-07-24T12:00:00.000Z",
    stock_restored_at: null,
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
    product_id: "22222222-2222-4222-8222-222222222222",
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
    mocks.stockRestorationPanel.mockReset();
    mocks.requireAdminUser.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
  });

  it("checks admin authentication before reading the requested order", async () => {
    mocks.requireAdminUser.mockRejectedValue(
      new Error("redirect to admin login"),
    );

    await expect(
      AdminOrderDetailPage({
        params: Promise.resolve({ id: ORDER_ID }),
      }),
    ).rejects.toThrow("redirect to admin login");
    expect(mocks.getAdminOrder).not.toHaveBeenCalled();
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
    expect(screen.getByRole("link", { name: /All orders/i })).toHaveAttribute(
      "href",
      "/admin/orders",
    );
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

  it("formats the order date in Hong Kong time regardless of the host timezone", async () => {
    // 2026-07-24T20:00:00Z is still 2026-07-24 in UTC, but already
    // 2026-07-25 04:00 in Asia/Hong_Kong (UTC+8). Asserting on the shifted
    // day proves the explicit timeZone option is applied, not just en-HK's
    // locale formatting under whatever timezone the test host happens to run in.
    mocks.getAdminOrder.mockResolvedValue({
      order: adminOrder({ created_at: "2026-07-24T20:00:00.000Z" }),
      items: [adminItem()],
      hasUnresolvedRefundReview: false,
    });

    render(
      await AdminOrderDetailPage({
        params: Promise.resolve({ id: ORDER_ID }),
      }),
    );

    expect(screen.getByText(/25 July 2026/)).toBeInTheDocument();
  });

  it("wraps a long refund reference instead of letting it overflow", async () => {
    mocks.getAdminOrder.mockResolvedValue({
      order: adminOrder({
        order_status: "refunded",
        refund_status: "succeeded",
        refund_id:
          "re_1AbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWxYz",
        refunded_at: "2026-07-24T12:00:00.000Z",
      }),
      items: [adminItem()],
      hasUnresolvedRefundReview: false,
    });

    render(
      await AdminOrderDetailPage({
        params: Promise.resolve({ id: ORDER_ID }),
      }),
    );

    const refundReference = screen.getByText(
      "re_1AbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWxYz",
    );
    expect(refundReference.className).toContain("break-words");
    expect(refundReference.className).toContain("overflow-wrap:anywhere");
  });

  it("passes remaining quantities and audit history to refunded-order stock controls", async () => {
    mocks.getAdminOrder.mockResolvedValue({
      order: adminOrder({
        order_status: "refunded",
        refund_status: "succeeded",
        refund_id: "re_test_refunded",
        refunded_at: "2026-07-24T12:00:00.000Z",
      }),
      items: [adminItem({ quantity: 3 })],
      hasUnresolvedRefundReview: false,
      stockRestorations: [
        {
          id: "restoration-1",
          request_id: "33333333-3333-4333-8333-333333333333",
          order_id: ORDER_ID,
          order_item_id: "item-123",
          product_id: "22222222-2222-4222-8222-222222222222",
          quantity_restored: 2,
          reason: "Two sealed units passed inspection.",
          administrator_user_id:
            "44444444-4444-4444-8444-444444444444",
          administrator_email: "admin@example.com",
          source: "administrator",
          restored_at: "2026-07-24T13:00:00.000Z",
        },
      ],
    });

    render(
      await AdminOrderDetailPage({
        params: Promise.resolve({ id: ORDER_ID }),
      }),
    );

    expect(screen.getByTestId("stock-restoration-panel")).toBeInTheDocument();
    expect(mocks.stockRestorationPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: ORDER_ID,
        lockedReason: null,
        items: [
          expect.objectContaining({
            id: "item-123",
            purchasedQuantity: 3,
            restoredQuantity: 2,
            remainingQuantity: 1,
            requestId: expect.stringMatching(
              /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
            ),
          }),
        ],
        history: [
          expect.objectContaining({
            quantityRestored: 2,
            reason: "Two sealed units passed inspection.",
            administratorIdentity: "admin@example.com",
          }),
        ],
      }),
    );
  });

  it("keeps field labels off the failing low-contrast class", async () => {
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

    for (const text of [
      "Payment status",
      "Order status",
      "Purchased products",
      "Delivery details",
    ]) {
      const label = screen.getByText(text);
      expect(label.className).not.toContain("text-stone-500");
      expect(label.className).toContain("text-stone-400");
    }
  });
});
