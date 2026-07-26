import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createSupabase: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  getAdminUser: mocks.getAdminUser,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: mocks.createSupabase,
}));

import {
  ADMIN_HOME_ID_CHUNK_SIZE,
  ADMIN_HOME_QUERY_PAGE_SIZE,
  loadAdminHomeData,
} from "./home-data";

type QueryName =
  | "ordersToday"
  | "revenue"
  | "awaitingCount"
  | "lowStockCount"
  | "outOfStockCount"
  | "refundFailures"
  | "refundEligibility"
  | "recentOrders"
  | "webhookFailures"
  | "emailFailures";

type QueryResult = {
  data?: unknown;
  error?: unknown;
  count?: number | null;
};

type QueryMethod = {
  name: string;
  args: unknown[];
};

type QueryCall = {
  table: string;
  columns?: string;
  selectOptions?: unknown;
  methods: QueryMethod[];
};

type ResponseFactory = (
  call: QueryCall,
  occurrence: number,
) => QueryResult;

type ResponseValue = QueryResult | QueryResult[] | ResponseFactory;

const RECENT_ORDER_COLUMNS =
  "id, created_at, customer_name, customer_email, total, currency, payment_status, order_status, fulfilment_status";
const WEBHOOK_FAILURE_COLUMNS =
  "id, stripe_event_type, order_id, failure_kind, last_failed_at";
const EMAIL_FAILURE_COLUMNS =
  "id, order_id, email_kind, status, last_attempt_at";

function method(call: QueryCall, name: string) {
  return call.methods.filter((entry) => entry.name === name);
}

function hasMethod(
  call: QueryCall,
  name: string,
  column?: string,
) {
  return method(call, name).some(
    ({ args }) => column === undefined || args[0] === column,
  );
}

function identifyQuery(call: QueryCall): QueryName {
  const options = call.selectOptions as
    | { count?: string; head?: boolean }
    | undefined;

  if (
    call.table === "orders" &&
    call.columns === "id" &&
    options?.head &&
    hasMethod(call, "gte", "created_at")
  ) {
    return "ordersToday";
  }

  if (call.table === "orders" && call.columns === "id, total") {
    return "revenue";
  }

  if (
    call.table === "orders" &&
    call.columns === "id" &&
    options?.head &&
    hasMethod(call, "in", "fulfilment_status")
  ) {
    return "awaitingCount";
  }

  if (
    call.table === "products" &&
    call.columns === "id" &&
    hasMethod(call, "gte", "stock_quantity")
  ) {
    return "lowStockCount";
  }

  if (
    call.table === "products" &&
    call.columns === "id" &&
    hasMethod(call, "eq", "stock_quantity")
  ) {
    return "outOfStockCount";
  }

  if (call.table === "webhook_failures" && call.columns === "order_id") {
    return "refundFailures";
  }

  if (
    call.table === "orders" &&
    call.columns === "id" &&
    !options?.head &&
    hasMethod(call, "in", "id")
  ) {
    return "refundEligibility";
  }

  if (call.table === "orders" && call.columns === RECENT_ORDER_COLUMNS) {
    return "recentOrders";
  }

  if (
    call.table === "unresolved_webhook_failures" &&
    call.columns === WEBHOOK_FAILURE_COLUMNS
  ) {
    return "webhookFailures";
  }

  if (
    call.table === "unsent_order_emails" &&
    call.columns === EMAIL_FAILURE_COLUMNS
  ) {
    return "emailFailures";
  }

  throw new Error(
    `Unexpected Admin Home query: ${call.table}.${call.columns ?? "<none>"}`,
  );
}

function defaultResult(name: QueryName): QueryResult {
  switch (name) {
    case "ordersToday":
    case "awaitingCount":
    case "lowStockCount":
    case "outOfStockCount":
      return { data: null, count: 0 };
    case "revenue":
    case "refundFailures":
    case "refundEligibility":
      return { data: [], count: 0 };
    default:
      return { data: [] };
  }
}

function stubClient(
  responses: Partial<Record<QueryName, ResponseValue>> = {},
) {
  const calls: QueryCall[] = [];
  const occurrences = new Map<QueryName, number>();

  const client = {
    from: vi.fn((table: string) => {
      const call: QueryCall = { table, methods: [] };
      calls.push(call);
      const builder: Record<string, ReturnType<typeof vi.fn>> = {};

      builder.select = vi.fn((columns: string, options?: unknown) => {
        call.columns = columns;
        call.selectOptions = options;
        return builder;
      });

      for (const name of [
        "gte",
        "lte",
        "lt",
        "eq",
        "in",
        "is",
        "like",
        "order",
        "limit",
        "range",
      ]) {
        builder[name] = vi.fn((...args: unknown[]) => {
          call.methods.push({ name, args });
          return builder;
        });
      }

      builder.returns = vi.fn(async () => {
        const queryName = identifyQuery(call);
        const occurrence = occurrences.get(queryName) ?? 0;
        occurrences.set(queryName, occurrence + 1);
        const configured = responses[queryName];
        let response: QueryResult;

        if (typeof configured === "function") {
          response = configured(call, occurrence);
        } else if (Array.isArray(configured)) {
          const selected = configured[occurrence];

          if (!selected) {
            throw new Error(
              `Missing mocked ${queryName} response ${occurrence}.`,
            );
          }

          response = selected;
        } else {
          response = configured ?? defaultResult(queryName);
        }

        return {
          data: "data" in response ? response.data : null,
          error: response.error ?? null,
          count: "count" in response ? response.count : undefined,
        };
      });

      return builder;
    }),
  };

  mocks.createSupabase.mockReturnValue(client);

  return { calls, client };
}

function queries(calls: QueryCall[], name: QueryName) {
  return calls.filter((call) => identifyQuery(call) === name);
}

function onlyQuery(calls: QueryCall[], name: QueryName) {
  const matches = queries(calls, name);
  expect(matches).toHaveLength(1);
  return matches[0];
}

function revenueRow(index: number, total = "1.00") {
  return { id: `revenue-${index}`, total };
}

const NOW = new Date("2026-07-24T20:00:00.000Z");

const RECENT_ORDER = {
  id: "11111111-1111-4111-8111-111111111111",
  created_at: "2026-07-24T20:00:00.000Z",
  customer_name: "Sombre Customer",
  customer_email: "customer@example.com",
  total: "100.00",
  currency: "hkd",
  payment_status: "paid",
  order_status: "confirmed",
  fulfilment_status: "unfulfilled",
};

describe("Admin Home data layer", () => {
  beforeEach(() => {
    mocks.getAdminUser.mockReset();
    mocks.createSupabase.mockReset();
    mocks.getAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fails closed before creating a service-role client", async () => {
    mocks.getAdminUser.mockResolvedValue(null);
    stubClient();

    await expect(loadAdminHomeData(NOW)).rejects.toThrow(
      "Admin Home data requested without an approved session.",
    );
    expect(mocks.createSupabase).not.toHaveBeenCalled();
  });

  it("uses exact counts, shared stock boundaries, and minimized fields", async () => {
    const { calls } = stubClient({
      revenue: { data: [revenueRow(1)], count: 1 },
      awaitingCount: { count: 2 },
    });

    await loadAdminHomeData(NOW);

    expect(mocks.getAdminUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createSupabase.mock.invocationCallOrder[0],
    );

    const today = onlyQuery(calls, "ordersToday");
    expect(today.selectOptions).toEqual({ count: "exact", head: true });
    expect(method(today, "gte")[0]?.args).toEqual([
      "created_at",
      "2026-07-24T16:00:00.000Z",
    ]);
    expect(method(today, "lt")[0]?.args).toEqual([
      "created_at",
      "2026-07-25T16:00:00.000Z",
    ]);

    const revenue = onlyQuery(calls, "revenue");
    expect(revenue.columns).toBe("id, total");
    expect(revenue.selectOptions).toEqual({ count: "exact" });
    expect(method(revenue, "eq")).toEqual([
      { name: "eq", args: ["currency", "hkd"] },
      { name: "eq", args: ["order_status", "confirmed"] },
    ]);
    expect(method(revenue, "in")).toEqual([
      {
        name: "in",
        args: ["payment_status", ["paid", "no_payment_required"]],
      },
    ]);
    expect(method(revenue, "is")).toEqual([
      { name: "is", args: ["refund_id", null] },
      { name: "is", args: ["refund_status", null] },
    ]);
    expect(method(revenue, "order")[0]?.args).toEqual([
      "id",
      { ascending: true },
    ]);
    expect(method(revenue, "range")[0]?.args).toEqual([
      0,
      ADMIN_HOME_QUERY_PAGE_SIZE - 1,
    ]);

    const awaiting = onlyQuery(calls, "awaitingCount");
    expect(awaiting.selectOptions).toEqual({ count: "exact", head: true });
    expect(method(awaiting, "in")).toEqual([
      {
        name: "in",
        args: ["payment_status", ["paid", "no_payment_required"]],
      },
      {
        name: "in",
        args: ["fulfilment_status", ["unfulfilled", "processing"]],
      },
    ]);
    expect(method(awaiting, "eq")).toEqual([
      { name: "eq", args: ["order_status", "confirmed"] },
    ]);
    expect(method(awaiting, "is")).toEqual([
      { name: "is", args: ["refund_id", null] },
      { name: "is", args: ["refund_status", null] },
    ]);

    const lowStock = onlyQuery(calls, "lowStockCount");
    expect(lowStock.selectOptions).toEqual({ count: "exact", head: true });
    expect(method(lowStock, "gte")[0]?.args).toEqual(["stock_quantity", 1]);
    expect(method(lowStock, "lte")[0]?.args).toEqual(["stock_quantity", 5]);

    const outOfStock = onlyQuery(calls, "outOfStockCount");
    expect(outOfStock.selectOptions).toEqual({
      count: "exact",
      head: true,
    });
    expect(method(outOfStock, "eq")[0]?.args).toEqual(["stock_quantity", 0]);

    const recentOrders = onlyQuery(calls, "recentOrders");
    expect(recentOrders.columns).toBe(RECENT_ORDER_COLUMNS);
    expect(method(recentOrders, "limit")[0]?.args).toEqual([5]);

    const recentWebhook = onlyQuery(calls, "webhookFailures");
    const recentEmail = onlyQuery(calls, "emailFailures");
    expect(recentWebhook.columns).toBe(WEBHOOK_FAILURE_COLUMNS);
    expect(recentEmail.columns).toBe(EMAIL_FAILURE_COLUMNS);
    expect(recentWebhook.columns).not.toContain("error_message");
    expect(recentEmail.columns).not.toContain("error_message");

    const refundQueries = queries(calls, "refundFailures");
    expect(refundQueries).toHaveLength(2);
    const revenueRefundQuery = refundQueries.find((call) =>
      hasMethod(call, "in", "order_id"),
    );
    const awaitingRefundQuery = refundQueries.find(
      (call) => !hasMethod(call, "in", "order_id"),
    );
    expect(method(revenueRefundQuery!, "in")[0]?.args).toEqual([
      "order_id",
      ["revenue-1"],
    ]);
    expect(method(revenueRefundQuery!, "eq")).toEqual([]);
    expect(method(awaitingRefundQuery!, "eq")[0]?.args).toEqual([
      "is_resolved",
      false,
    ]);

    for (const call of refundQueries) {
      expect(call.selectOptions).toEqual({ count: "exact" });
      expect(method(call, "like")[0]?.args).toEqual([
        "stripe_event_type",
        "refund.%",
      ]);
      expect(method(call, "range")[0]?.args).toEqual([
        0,
        ADMIN_HOME_QUERY_PAGE_SIZE - 1,
      ]);
    }
  });

  it("paginates every revenue row and chunks linked-refund lookups", async () => {
    const rows = Array.from({ length: 201 }, (_, index) => revenueRow(index));
    const { calls } = stubClient({
      revenue: [
        { data: rows.slice(0, 100), count: 201 },
        { data: rows.slice(100, 200), count: 201 },
        { data: rows.slice(200), count: 201 },
      ],
    });

    const result = await loadAdminHomeData(NOW);

    expect(result.summary.revenueTodayCents).toEqual({
      value: 20_100,
      hasError: false,
    });
    expect(
      queries(calls, "revenue").map(
        (call) => method(call, "range")[0]?.args,
      ),
    ).toEqual([
      [0, 99],
      [100, 199],
      [200, 299],
    ]);

    const refundQueries = queries(calls, "refundFailures");
    expect(refundQueries).toHaveLength(5);
    expect(
      refundQueries.map(
        (call) =>
          (method(call, "in")[0]?.args[1] as string[]).length,
      ),
    ).toEqual([50, 50, 50, 50, 1]);
    expect(
      refundQueries.every(
        (call) =>
          (method(call, "in")[0]?.args[1] as string[]).length <=
          ADMIN_HOME_ID_CHUNK_SIZE,
      ),
    ).toBe(true);
  });

  it("paginates refund failures inside a revenue ID chunk", async () => {
    const firstPage = Array.from({ length: 100 }, () => ({
      order_id: "revenue-0",
    }));
    const { calls } = stubClient({
      revenue: {
        data: [revenueRow(0, "50.00"), revenueRow(1, "80.00")],
        count: 2,
      },
      refundFailures: [
        { data: firstPage, count: 101 },
        { data: [{ order_id: "revenue-1" }], count: 101 },
      ],
    });

    const result = await loadAdminHomeData(NOW);

    expect(result.summary.revenueTodayCents).toEqual({
      value: 0,
      hasError: false,
    });
    expect(
      queries(calls, "refundFailures").map(
        (call) => method(call, "range")[0]?.args,
      ),
    ).toEqual([
      [0, 99],
      [100, 199],
    ]);
  });

  it("subtracts distinct unresolved refund reviews with paginated and chunked reads", async () => {
    const duplicatedFailures = Array.from({ length: 50 }, (_, index) => [
      { order_id: `blocked-${index}` },
      { order_id: `blocked-${index}` },
    ]).flat();
    const { calls } = stubClient({
      awaitingCount: { count: 103 },
      refundFailures: [
        { data: duplicatedFailures, count: 101 },
        { data: [{ order_id: "blocked-50" }], count: 101 },
      ],
      refundEligibility: [
        {
          data: [{ id: "blocked-0" }, { id: "blocked-1" }],
          count: 2,
        },
        { data: [{ id: "blocked-50" }], count: 1 },
      ],
    });

    const result = await loadAdminHomeData(NOW);

    expect(result.summary.awaitingFulfilment).toEqual({
      value: 100,
      hasError: false,
    });

    const refundQueries = queries(calls, "refundFailures");
    expect(refundQueries).toHaveLength(2);
    expect(refundQueries.every((call) => !hasMethod(call, "in"))).toBe(true);
    expect(
      refundQueries.map((call) => method(call, "range")[0]?.args),
    ).toEqual([
      [0, 99],
      [100, 199],
    ]);

    const eligibilityQueries = queries(calls, "refundEligibility");
    expect(eligibilityQueries).toHaveLength(2);
    expect(
      eligibilityQueries.map(
        (call) => (method(call, "in")[0]?.args[1] as string[]).length,
      ),
    ).toEqual([50, 1]);

    for (const call of eligibilityQueries) {
      expect(call.selectOptions).toEqual({ count: "exact" });
      expect(method(call, "in")[1]?.args).toEqual([
        "payment_status",
        ["paid", "no_payment_required"],
      ]);
      expect(method(call, "in")[2]?.args).toEqual([
        "fulfilment_status",
        ["unfulfilled", "processing"],
      ]);
      expect(method(call, "eq")[0]?.args).toEqual([
        "order_status",
        "confirmed",
      ]);
    }
  });

  it("returns exact summaries and failure records without unused error text", async () => {
    const { calls } = stubClient({
      ordersToday: { count: 9 },
      revenue: {
        data: [
          revenueRow(0, "40.10"),
          { id: "partially-refunded", total: "100.00" },
        ],
        count: 2,
      },
      awaitingCount: { count: 3 },
      lowStockCount: { count: 2 },
      outOfStockCount: { count: 1 },
      refundFailures: (call) =>
        hasMethod(call, "in", "order_id")
          ? { data: [{ order_id: "partially-refunded" }], count: 1 }
          : { data: [], count: 0 },
      recentOrders: { data: [RECENT_ORDER] },
      webhookFailures: {
        data: [
          {
            id: "webhook-old",
            stripe_event_type: "refund.updated",
            order_id: "partially-refunded",
            failure_kind: "permanent",
            last_failed_at: "2026-07-24T20:00:00.000Z",
          },
        ],
      },
      emailFailures: {
        data: [
          {
            id: "email-new",
            order_id: "revenue-0",
            email_kind: "customer_order_confirmation",
            status: "failed",
            last_attempt_at: "2026-07-24T21:00:00.000Z",
          },
        ],
      },
    });

    const result = await loadAdminHomeData(NOW);

    expect(result.summary).toEqual({
      ordersToday: { value: 9, hasError: false },
      revenueTodayCents: { value: 4_010, hasError: false },
      awaitingFulfilment: { value: 3, hasError: false },
      lowStockProducts: { value: 2, hasError: false },
      outOfStockProducts: { value: 1, hasError: false },
    });
    expect(result.recentOrders).toEqual({
      items: [RECENT_ORDER],
      hasError: false,
    });
    expect(result.recentFailures).toEqual({
      hasError: false,
      items: [
        {
          source: "email",
          id: "email-new",
          orderId: "revenue-0",
          title: "customer_order_confirmation",
          status: "failed",
          occurredAt: "2026-07-24T21:00:00.000Z",
        },
        {
          source: "webhook",
          id: "webhook-old",
          orderId: "partially-refunded",
          title: "refund.updated",
          status: "permanent",
          occurredAt: "2026-07-24T20:00:00.000Z",
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("errorSummary");
    expect(
      calls.some((call) => call.columns?.includes("error_message")),
    ).toBe(false);
  });

  it("keeps independent sections usable when scalable reads fail", async () => {
    const privateError = { message: "private database detail" };
    stubClient({
      ordersToday: { count: 4 },
      revenue: [
        {
          data: Array.from({ length: 100 }, (_, index) =>
            revenueRow(index),
          ),
          count: 101,
        },
        { error: privateError, count: 101 },
      ],
      awaitingCount: { count: 2 },
      refundFailures: { error: privateError },
      lowStockCount: { error: privateError },
      outOfStockCount: { count: 8 },
      recentOrders: { error: privateError },
      webhookFailures: { error: privateError },
      emailFailures: {
        data: [
          {
            id: "email-1",
            order_id: "order-1",
            email_kind: "seller_order_notification",
            status: "failed",
            last_attempt_at: "2026-07-24T21:00:00.000Z",
          },
        ],
      },
    });

    const result = await loadAdminHomeData(NOW);

    expect(result.summary).toEqual({
      ordersToday: { value: 4, hasError: false },
      revenueTodayCents: { value: null, hasError: true },
      awaitingFulfilment: { value: null, hasError: true },
      lowStockProducts: { value: null, hasError: true },
      outOfStockProducts: { value: 8, hasError: false },
    });
    expect(result.recentOrders).toEqual({ items: [], hasError: true });
    expect(result.recentFailures).toMatchObject({
      hasError: true,
      items: [{ source: "email", id: "email-1" }],
    });
    expect(JSON.stringify(result)).not.toContain("private database detail");
  });

  it("turns malformed included revenue into a safe unavailable metric", async () => {
    stubClient({
      revenue: {
        data: [{ id: "malformed", total: "12.345" }],
        count: 1,
      },
    });

    const result = await loadAdminHomeData(NOW);

    expect(result.summary.revenueTodayCents).toEqual({
      value: null,
      hasError: true,
    });
    expect(console.error).toHaveBeenCalledWith(
      "Failed to calculate revenue for Admin Home:",
      expect.anything(),
    );
  });

  it("uses safe zero and empty states for successful empty queries", async () => {
    stubClient();

    const result = await loadAdminHomeData(NOW);

    expect(result.summary).toEqual({
      ordersToday: { value: 0, hasError: false },
      revenueTodayCents: { value: 0, hasError: false },
      awaitingFulfilment: { value: 0, hasError: false },
      lowStockProducts: { value: 0, hasError: false },
      outOfStockProducts: { value: 0, hasError: false },
    });
    expect(result.recentOrders).toEqual({ items: [], hasError: false });
    expect(result.recentFailures).toEqual({ items: [], hasError: false });
  });
});
