import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
  retrieveRefund: vi.fn(),
  sendOrderStatusEmails: vi.fn(),
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripeWebhookSecret: () => "whsec_test",
  stripe: {
    checkout: {
      sessions: {
        listLineItems: vi.fn(),
      },
    },
    refunds: {
      create: vi.fn(),
      list: vi.fn(),
      retrieve: mocks.retrieveRefund,
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

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const REAL_EVENT_ID = "evt_3TxeeJQvQBBNIK4A1kqyWJ2r";
const REAL_REFUND_ID = "re_3TxeeJQvQBBNIK4A19HJBJhj";
const REAL_PAYMENT_INTENT_ID = "pi_3TxeeJQvQBBNIK4A1suvjhOk";
const REAL_CHARGE_ID = "ch_3TxeeJQvQBBNIK4A1pL2I4lT";

type FinancialOrderState = {
  id: string;
  total: string;
  stripe_payment_intent_id: string;
  order_status: string;
  refund_id: string | null;
  refund_status: string | null;
  refunded_at: string | null;
  fulfilment_status: "unfulfilled";
};

let currentEvent: Stripe.Event;
let currentRefund: Stripe.Refund;
let orderState: FinancialOrderState;
let orderUpdates: Record<string, unknown>[];
let rpcNames: string[];
let selectedTables: string[];
let emailObservedRefundStatus: string | null;
let orderUpdateError: { code: string; message: string } | null;
let recordedFailures: Record<string, unknown>[];

function refundEvent(
  refund: Stripe.Refund,
  type: "refund.created" | "refund.updated" | "refund.failed" = "refund.created",
  livemode = false,
  eventId = `evt_${type.replace(".", "_")}_${refund.status}`,
) {
  return {
    id: eventId,
    object: "event",
    api_version: "2026-03-25.dahlia",
    created: 1_785_120_792,
    data: { object: refund },
    livemode,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    type,
  } as Stripe.Event;
}

function dashboardFullRefund(
  overrides: Partial<Stripe.Refund> = {},
): Stripe.Refund {
  return {
    id: REAL_REFUND_ID,
    object: "refund",
    amount: 123_800,
    balance_transaction: null,
    charge: REAL_CHARGE_ID,
    created: 1_785_120_792,
    currency: "hkd",
    destination_details: null,
    // Refunds created in the Stripe Dashboard do not inherit Sombre's order
    // metadata. They are linked through the Checkout PaymentIntent instead.
    metadata: {},
    payment_intent: REAL_PAYMENT_INTENT_ID,
    reason: "requested_by_customer",
    receipt_number: null,
    source_transfer_reversal: null,
    status: "succeeded",
    transfer_reversal: null,
    ...overrides,
  } as unknown as Stripe.Refund;
}

function chargeRefundUpdatedEvent(refund: Stripe.Refund) {
  return {
    ...refundEvent(refund),
    id: "evt_charge_refund_updated",
    data: { object: refund },
    type: "charge.refund.updated",
  } as unknown as Stripe.Event;
}

function chargeRefundedEvent(refund: Stripe.Refund) {
  return {
    id: "evt_charge_refunded",
    object: "event",
    api_version: "2026-03-25.dahlia",
    created: 0,
    data: {
      object: {
        id: "ch_dashboard_sombre",
        object: "charge",
        amount_refunded: refund.amount,
        payment_intent: refund.payment_intent,
        refunded: true,
        refunds: {
          object: "list",
          data: [refund],
          has_more: false,
          url: "/v1/charges/ch_dashboard_sombre/refunds",
        },
        status: "succeeded",
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "charge.refunded",
  } as unknown as Stripe.Event;
}

function createOrderQuery() {
  let updateValues: Record<string, unknown> | null = null;
  const equalFilters = new Map<string, unknown>();
  const notEqualFilters = new Map<string, unknown>();
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    update: vi.fn(),
    maybeSingle: vi.fn(),
    then: (
      resolve: (value: {
        error: { code: string; message: string } | null;
      }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => {
      if (updateValues && !orderUpdateError) {
        const orderIdMatches =
          !equalFilters.has("id") ||
          equalFilters.get("id") === orderState.id;
        const neqMatches = [...notEqualFilters.entries()].every(
          ([column, value]) =>
            orderState[column as keyof FinancialOrderState] !== value,
        );

        if (orderIdMatches && neqMatches) {
          orderUpdates.push(updateValues);
          Object.assign(orderState, updateValues);
        }
      }

      return Promise.resolve({ error: orderUpdateError }).then(
        resolve,
        reject,
      );
    },
  };

  query.select.mockReturnValue(query);
  query.eq.mockImplementation((column: string, value: unknown) => {
    equalFilters.set(column, value);
    return query;
  });
  query.neq.mockImplementation((column: string, value: unknown) => {
    notEqualFilters.set(column, value);
    return query;
  });
  query.update.mockImplementation((values: Record<string, unknown>) => {
    updateValues = values;
    return query;
  });
  query.maybeSingle.mockImplementation(async () => {
    const hasSupportedLookup =
      equalFilters.has("id") ||
      equalFilters.has("stripe_payment_intent_id");
    const idMatches =
      !equalFilters.has("id") ||
      equalFilters.get("id") === orderState.id;
    const paymentIntentMatches =
      !equalFilters.has("stripe_payment_intent_id") ||
      equalFilters.get("stripe_payment_intent_id") ===
        orderState.stripe_payment_intent_id;

    return {
      data:
        hasSupportedLookup && idMatches && paymentIntentMatches
          ? { id: orderState.id, total: orderState.total }
          : null,
      error: null,
    };
  });

  return query;
}

function createSupabaseClient() {
  return {
    from: vi.fn((table: string) => {
      selectedTables.push(table);

      if (table !== "orders") {
        throw new Error(`Unexpected table ${table}.`);
      }

      return createOrderQuery();
    }),
    rpc: vi.fn(async (name: string, values?: Record<string, unknown>) => {
      rpcNames.push(name);

      if (name === "resolve_stripe_webhook_failure") {
        return { data: false, error: null };
      }

      if (name === "record_stripe_webhook_failure") {
        recordedFailures.push(values ?? {});
        return { data: null, error: null };
      }

      throw new Error(`Unexpected RPC ${name}.`);
    }),
  };
}

function webhookRequest() {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "signature" },
    body: "{}",
  });
}

describe("full-refund webhook inventory separation", () => {
  beforeEach(() => {
    currentRefund = dashboardFullRefund();
    currentEvent = refundEvent(currentRefund);
    orderState = {
      id: ORDER_ID,
      total: "1238.00",
      stripe_payment_intent_id: REAL_PAYMENT_INTENT_ID,
      order_status: "confirmed",
      refund_id: null,
      refund_status: null,
      refunded_at: null,
      // The current model cannot prove this status was never previously
      // shipped, so it must not enable an automatic restoration.
      fulfilment_status: "unfulfilled",
    };
    orderUpdates = [];
    rpcNames = [];
    selectedTables = [];
    emailObservedRefundStatus = null;
    orderUpdateError = null;
    recordedFailures = [];

    mocks.constructEvent.mockReset();
    mocks.constructEvent.mockImplementation(() => currentEvent);
    mocks.retrieveRefund.mockReset();
    mocks.retrieveRefund.mockImplementation(async () => currentRefund);
    mocks.sendOrderStatusEmails.mockReset();
    mocks.sendOrderStatusEmails.mockImplementation(async () => {
      emailObservedRefundStatus = orderState.refund_status;
    });
    mocks.createSupabaseServiceRoleClient.mockReset();
    mocks.createSupabaseServiceRoleClient.mockImplementation(
      createSupabaseClient,
    );
  });

  it("processes the supplied real refund.updated shape through its unexpanded PaymentIntent", async () => {
    currentEvent = refundEvent(
      currentRefund,
      "refund.updated",
      false,
      REAL_EVENT_ID,
    );

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(mocks.constructEvent).toHaveBeenCalledWith(
      "{}",
      "signature",
      "whsec_test",
    );
    expect(mocks.retrieveRefund).toHaveBeenCalledWith(REAL_REFUND_ID);
    expect(currentEvent).toMatchObject({
      id: REAL_EVENT_ID,
      type: "refund.updated",
      livemode: false,
      data: {
        object: {
          id: REAL_REFUND_ID,
          status: "succeeded",
          amount: 123_800,
          currency: "hkd",
          metadata: {},
          payment_intent: REAL_PAYMENT_INTENT_ID,
          charge: REAL_CHARGE_ID,
        },
      },
    });
    expect(orderState).toMatchObject({
      order_status: "refunded",
      refund_id: REAL_REFUND_ID,
      refund_status: "succeeded",
      refunded_at: expect.any(String),
    });
    expect(orderUpdates).toHaveLength(1);
    expect(mocks.sendOrderStatusEmails).toHaveBeenCalledWith(ORDER_ID);
    expect(emailObservedRefundStatus).toBe("succeeded");
    expect(selectedTables.every((table) => table === "orders")).toBe(true);
    expect(rpcNames).toEqual(["resolve_stripe_webhook_failure"]);
    expect(rpcNames).not.toContain("restore_order_stock_after_refund");
  });

  it("matches a Dashboard refund when PaymentIntent and charge are expanded", async () => {
    currentRefund = dashboardFullRefund({
      payment_intent: {
        id: REAL_PAYMENT_INTENT_ID,
        object: "payment_intent",
      } as Stripe.PaymentIntent,
      charge: {
        id: REAL_CHARGE_ID,
        object: "charge",
      } as Stripe.Charge,
    });
    currentEvent = refundEvent(currentRefund, "refund.updated");

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(orderState).toMatchObject({
      order_status: "refunded",
      refund_id: REAL_REFUND_ID,
      refund_status: "succeeded",
    });
    expect(orderUpdates).toHaveLength(1);
    expect(mocks.sendOrderStatusEmails).toHaveBeenCalledWith(ORDER_ID);
    expect(rpcNames).not.toContain("restore_order_stock_after_refund");
  });

  it("keeps a pending refund incomplete until a later refund.updated succeeds", async () => {
    currentRefund = dashboardFullRefund({ status: "pending" });
    currentEvent = refundEvent(currentRefund, "refund.created");

    const pendingResponse = await POST(webhookRequest());

    expect(pendingResponse.status).toBe(200);
    expect(orderState).toMatchObject({
      order_status: "refund_pending",
      refund_id: REAL_REFUND_ID,
      refund_status: "pending",
      refunded_at: null,
    });

    currentRefund = dashboardFullRefund({ status: "succeeded" });
    currentEvent = refundEvent(currentRefund, "refund.updated");

    const succeededResponse = await POST(webhookRequest());

    expect(succeededResponse.status).toBe(200);
    expect(orderState).toMatchObject({
      order_status: "refunded",
      refund_id: REAL_REFUND_ID,
      refund_status: "succeeded",
      refunded_at: expect.any(String),
    });
    expect(orderUpdates).toHaveLength(2);
    expect(mocks.sendOrderStatusEmails).toHaveBeenCalledTimes(2);
    expect(selectedTables.every((table) => table === "orders")).toBe(true);
    expect(rpcNames).not.toContain("restore_order_stock_after_refund");
  });

  it("records a failed refund as refund_failed without touching inventory", async () => {
    currentRefund = dashboardFullRefund({ status: "failed" });
    currentEvent = refundEvent(currentRefund, "refund.failed");

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(orderState).toMatchObject({
      order_status: "refund_failed",
      refund_id: REAL_REFUND_ID,
      refund_status: "failed",
      refunded_at: null,
    });
    expect(mocks.sendOrderStatusEmails).toHaveBeenCalledWith(ORDER_ID);
    expect(selectedTables.every((table) => table === "orders")).toBe(true);
    expect(rpcNames).not.toContain("restore_order_stock_after_refund");
  });

  it("still rejects a signed live-mode refund before lookup or side effects", async () => {
    currentEvent = refundEvent(currentRefund, "refund.created", true);

    const response = await POST(webhookRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Live-mode Stripe webhook events are not accepted.",
    });
    expect(mocks.retrieveRefund).not.toHaveBeenCalled();
    expect(mocks.createSupabaseServiceRoleClient).not.toHaveBeenCalled();
    expect(mocks.sendOrderStatusEmails).not.toHaveBeenCalled();
    expect(orderUpdates).toHaveLength(0);
  });

  it("records an unlinked refund for review and acknowledges it without side effects", async () => {
    currentRefund = dashboardFullRefund({
      payment_intent: "pi_no_matching_sombre_order",
    });
    currentEvent = refundEvent(currentRefund, "refund.updated");

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: true,
      recorded: true,
    });
    expect(orderState).toMatchObject({
      order_status: "confirmed",
      refund_id: null,
      refund_status: null,
      refunded_at: null,
    });
    expect(orderUpdates).toHaveLength(0);
    expect(mocks.sendOrderStatusEmails).not.toHaveBeenCalled();
    expect(recordedFailures).toEqual([
      expect.objectContaining({
        p_stripe_event_id: currentEvent.id,
        p_stripe_event_type: "refund.updated",
        p_order_id: null,
        p_failure_kind: "permanent",
      }),
    ]);
    expect(rpcNames).not.toContain("restore_order_stock_after_refund");
  });

  it("returns 500 and records a retryable failure when the order update fails", async () => {
    orderUpdateError = {
      code: "08006",
      message: "simulated database connection failure",
    };
    currentEvent = refundEvent(currentRefund, "refund.updated");

    const response = await POST(webhookRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Could not process Stripe webhook.",
    });
    expect(orderState).toMatchObject({
      order_status: "confirmed",
      refund_id: null,
      refund_status: null,
      refunded_at: null,
    });
    expect(orderUpdates).toHaveLength(0);
    expect(mocks.sendOrderStatusEmails).not.toHaveBeenCalled();
    expect(recordedFailures).toEqual([
      expect.objectContaining({
        p_stripe_event_id: currentEvent.id,
        p_stripe_event_type: "refund.updated",
        p_order_id: ORDER_ID,
        p_failure_kind: "retryable",
      }),
    ]);
    expect(rpcNames).not.toContain("restore_order_stock_after_refund");
  });

  it("reproduces the currently configured charge.refund.updated event as unhandled", async () => {
    currentEvent = chargeRefundUpdatedEvent(currentRefund);

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(mocks.retrieveRefund).not.toHaveBeenCalled();
    expect(orderState).toMatchObject({
      order_status: "confirmed",
      refund_id: null,
      refund_status: null,
      refunded_at: null,
    });
    expect(orderUpdates).toHaveLength(0);
    expect(mocks.sendOrderStatusEmails).not.toHaveBeenCalled();
    expect(rpcNames).toEqual(["resolve_stripe_webhook_failure"]);
  });

  it("reproduces the configured charge.refunded delivery as unhandled", async () => {
    currentEvent = chargeRefundedEvent(currentRefund);

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(mocks.retrieveRefund).not.toHaveBeenCalled();
    expect(orderState).toMatchObject({
      order_status: "confirmed",
      refund_id: null,
      refund_status: null,
      refunded_at: null,
    });
    expect(orderUpdates).toHaveLength(0);
    expect(selectedTables).toHaveLength(0);
    expect(mocks.sendOrderStatusEmails).not.toHaveBeenCalled();
    expect(rpcNames).toEqual(["resolve_stripe_webhook_failure"]);
  });

  it("keeps replayed refund status idempotent without any inventory RPC", async () => {
    const firstResponse = await POST(webhookRequest());
    const firstRefundedAt = orderState.refunded_at;
    const replayResponse = await POST(webhookRequest());

    expect(firstResponse.status).toBe(200);
    expect(replayResponse.status).toBe(200);
    expect(orderUpdates).toHaveLength(1);
    expect(orderState.refunded_at).toBe(firstRefundedAt);
    expect(mocks.sendOrderStatusEmails).toHaveBeenCalledTimes(2);
    expect(rpcNames).not.toContain("restore_order_stock_after_refund");
  });
});
