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

type FinancialOrderState = {
  id: string;
  total: string;
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

function refundEvent(refund: Stripe.Refund) {
  return {
    id: "evt_refund_succeeded",
    object: "event",
    api_version: "2026-06-30.basil",
    created: 0,
    data: { object: refund },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "refund.updated",
  } as Stripe.Event;
}

function succeededFullRefund() {
  return {
    id: "re_test_full_refund",
    object: "refund",
    amount: 10_000,
    balance_transaction: null,
    charge: "ch_test_sombre",
    created: 0,
    currency: "hkd",
    destination_details: null,
    metadata: { order_id: ORDER_ID },
    payment_intent: "pi_test_sombre",
    reason: "requested_by_customer",
    receipt_number: null,
    source_transfer_reversal: null,
    status: "succeeded",
    transfer_reversal: null,
  } as unknown as Stripe.Refund;
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
      resolve: (value: { error: null }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => {
      if (updateValues) {
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

      return Promise.resolve({ error: null }).then(resolve, reject);
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
  query.maybeSingle.mockImplementation(async () => ({
    data:
      equalFilters.get("id") === orderState.id
        ? { id: orderState.id, total: orderState.total }
        : null,
    error: null,
  }));

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
    rpc: vi.fn(async (name: string) => {
      rpcNames.push(name);

      if (name === "resolve_stripe_webhook_failure") {
        return { data: false, error: null };
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
    currentRefund = succeededFullRefund();
    currentEvent = refundEvent(currentRefund);
    orderState = {
      id: ORDER_ID,
      total: "100.00",
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

  it("records an unfulfilled order's full refund and sends email without restoring stock", async () => {
    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(orderState).toMatchObject({
      order_status: "refunded",
      refund_id: "re_test_full_refund",
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
