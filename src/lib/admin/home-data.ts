import "server-only";

import {
  ADMIN_HOME_RECENT_LIMIT,
  AWAITING_FULFILMENT_STATUSES,
  calculateAdminHomeRevenueCents,
  selectRecentAdminHomeFailures,
  type AdminHomeRecentFailure,
  type AdminHomeRecentOrder,
  type AdminHomeRevenueOrder,
} from "@/lib/admin/home";
import { SETTLED_PAYMENT_STATUSES } from "@/lib/admin/fulfilment-rules";
import {
  LOW_STOCK_MIN_QUANTITY,
  LOW_STOCK_THRESHOLD,
  OUT_OF_STOCK_QUANTITY,
} from "@/lib/admin/inventory";
import {
  getHongKongDayBounds,
  type HongKongDayBounds,
} from "@/lib/format-date";
import { getAdminUser } from "@/lib/supabase/admin-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const REVENUE_COLUMNS = "id, total";

const RECENT_ORDER_COLUMNS =
  "id, created_at, customer_name, customer_email, total, currency, payment_status, order_status, fulfilment_status";

const RECENT_WEBHOOK_FAILURE_COLUMNS =
  "id, stripe_event_type, order_id, failure_kind, last_failed_at";

const RECENT_EMAIL_FAILURE_COLUMNS =
  "id, order_id, email_kind, status, last_attempt_at";

export const ADMIN_HOME_QUERY_PAGE_SIZE = 100;
export const ADMIN_HOME_ID_CHUNK_SIZE = 50;

type ServiceRoleClient = ReturnType<
  typeof createSupabaseServiceRoleClient
>;

type RefundReviewRow = {
  order_id: string | null;
};

type RecentWebhookFailureRow = {
  id: string;
  stripe_event_type: string;
  order_id: string | null;
  failure_kind: string;
  last_failed_at: string;
};

type RecentEmailFailureRow = {
  id: string;
  order_id: string;
  email_kind: string;
  status: string;
  last_attempt_at: string;
};

export type AdminHomeMetric<T> =
  | {
      value: T;
      hasError: false;
    }
  | {
      value: null;
      hasError: true;
    };

export type AdminHomeList<T> = {
  items: T[];
  hasError: boolean;
};

export type AdminHomeData = {
  dayBounds: HongKongDayBounds;
  summary: {
    ordersToday: AdminHomeMetric<number>;
    revenueTodayCents: AdminHomeMetric<number>;
    awaitingFulfilment: AdminHomeMetric<number>;
    lowStockProducts: AdminHomeMetric<number>;
    outOfStockProducts: AdminHomeMetric<number>;
  };
  recentOrders: AdminHomeList<AdminHomeRecentOrder>;
  recentFailures: AdminHomeList<AdminHomeRecentFailure>;
};

async function assertAdmin() {
  const adminUser = await getAdminUser();

  if (!adminUser) {
    throw new Error("Admin Home data requested without an approved session.");
  }
}

function requireExactCount(count: number | null, label: string) {
  if (
    typeof count !== "number" ||
    !Number.isSafeInteger(count) ||
    count < 0
  ) {
    throw new Error(`${label} did not return an exact count.`);
  }

  return count;
}

function chunksOf<Value>(values: readonly Value[], size: number) {
  const chunks: Value[][] = [];

  for (let offset = 0; offset < values.length; offset += size) {
    chunks.push(values.slice(offset, offset + size));
  }

  return chunks;
}

async function countOrdersToday(
  supabase: ServiceRoleClient,
  bounds: HongKongDayBounds,
) {
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .gte("created_at", bounds.startInclusive)
    .lt("created_at", bounds.endExclusive)
    .returns<never[]>();

  if (error) {
    throw error;
  }

  return requireExactCount(count, "The orders-today query");
}

async function listRevenueOrdersToday(
  supabase: ServiceRoleClient,
  bounds: HongKongDayBounds,
) {
  const rows: AdminHomeRevenueOrder[] = [];
  let expectedCount: number | null = null;

  while (expectedCount === null || rows.length < expectedCount) {
    const offset = rows.length;
    const { data, error, count } = await supabase
      .from("orders")
      .select(REVENUE_COLUMNS, { count: "exact" })
      .gte("created_at", bounds.startInclusive)
      .lt("created_at", bounds.endExclusive)
      .eq("currency", "hkd")
      .in("payment_status", [...SETTLED_PAYMENT_STATUSES])
      .eq("order_status", "confirmed")
      .is("refund_id", null)
      .is("refund_status", null)
      .order("id", { ascending: true })
      .range(offset, offset + ADMIN_HOME_QUERY_PAGE_SIZE - 1)
      .returns<AdminHomeRevenueOrder[]>();

    if (error) {
      throw error;
    }

    const pageCount = requireExactCount(count, "The revenue query");

    if (expectedCount === null) {
      expectedCount = pageCount;
    } else if (pageCount !== expectedCount) {
      throw new Error("The revenue row count changed during pagination.");
    }

    const page = data ?? [];

    if (page.length === 0 && rows.length < expectedCount) {
      throw new Error("The revenue query ended before every row was read.");
    }

    if (rows.length + page.length > expectedCount) {
      throw new Error("The revenue query returned more rows than its count.");
    }

    rows.push(...page);
  }

  return rows;
}

async function countAwaitingFulfilmentOrders(
  supabase: ServiceRoleClient,
) {
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("payment_status", [...SETTLED_PAYMENT_STATUSES])
    .eq("order_status", "confirmed")
    .in("fulfilment_status", [...AWAITING_FULFILMENT_STATUSES])
    .is("refund_id", null)
    .is("refund_status", null)
    .returns<never[]>();

  if (error) {
    throw error;
  }

  return requireExactCount(count, "The awaiting-fulfilment query");
}

async function countLowStockProducts(supabase: ServiceRoleClient) {
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .gte("stock_quantity", LOW_STOCK_MIN_QUANTITY)
    .lte("stock_quantity", LOW_STOCK_THRESHOLD)
    .returns<never[]>();

  if (error) {
    throw error;
  }

  return requireExactCount(count, "The low-stock query");
}

async function countOutOfStockProducts(supabase: ServiceRoleClient) {
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("stock_quantity", OUT_OF_STOCK_QUANTITY)
    .returns<never[]>();

  if (error) {
    throw error;
  }

  return requireExactCount(count, "The out-of-stock query");
}

async function listRefundFailureOrderIds(
  supabase: ServiceRoleClient,
  options:
    | {
        candidateOrderIds: readonly string[];
        unresolvedOnly?: false;
      }
    | {
        candidateOrderIds?: undefined;
        unresolvedOnly: true;
      },
) {
  const uniqueCandidates =
    options.candidateOrderIds === undefined
      ? null
      : [...new Set(options.candidateOrderIds)];
  const candidateChunks =
    uniqueCandidates === null
      ? [null]
      : chunksOf(uniqueCandidates, ADMIN_HOME_ID_CHUNK_SIZE);
  const orderIds = new Set<string>();

  for (const candidateChunk of candidateChunks) {
    let rowsRead = 0;
    let expectedCount: number | null = null;

    while (expectedCount === null || rowsRead < expectedCount) {
      const baseQuery = supabase
        .from("webhook_failures")
        .select("order_id", { count: "exact" });
      const candidateQuery =
        candidateChunk === null
          ? baseQuery
          : baseQuery.in("order_id", candidateChunk);
      const resolutionQuery = options.unresolvedOnly
        ? candidateQuery.eq("is_resolved", false)
        : candidateQuery;
      const { data, error, count } = await resolutionQuery
        .like("stripe_event_type", "refund.%")
        .order("id", { ascending: true })
        .range(rowsRead, rowsRead + ADMIN_HOME_QUERY_PAGE_SIZE - 1)
        .returns<RefundReviewRow[]>();

      if (error) {
        throw error;
      }

      const pageCount = requireExactCount(count, "The refund-failure query");

      if (expectedCount === null) {
        expectedCount = pageCount;
      } else if (pageCount !== expectedCount) {
        throw new Error(
          "The refund-failure row count changed during pagination.",
        );
      }

      const page = data ?? [];

      if (page.length === 0 && rowsRead < expectedCount) {
        throw new Error(
          "The refund-failure query ended before every row was read.",
        );
      }

      if (rowsRead + page.length > expectedCount) {
        throw new Error(
          "The refund-failure query returned more rows than its count.",
        );
      }

      for (const row of page) {
        if (row.order_id) {
          orderIds.add(row.order_id);
        }
      }

      rowsRead += page.length;
    }
  }

  return orderIds;
}

async function countAwaitingOrdersUnderRefundReview(
  supabase: ServiceRoleClient,
) {
  const unresolvedOrderIds = await listRefundFailureOrderIds(supabase, {
    unresolvedOnly: true,
  });
  const eligibleOrderIds = new Set<string>();

  for (const orderIdChunk of chunksOf(
    [...unresolvedOrderIds],
    ADMIN_HOME_ID_CHUNK_SIZE,
  )) {
    const { data, error, count } = await supabase
      .from("orders")
      .select("id", { count: "exact" })
      .in("id", orderIdChunk)
      .in("payment_status", [...SETTLED_PAYMENT_STATUSES])
      .eq("order_status", "confirmed")
      .in("fulfilment_status", [...AWAITING_FULFILMENT_STATUSES])
      .is("refund_id", null)
      .is("refund_status", null)
      .returns<Array<{ id: string }>>();

    if (error) {
      throw error;
    }

    const rows = data ?? [];
    const exactCount = requireExactCount(
      count,
      "The refund-review eligibility query",
    );

    if (rows.length !== exactCount) {
      throw new Error(
        "The refund-review eligibility query did not return every row.",
      );
    }

    for (const row of rows) {
      eligibleOrderIds.add(row.id);
    }
  }

  return eligibleOrderIds.size;
}

async function listRecentOrders(supabase: ServiceRoleClient) {
  const { data, error } = await supabase
    .from("orders")
    .select(RECENT_ORDER_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(ADMIN_HOME_RECENT_LIMIT)
    .returns<AdminHomeRecentOrder[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).slice(0, ADMIN_HOME_RECENT_LIMIT);
}

async function listRecentWebhookFailures(
  supabase: ServiceRoleClient,
): Promise<AdminHomeRecentFailure[]> {
  const { data, error } = await supabase
    .from("unresolved_webhook_failures")
    .select(RECENT_WEBHOOK_FAILURE_COLUMNS)
    .order("last_failed_at", { ascending: false })
    .limit(ADMIN_HOME_RECENT_LIMIT)
    .returns<RecentWebhookFailureRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map((failure) => ({
    source: "webhook",
    id: failure.id,
    orderId: failure.order_id,
    title: failure.stripe_event_type,
    status: failure.failure_kind,
    occurredAt: failure.last_failed_at,
  }));
}

async function listRecentEmailFailures(
  supabase: ServiceRoleClient,
): Promise<AdminHomeRecentFailure[]> {
  const { data, error } = await supabase
    .from("unsent_order_emails")
    .select(RECENT_EMAIL_FAILURE_COLUMNS)
    .eq("status", "failed")
    .order("last_attempt_at", { ascending: false })
    .limit(ADMIN_HOME_RECENT_LIMIT)
    .returns<RecentEmailFailureRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map((failure) => ({
    source: "email",
    id: failure.id,
    orderId: failure.order_id,
    title: failure.email_kind,
    status: failure.status,
    occurredAt: failure.last_attempt_at,
  }));
}

function metricSuccess<T>(value: T): AdminHomeMetric<T> {
  return { value, hasError: false };
}

function metricFailure<T>(): AdminHomeMetric<T> {
  return { value: null, hasError: true };
}

function metricFromResult<T>(
  result: PromiseSettledResult<T>,
): AdminHomeMetric<T> {
  return result.status === "fulfilled"
    ? metricSuccess(result.value)
    : metricFailure();
}

function logRejectedQuery(
  label: string,
  result: PromiseSettledResult<unknown>,
) {
  if (result.status === "rejected") {
    console.error(`Failed to load ${label} for Admin Home:`, result.reason);
  }
}

/**
 * Loads the protected Admin Home in small, independent reads.
 *
 * A single failed query never turns into a misleading zero and does not hide
 * unrelated data. Authentication is checked before the service-role client is
 * created, and no raw database error is included in the returned value.
 */
export async function loadAdminHomeData(
  now: Date = new Date(),
): Promise<AdminHomeData> {
  await assertAdmin();

  const dayBounds = getHongKongDayBounds(now);
  const supabase = createSupabaseServiceRoleClient();
  const [
    ordersTodayResult,
    revenueRowsResult,
    awaitingCountResult,
    lowStockCountResult,
    outOfStockCountResult,
    recentOrdersResult,
    webhookFailuresResult,
    emailFailuresResult,
  ] = await Promise.allSettled([
    countOrdersToday(supabase, dayBounds),
    listRevenueOrdersToday(supabase, dayBounds),
    countAwaitingFulfilmentOrders(supabase),
    countLowStockProducts(supabase),
    countOutOfStockProducts(supabase),
    listRecentOrders(supabase),
    listRecentWebhookFailures(supabase),
    listRecentEmailFailures(supabase),
  ] as const);

  const [revenueRefundIdsResult, awaitingRefundCountResult] =
    await Promise.allSettled([
      revenueRowsResult.status === "fulfilled"
        ? listRefundFailureOrderIds(supabase, {
            candidateOrderIds: revenueRowsResult.value.map(({ id }) => id),
          })
        : Promise.resolve(new Set<string>()),
      awaitingCountResult.status === "fulfilled" &&
      awaitingCountResult.value > 0
        ? countAwaitingOrdersUnderRefundReview(supabase)
        : Promise.resolve(0),
    ] as const);

  const namedResults = [
    ["orders today", ordersTodayResult],
    ["revenue orders", revenueRowsResult],
    ["awaiting fulfilment count", awaitingCountResult],
    ["low-stock count", lowStockCountResult],
    ["out-of-stock count", outOfStockCountResult],
    ["recent orders", recentOrdersResult],
    ["webhook failures", webhookFailuresResult],
    ["email failures", emailFailuresResult],
    ["revenue refund reviews", revenueRefundIdsResult],
    ["awaiting refund reviews", awaitingRefundCountResult],
  ] as const;

  for (const [label, result] of namedResults) {
    logRejectedQuery(label, result);
  }

  let revenueTodayCents = metricFailure<number>();
  let awaitingFulfilment = metricFailure<number>();

  if (
    revenueRowsResult.status === "fulfilled" &&
    revenueRefundIdsResult.status === "fulfilled"
  ) {
    try {
      revenueTodayCents = metricSuccess(
        calculateAdminHomeRevenueCents(
          revenueRowsResult.value,
          revenueRefundIdsResult.value,
        ),
      );
    } catch (error) {
      console.error("Failed to calculate revenue for Admin Home:", error);
    }
  }

  if (
    awaitingCountResult.status === "fulfilled" &&
    awaitingRefundCountResult.status === "fulfilled"
  ) {
    const adjustedCount =
      awaitingCountResult.value - awaitingRefundCountResult.value;

    if (adjustedCount >= 0) {
      awaitingFulfilment = metricSuccess(
        adjustedCount,
      );
    } else {
      console.error(
        "Failed to calculate awaiting fulfilment for Admin Home: the blocked count exceeded the eligible count.",
      );
    }
  }

  const recentFailureItems = [
    ...(webhookFailuresResult.status === "fulfilled"
      ? webhookFailuresResult.value
      : []),
    ...(emailFailuresResult.status === "fulfilled"
      ? emailFailuresResult.value
      : []),
  ];

  return {
    dayBounds,
    summary: {
      ordersToday: metricFromResult(ordersTodayResult),
      revenueTodayCents,
      awaitingFulfilment,
      lowStockProducts: metricFromResult(lowStockCountResult),
      outOfStockProducts: metricFromResult(outOfStockCountResult),
    },
    recentOrders: {
      items:
        recentOrdersResult.status === "fulfilled"
          ? recentOrdersResult.value
          : [],
      hasError: recentOrdersResult.status === "rejected",
    },
    recentFailures: {
      items: selectRecentAdminHomeFailures(recentFailureItems),
      hasError:
        webhookFailuresResult.status === "rejected" ||
        emailFailuresResult.status === "rejected",
    },
  };
}
