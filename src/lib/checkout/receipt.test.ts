import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  retrieveSession: vi.fn(),
  createSupabase: vi.fn(),
}));

vi.mock("@/lib/stripe/server", () => ({
  stripe: {
    checkout: {
      sessions: {
        retrieve: mocks.retrieveSession,
      },
    },
  },
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: mocks.createSupabase,
}));

import { loadVerifiedCheckoutReceipt } from "./receipt";

const SESSION_ID = "cs_test_receipt123";

function persistedOrder(overrides: Record<string, unknown> = {}) {
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
    currency: "hkd",
    stripe_payment_intent_id: "pi_receipt123",
    ...overrides,
  };
}

function persistedItem(overrides: Record<string, unknown> = {}) {
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

function setupSupabase(order: unknown, items: unknown[]) {
  const selectedColumns: Record<string, string> = {};
  const ordersQuery = {
    select: vi.fn((columns: string) => {
      selectedColumns.orders = columns;
      return ordersQuery;
    }),
    eq: vi.fn(() => ordersQuery),
    maybeSingle: vi.fn(async () => ({ data: order, error: null })),
  };
  const itemsQuery = {
    select: vi.fn((columns: string) => {
      selectedColumns.order_items = columns;
      return itemsQuery;
    }),
    eq: vi.fn(() => itemsQuery),
    order: vi.fn(() => itemsQuery),
    returns: vi.fn(async () => ({ data: items, error: null })),
  };
  const supabase = {
    from: vi.fn((table: string) =>
      table === "orders" ? ordersQuery : itemsQuery,
    ),
  };

  mocks.createSupabase.mockReturnValue(supabase);

  return selectedColumns;
}

describe("loadVerifiedCheckoutReceipt discount snapshots", () => {
  beforeEach(() => {
    mocks.retrieveSession.mockReset();
    mocks.createSupabase.mockReset();
    mocks.retrieveSession.mockResolvedValue({
      id: SESSION_ID,
      mode: "payment",
      payment_status: "paid",
      payment_intent: "pi_receipt123",
      currency: "hkd",
      amount_subtotal: 160_000,
      amount_total: 165_000,
      total_details: { amount_shipping: 5_000 },
    });
  });

  it("loads saved discounted order and item snapshots for the receipt", async () => {
    const selectedColumns = setupSupabase(persistedOrder(), [
      persistedItem(),
    ]);

    const receipt = await loadVerifiedCheckoutReceipt(SESSION_ID);

    expect(receipt.order).toMatchObject({
      coupon_code: "HAPPY2026",
      original_subtotal: "2000.00",
      discount_total: "400.00",
      subtotal: "1600.00",
      shipping_fee: "50.00",
      total: "1650.00",
    });
    expect(receipt.orderItems[0]).toMatchObject({
      original_unit_price: "1000.00",
      discount_percent: "20.00",
      unit_price: "800.00",
      original_line_total: "2000.00",
      discount_amount: "400.00",
      discounted_line_total: "1600.00",
    });
    expect(selectedColumns.orders).toContain("coupon_code");
    expect(selectedColumns.orders).toContain("discount_total");
    expect(selectedColumns.order_items).toContain("discount_percent");
    expect(selectedColumns.order_items).toContain("discount_amount");
  });

  it("preserves null legacy snapshots without reconstructing a discount", async () => {
    mocks.retrieveSession.mockResolvedValue({
      id: SESSION_ID,
      mode: "payment",
      payment_status: "paid",
      payment_intent: "pi_receipt123",
      currency: "hkd",
      amount_subtotal: 100_000,
      amount_total: 105_000,
      total_details: { amount_shipping: 5_000 },
    });
    setupSupabase(
      persistedOrder({
        coupon_code: null,
        original_subtotal: null,
        discount_total: null,
        subtotal: "1000.00",
        total: "1050.00",
      }),
      [
        persistedItem({
          unit_price: "1000.00",
          original_unit_price: null,
          discount_percent: null,
          quantity: 1,
          original_line_total: null,
          discount_amount: null,
          discounted_line_total: null,
        }),
      ],
    );

    const receipt = await loadVerifiedCheckoutReceipt(SESSION_ID);

    expect(receipt.order).toMatchObject({
      coupon_code: null,
      original_subtotal: null,
      discount_total: null,
      subtotal: "1000.00",
    });
    expect(receipt.orderItems[0]).toMatchObject({
      original_unit_price: null,
      discount_percent: null,
      unit_price: "1000.00",
    });
  });

  it.each([
    {
      label: "amount",
      orderOverrides: { total: "1650.01" },
    },
    {
      label: "currency",
      orderOverrides: { currency: "usd" },
    },
    {
      label: "payment intent",
      orderOverrides: { stripe_payment_intent_id: "pi_unrelated" },
    },
  ])(
    "does not expose an unrelated order when the saved $label mismatches Stripe",
    async ({ orderOverrides }) => {
      setupSupabase(persistedOrder(orderOverrides), [persistedItem()]);

      const receipt = await loadVerifiedCheckoutReceipt(SESSION_ID);

      expect(receipt).toEqual({
        isVerifiedSession: true,
        order: null,
        orderItems: [],
        stripePaymentStatus: "paid",
      });
    },
  );
});
