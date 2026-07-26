// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CheckoutReceiptItem,
  CheckoutReceiptLookup,
  CheckoutReceiptOrder,
} from "@/lib/checkout/receipt";

const mocks = vi.hoisted(() => ({
  loadReceipt: vi.fn(),
}));

vi.mock("@/lib/checkout/receipt", () => ({
  loadVerifiedCheckoutReceipt: mocks.loadReceipt,
}));

vi.mock(
  "@/components/cart/checkout-success-state-manager",
  () => ({
    CheckoutSuccessStateManager: () => null,
  }),
);

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

import CheckoutSuccessPage from "./page";

function receiptOrder(
  overrides: Partial<CheckoutReceiptOrder> = {},
): CheckoutReceiptOrder {
  return {
    id: "order-123",
    created_at: "2026-07-24T12:00:00.000Z",
    customer_email: "customer@example.com",
    customer_name: "Sombre Customer",
    customer_phone: null,
    address_line_1: "1 Fragrance Road",
    address_line_2: null,
    district: "Central",
    city: "Hong Kong",
    postal_code: null,
    country: "Hong Kong",
    payment_status: "paid",
    order_status: "confirmed",
    refund_id: null,
    refund_status: null,
    coupon_code: "HAPPY2026",
    original_subtotal: "2000.00",
    discount_total: "400.00",
    subtotal: "1600.00",
    shipping_fee: "50.00",
    total: "1650.00",
    ...overrides,
  };
}

function receiptItem(
  overrides: Partial<CheckoutReceiptItem> = {},
): CheckoutReceiptItem {
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

function lookup(
  order: CheckoutReceiptOrder,
  orderItems: CheckoutReceiptItem[],
): CheckoutReceiptLookup {
  return {
    isVerifiedSession: true,
    order,
    orderItems,
    stripePaymentStatus: "paid",
  };
}

describe("checkout success saved discount display", () => {
  beforeEach(() => {
    mocks.loadReceipt.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the discounted success receipt from saved snapshots", async () => {
    mocks.loadReceipt.mockResolvedValue(
      lookup(receiptOrder(), [
        receiptItem(),
        receiptItem({
          id: "item-full-price",
          product_name: "Product B",
          unit_price: "0.00",
          original_unit_price: "0.00",
          discount_percent: "0.00",
          quantity: 1,
          original_line_total: "0.00",
          discount_amount: "0.00",
          discounted_line_total: "0.00",
        }),
      ]),
    );

    render(
      await CheckoutSuccessPage({
        searchParams: { session_id: "cs_test_receipt123" },
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Order confirmed" }),
    ).toBeInTheDocument();
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
  });

  it("keeps a null-snapshot legacy receipt free of coupon rows", async () => {
    mocks.loadReceipt.mockResolvedValue(
      lookup(
        receiptOrder({
          coupon_code: null,
          original_subtotal: null,
          discount_total: null,
          subtotal: "1000.00",
          total: "1050.00",
        }),
        [
          receiptItem({
            unit_price: "1000.00",
            original_unit_price: null,
            discount_percent: null,
            quantity: 1,
            original_line_total: null,
            discount_amount: null,
            discounted_line_total: null,
          }),
        ],
      ),
    );

    render(
      await CheckoutSuccessPage({
        searchParams: { session_id: "cs_test_receipt123" },
      }),
    );

    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    expect(screen.getAllByText("HK$1,000.00")).not.toHaveLength(0);
    expect(screen.queryByText("Coupon")).toBeNull();
    expect(screen.queryByText("Original subtotal")).toBeNull();
    expect(screen.queryByText("Discounted subtotal")).toBeNull();
  });
});

describe("checkout success text contrast", () => {
  beforeEach(() => {
    mocks.loadReceipt.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps the status eyebrow and receipt field labels off the failing low-contrast class", async () => {
    mocks.loadReceipt.mockResolvedValue(
      lookup(receiptOrder(), [receiptItem()]),
    );

    render(
      await CheckoutSuccessPage({
        searchParams: { session_id: "cs_test_receipt123" },
      }),
    );

    // The status eyebrow carries real information (it can read "Payment
    // confirmed", "Refund pending", etc.), unlike the plain "Sombre" wordmark
    // used purely as branding elsewhere, so it must meet contrast too.
    const statusEyebrow = screen.getByText("Payment confirmed");
    expect(statusEyebrow.className).not.toContain("text-stone-500");
    expect(statusEyebrow.className).toContain("text-stone-400");

    const orderNumberLabel = screen.getByText("Order number");
    expect(orderNumberLabel.className).not.toContain("text-stone-500");
    expect(orderNumberLabel.className).toContain("text-stone-400");
  });
});

describe("checkout success order date formatting", () => {
  beforeEach(() => {
    mocks.loadReceipt.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("formats the order date in Hong Kong time regardless of the host timezone", async () => {
    // 2026-07-24T20:00:00Z is still 24 July in UTC, but already 25 July in
    // Asia/Hong_Kong (UTC+8). Asserting the shifted day proves the explicit
    // timeZone option is applied, not just the "en-HK" locale.
    mocks.loadReceipt.mockResolvedValue(
      lookup(receiptOrder({ created_at: "2026-07-24T20:00:00.000Z" }), [
        receiptItem({ quantity: 1 }),
      ]),
    );

    render(
      await CheckoutSuccessPage({
        searchParams: { session_id: "cs_test_receipt123" },
      }),
    );

    expect(screen.getByText(/25 July 2026/)).toBeInTheDocument();
  });

  it("does not crash on an invalid order date and shows a safe fallback", async () => {
    mocks.loadReceipt.mockResolvedValue(
      lookup(receiptOrder({ created_at: "not-a-real-date" }), [
        receiptItem({ quantity: 1 }),
      ]),
    );

    render(
      await CheckoutSuccessPage({
        searchParams: { session_id: "cs_test_receipt123" },
      }),
    );

    expect(screen.getByRole("heading", { name: "Order confirmed" })).toBeInTheDocument();
    expect(screen.getByText("Order date").closest("div")).toHaveTextContent(
      "—",
    );
  });
});

describe("checkout success purchased item count", () => {
  beforeEach(() => {
    mocks.loadReceipt.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("sums purchased quantities instead of counting line items", async () => {
    mocks.loadReceipt.mockResolvedValue(
      lookup(receiptOrder(), [
        receiptItem({ id: "item-1", quantity: 2 }),
        receiptItem({ id: "item-2", quantity: 3 }),
      ]),
    );

    render(
      await CheckoutSuccessPage({
        searchParams: { session_id: "cs_test_receipt123" },
      }),
    );

    // Two line items, five total units purchased.
    expect(screen.getByText("5 items")).toBeInTheDocument();
  });

  it("uses singular wording for exactly one purchased unit", async () => {
    mocks.loadReceipt.mockResolvedValue(
      lookup(receiptOrder(), [receiptItem({ id: "item-1", quantity: 1 })]),
    );

    render(
      await CheckoutSuccessPage({
        searchParams: { session_id: "cs_test_receipt123" },
      }),
    );

    expect(screen.getByText("1 item")).toBeInTheDocument();
    expect(screen.queryByText("1 items")).toBeNull();
  });

  it("uses plural wording once total purchased units exceed one", async () => {
    mocks.loadReceipt.mockResolvedValue(
      lookup(receiptOrder(), [receiptItem({ id: "item-1", quantity: 4 })]),
    );

    render(
      await CheckoutSuccessPage({
        searchParams: { session_id: "cs_test_receipt123" },
      }),
    );

    expect(screen.getByText("4 items")).toBeInTheDocument();
  });

  it("ignores an invalid quantity instead of letting it corrupt the total", async () => {
    mocks.loadReceipt.mockResolvedValue(
      lookup(receiptOrder(), [
        receiptItem({ id: "item-1", quantity: Number.NaN }),
        receiptItem({ id: "item-2", quantity: 3 }),
      ]),
    );

    render(
      await CheckoutSuccessPage({
        searchParams: { session_id: "cs_test_receipt123" },
      }),
    );

    expect(screen.getByText("3 items")).toBeInTheDocument();
  });
});
