import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { calculateUnitDiscountCents } from "@/lib/checkout/discounts";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
  listLineItems: vi.fn(),
  sendOrderStatusEmails: vi.fn(),
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripeWebhookSecret: () => "whsec_test",
  stripe: {
    checkout: {
      sessions: {
        listLineItems: mocks.listLineItems,
      },
    },
    refunds: {
      create: vi.fn(),
      list: vi.fn(),
      retrieve: vi.fn(),
    },
    webhooks: {
      constructEvent: mocks.constructEvent,
    },
  },
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient:
    mocks.createSupabaseServiceRoleClient,
}));

vi.mock("@/lib/email/order-emails", () => ({
  sendOrderStatusEmails: mocks.sendOrderStatusEmails,
}));

import { POST } from "./route";

const ORDER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PRODUCT_A_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B_ID = "22222222-2222-4222-8222-222222222222";

type StoredOrder = {
  id: string;
  payment_status: string;
  order_status: string;
  refund_id: string | null;
  refund_status: string | null;
  stripe_payment_intent_id: string | null;
  stockReduced: boolean;
};

let currentEvent: Stripe.Event;
let currentLineItems: Stripe.LineItem[];
let itemUpsertError: Error | null;
let insertedOrderPayloads: Record<string, unknown>[];
let insertedItemPayloads: Record<string, unknown>[][];
let recordedFailures: Record<string, unknown>[];
let resolvedFailures: Record<string, unknown>[];
let stockReductionCount: number;
let ordersBySession: Map<string, StoredOrder>;
let itemReferencesByOrder: Map<
  string,
  { stripe_line_item_id: string }[]
>;

function stripeProduct(
  productId: string,
  metadata: Record<string, string> = {},
) {
  return {
    id: `prod_${productId.slice(0, 8)}`,
    object: "product",
    active: true,
    attributes: [],
    created: 0,
    default_price: null,
    description: "One Size",
    images: ["https://example.com/product.jpg"],
    livemode: false,
    marketing_features: [],
    metadata: {
      product_id: productId,
      product_slug: `slug-${productId.slice(0, 4)}`,
      ...metadata,
    },
    name: `Product ${productId.slice(0, 4)}`,
    package_dimensions: null,
    shippable: null,
    statement_descriptor: null,
    tax_code: null,
    type: "good",
    unit_label: null,
    updated: 0,
    url: null,
  } as Stripe.Product;
}

function checkoutLine({
  id = "li_a",
  productId = PRODUCT_A_ID,
  originalUnitCents = 100_000,
  discountBasisPoints,
  quantity = 1,
}: {
  id?: string;
  productId?: string;
  originalUnitCents?: number;
  discountBasisPoints?: number;
  quantity?: number;
} = {}) {
  const unitDiscountCents =
    discountBasisPoints === undefined
      ? 0
      : calculateUnitDiscountCents(
          originalUnitCents,
          discountBasisPoints,
        );
  const discountedUnitCents =
    originalUnitCents - unitDiscountCents;
  const lineTotal = discountedUnitCents * quantity;
  const financialMetadata: Record<string, string> =
    discountBasisPoints === undefined
      ? {}
      : {
          original_unit_minor: String(originalUnitCents),
          discount_basis_points: String(discountBasisPoints),
          unit_discount_minor: String(unitDiscountCents),
          discounted_unit_minor: String(discountedUnitCents),
        };

  return {
    id,
    object: "item",
    adjustable_quantity: null,
    amount_discount: 0,
    amount_subtotal: lineTotal,
    amount_tax: 0,
    amount_total: lineTotal,
    currency: "hkd",
    description: `Product ${productId.slice(0, 4)}`,
    discounts: [],
    metadata: {},
    price: {
      id: `price_${id}`,
      object: "price",
      active: true,
      billing_scheme: "per_unit",
      created: 0,
      currency: "hkd",
      custom_unit_amount: null,
      livemode: false,
      lookup_key: null,
      metadata: {},
      nickname: null,
      product: stripeProduct(productId, financialMetadata),
      recurring: null,
      tax_behavior: "unspecified",
      tiers_mode: null,
      transform_quantity: null,
      type: "one_time",
      unit_amount: discountedUnitCents,
      unit_amount_decimal: String(discountedUnitCents),
    },
    quantity,
    taxes: [],
  } as unknown as Stripe.LineItem;
}

function customerMetadata() {
  return {
    customer_name: "Sombre Customer",
    customer_phone: "91234567",
    address_line_1: "1 Sombre Street",
    address_line_2: "Flat A",
    district: "Central",
    city: "Hong Kong",
    postal_code: "",
    country: "Hong Kong",
    cart_item_count: "2",
    cart_quantity_total: "3",
    subtotal: "2500.00",
    shipping_fee: "50.00",
    total: "2550.00",
  };
}

function checkoutSession({
  id = "cs_test_sombre",
  lines,
  couponCode,
  shippingCents = 5_000,
  paymentStatus = "paid",
}: {
  id?: string;
  lines: Stripe.LineItem[];
  couponCode?: string;
  shippingCents?: number;
  paymentStatus?: Stripe.Checkout.Session["payment_status"];
}) {
  const discountedSubtotal = lines.reduce(
    (total, line) => total + line.amount_subtotal,
    0,
  );
  const originalSubtotal = lines.reduce((total, line) => {
    const product = line.price?.product;
    const originalUnit =
      product && typeof product === "object" && !product.deleted
        ? Number(
            product.metadata.original_unit_minor ??
              line.price?.unit_amount ??
              0,
          )
        : 0;

    return total + originalUnit * (line.quantity ?? 0);
  }, 0);
  const metadata: Record<string, string> = customerMetadata();

  if (couponCode) {
    Object.assign(metadata, {
      quote_version: "product-discount-v1",
      coupon_code: couponCode,
      original_subtotal_minor: String(originalSubtotal),
      discount_minor: String(
        originalSubtotal - discountedSubtotal,
      ),
      discounted_subtotal_minor: String(discountedSubtotal),
      shipping_minor: String(shippingCents),
      total_minor: String(discountedSubtotal + shippingCents),
    });
  }

  return {
    id,
    object: "checkout.session",
    amount_subtotal: discountedSubtotal,
    amount_total: discountedSubtotal + shippingCents,
    currency: "hkd",
    customer_details: {
      address: null,
      email: "customer@example.com",
      name: "Sombre Customer",
      phone: "91234567",
      tax_exempt: "none",
      tax_ids: [],
    },
    customer_email: "customer@example.com",
    metadata,
    payment_intent: "pi_test_sombre",
    payment_status: paymentStatus,
    total_details: {
      amount_discount: 0,
      amount_shipping: shippingCents,
      amount_tax: 0,
    },
  } as unknown as Stripe.Checkout.Session;
}

function checkoutEvent(
  session: Stripe.Checkout.Session,
  type:
    | "checkout.session.completed"
    | "checkout.session.async_payment_succeeded" =
    "checkout.session.completed",
  id = "evt_checkout",
) {
  return {
    id,
    object: "event",
    api_version: "2026-06-30.basil",
    created: 0,
    data: { object: session },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
  } as Stripe.Event;
}

function findOrderById(orderId: string) {
  return [...ordersBySession.values()].find(
    (order) => order.id === orderId,
  );
}

function createSupabaseQuery(table: string) {
  let operation: "select" | "insert" = "select";
  let insertedPayload: Record<string, unknown> | null = null;
  const filters = new Map<string, unknown>();
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    insert: vi.fn(),
    upsert: vi.fn(),
    returns: vi.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockImplementation((column: string, value: unknown) => {
    filters.set(column, value);
    return query;
  });
  query.insert.mockImplementation(
    (payload: Record<string, unknown>) => {
      operation = "insert";
      insertedPayload = payload;
      insertedOrderPayloads.push(payload);
      return query;
    },
  );
  query.maybeSingle.mockImplementation(async () => {
    if (table !== "orders") {
      return { data: null, error: null };
    }

    return {
      data:
        ordersBySession.get(
          String(filters.get("stripe_session_id")),
        ) ?? null,
      error: null,
    };
  });
  query.single.mockImplementation(async () => {
    if (table !== "orders") {
      return { data: null, error: null };
    }

    if (operation === "insert" && insertedPayload) {
      const order: StoredOrder = {
        id: ORDER_ID,
        payment_status: "unpaid",
        order_status: "processing",
        refund_id: null,
        refund_status: null,
        stripe_payment_intent_id:
          String(insertedPayload.stripe_payment_intent_id) || null,
        stockReduced: false,
      };
      ordersBySession.set(
        String(insertedPayload.stripe_session_id),
        order,
      );
      return { data: order, error: null };
    }

    return {
      data: findOrderById(String(filters.get("id"))) ?? null,
      error: null,
    };
  });
  query.returns.mockImplementation(async () => {
    if (table !== "order_items") {
      return { data: [], error: null };
    }

    return {
      data:
        itemReferencesByOrder.get(
          String(filters.get("order_id")),
        ) ?? [],
      error: null,
    };
  });
  query.upsert.mockImplementation(
    async (items: Record<string, unknown>[]) => {
      insertedItemPayloads.push(items);

      if (itemUpsertError) {
        return { error: itemUpsertError };
      }

      const orderId = String(items[0]?.order_id);
      const existing = itemReferencesByOrder.get(orderId) ?? [];
      const existingIds = new Set(
        existing.map((item) => item.stripe_line_item_id),
      );

      for (const item of items) {
        const lineItemId = String(item.stripe_line_item_id);

        if (!existingIds.has(lineItemId)) {
          existing.push({ stripe_line_item_id: lineItemId });
          existingIds.add(lineItemId);
        }
      }

      itemReferencesByOrder.set(orderId, existing);
      return { error: null };
    },
  );

  return query;
}

function createSupabaseClient() {
  return {
    from: vi.fn((table: string) => createSupabaseQuery(table)),
    rpc: vi.fn(
      async (name: string, parameters: Record<string, unknown>) => {
        if (name === "confirm_paid_order_and_reduce_stock") {
          const order = findOrderById(String(parameters.p_order_id));

          if (!order) {
            return { data: null, error: new Error("Missing order") };
          }

          if (order.stockReduced) {
            return { data: false, error: null };
          }

          order.stockReduced = true;
          order.payment_status = String(parameters.p_payment_status);
          stockReductionCount += 1;
          return { data: true, error: null };
        }

        if (name === "record_stripe_webhook_failure") {
          recordedFailures.push(parameters);
          return { data: true, error: null };
        }

        if (name === "resolve_stripe_webhook_failure") {
          resolvedFailures.push(parameters);
          return { data: false, error: null };
        }

        throw new Error(`Unexpected RPC ${name}`);
      },
    ),
  };
}

function webhookRequest() {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "signature" },
    body: "{}",
  });
}

describe("Stripe webhook discount snapshots", () => {
  beforeEach(() => {
    currentLineItems = [];
    itemUpsertError = null;
    insertedOrderPayloads = [];
    insertedItemPayloads = [];
    recordedFailures = [];
    resolvedFailures = [];
    stockReductionCount = 0;
    ordersBySession = new Map();
    itemReferencesByOrder = new Map();

    mocks.constructEvent.mockReset();
    mocks.constructEvent.mockImplementation(() => currentEvent);
    mocks.listLineItems.mockReset();
    mocks.listLineItems.mockImplementation(async () => ({
      object: "list",
      data: currentLineItems,
      has_more: false,
      url: "/v1/checkout/sessions/cs/line_items",
    }));
    mocks.sendOrderStatusEmails.mockReset();
    mocks.sendOrderStatusEmails.mockResolvedValue(undefined);
    mocks.createSupabaseServiceRoleClient.mockReset();
    mocks.createSupabaseServiceRoleClient.mockImplementation(
      createSupabaseClient,
    );
  });

  it("persists truthful no-coupon order and item snapshots", async () => {
    currentLineItems = [
      checkoutLine({ quantity: 2 }),
      checkoutLine({
        id: "li_b",
        productId: PRODUCT_B_ID,
        originalUnitCents: 50_000,
      }),
    ];
    const session = checkoutSession({ lines: currentLineItems });
    currentEvent = checkoutEvent(session);

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(insertedOrderPayloads).toHaveLength(1);
    expect(insertedOrderPayloads[0]).toMatchObject({
      customer_email: "customer@example.com",
      customer_name: "Sombre Customer",
      customer_phone: "91234567",
      address_line_1: "1 Sombre Street",
      address_line_2: "Flat A",
      district: "Central",
      city: "Hong Kong",
      postal_code: "",
      country: "Hong Kong",
      coupon_code: null,
      original_subtotal: "2500.00",
      discount_total: "0.00",
      subtotal: "2500.00",
      shipping_fee: "50.00",
      total: "2550.00",
      payment_status: "unpaid",
    });
    expect(insertedItemPayloads[0]).toEqual([
      expect.objectContaining({
        stripe_line_item_id: "li_a",
        product_id: PRODUCT_A_ID,
        original_unit_price: "1000.00",
        discount_percent: "0.00",
        unit_price: "1000.00",
        quantity: 2,
      }),
      expect.objectContaining({
        stripe_line_item_id: "li_b",
        product_id: PRODUCT_B_ID,
        original_unit_price: "500.00",
        discount_percent: "0.00",
        unit_price: "500.00",
        quantity: 1,
      }),
    ]);
    expect(stockReductionCount).toBe(1);
  });

  it("persists mixed product-specific coupon snapshots exactly", async () => {
    currentLineItems = [
      checkoutLine({
        quantity: 2,
        discountBasisPoints: 2_000,
      }),
      checkoutLine({
        id: "li_b",
        productId: PRODUCT_B_ID,
        originalUnitCents: 50_000,
        discountBasisPoints: 525,
        quantity: 3,
      }),
    ];
    const session = checkoutSession({
      lines: currentLineItems,
      couponCode: "SOMBRE",
    });
    currentEvent = checkoutEvent(session);

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(insertedOrderPayloads[0]).toMatchObject({
      customer_name: "Sombre Customer",
      customer_phone: "91234567",
      address_line_1: "1 Sombre Street",
      address_line_2: "Flat A",
      district: "Central",
      city: "Hong Kong",
      postal_code: "",
      country: "Hong Kong",
      coupon_code: "SOMBRE",
      original_subtotal: "3500.00",
      discount_total: "478.75",
      subtotal: "3021.25",
      shipping_fee: "50.00",
      total: "3071.25",
    });
    expect(insertedItemPayloads[0]).toEqual([
      expect.objectContaining({
        product_id: PRODUCT_A_ID,
        original_unit_price: "1000.00",
        discount_percent: "20.00",
        unit_price: "800.00",
        quantity: 2,
      }),
      expect.objectContaining({
        product_id: PRODUCT_B_ID,
        original_unit_price: "500.00",
        discount_percent: "5.25",
        unit_price: "473.75",
        quantity: 3,
      }),
    ]);
    expect(stockReductionCount).toBe(1);
  });

  it("persists half-up rounding and a 100 percent discount with full shipping", async () => {
    currentLineItems = [
      checkoutLine({
        originalUnitCents: 1_001,
        discountBasisPoints: 5_000,
        quantity: 2,
      }),
      checkoutLine({
        id: "li_b",
        productId: PRODUCT_B_ID,
        originalUnitCents: 100_000,
        discountBasisPoints: 10_000,
      }),
    ];
    const session = checkoutSession({
      lines: currentLineItems,
      couponCode: "SOMBRE",
    });
    currentEvent = checkoutEvent(session);

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(insertedOrderPayloads[0]).toMatchObject({
      original_subtotal: "1020.02",
      discount_total: "1010.02",
      subtotal: "10.00",
      shipping_fee: "50.00",
      total: "60.00",
    });
    expect(insertedItemPayloads[0]).toEqual([
      expect.objectContaining({
        original_unit_price: "10.01",
        discount_percent: "50.00",
        unit_price: "5.00",
        quantity: 2,
      }),
      expect.objectContaining({
        original_unit_price: "1000.00",
        discount_percent: "100.00",
        unit_price: "0.00",
        quantity: 1,
      }),
    ]);
  });

  it("returns a retriable failure before persistence for malformed coupon metadata", async () => {
    currentLineItems = [
      checkoutLine({ discountBasisPoints: 2_000 }),
    ];
    const session = checkoutSession({
      lines: currentLineItems,
      couponCode: "SOMBRE",
    });
    delete session.metadata!.discount_minor;
    currentEvent = checkoutEvent(session);

    const response = await POST(webhookRequest());

    expect(response.status).toBe(500);
    expect(insertedOrderPayloads).toHaveLength(0);
    expect(insertedItemPayloads).toHaveLength(0);
    expect(stockReductionCount).toBe(0);
    expect(recordedFailures).toEqual([
      expect.objectContaining({
        p_stripe_event_id: "evt_checkout",
        p_stripe_session_id: "cs_test_sombre",
        p_failure_kind: "retryable",
      }),
    ]);
  });

  it("recovers a partial-write retry and keeps replay stock reduction idempotent", async () => {
    currentLineItems = [
      checkoutLine({ discountBasisPoints: 2_000 }),
    ];
    const session = checkoutSession({
      lines: currentLineItems,
      couponCode: "SOMBRE",
    });
    currentEvent = checkoutEvent(session);
    itemUpsertError = new Error("temporary item write failure");

    const failedResponse = await POST(webhookRequest());

    expect(failedResponse.status).toBe(500);
    expect(insertedOrderPayloads).toHaveLength(1);
    expect(stockReductionCount).toBe(0);
    expect(recordedFailures).toHaveLength(1);

    itemUpsertError = null;
    const retryResponse = await POST(webhookRequest());

    expect(retryResponse.status).toBe(200);
    expect(insertedOrderPayloads).toHaveLength(1);
    expect(itemReferencesByOrder.get(ORDER_ID)).toEqual([
      { stripe_line_item_id: "li_a" },
    ]);
    expect(stockReductionCount).toBe(1);

    const replayResponse = await POST(webhookRequest());

    expect(replayResponse.status).toBe(200);
    expect(insertedOrderPayloads).toHaveLength(1);
    expect(insertedItemPayloads).toHaveLength(2);
    expect(itemReferencesByOrder.get(ORDER_ID)).toHaveLength(1);
    expect(stockReductionCount).toBe(1);
    expect(mocks.sendOrderStatusEmails).toHaveBeenCalledTimes(2);
  });

  it("preserves delayed-payment handling until async success", async () => {
    currentLineItems = [
      checkoutLine({ discountBasisPoints: 2_000 }),
    ];
    const awaitingSession = checkoutSession({
      lines: currentLineItems,
      couponCode: "SOMBRE",
      paymentStatus: "unpaid",
    });
    currentEvent = checkoutEvent(awaitingSession);

    const awaitingResponse = await POST(webhookRequest());

    expect(awaitingResponse.status).toBe(200);
    expect(mocks.listLineItems).not.toHaveBeenCalled();
    expect(insertedOrderPayloads).toHaveLength(0);
    expect(stockReductionCount).toBe(0);

    const paidSession = {
      ...awaitingSession,
      payment_status: "paid",
    } as Stripe.Checkout.Session;
    currentEvent = checkoutEvent(
      paidSession,
      "checkout.session.async_payment_succeeded",
      "evt_async_success",
    );

    const paidResponse = await POST(webhookRequest());

    expect(paidResponse.status).toBe(200);
    expect(mocks.listLineItems).toHaveBeenCalledTimes(1);
    expect(insertedOrderPayloads).toHaveLength(1);
    expect(stockReductionCount).toBe(1);
  });
});
