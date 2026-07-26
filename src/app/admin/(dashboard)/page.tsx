import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  loadAdminHomeData,
  type AdminHomeData,
  type AdminHomeMetric,
} from "@/lib/admin/home-data";
import { LOW_STOCK_THRESHOLD } from "@/lib/admin/inventory";
import {
  formatStatusLabel,
  STATUS_TONE_CLASSES,
  type StatusTone,
} from "@/lib/admin/status-tone";
import { formatHongKongDateTime } from "@/lib/format-date";
import { formatPrice } from "@/lib/storefront/format-price";
import { requireAdminUser } from "@/lib/supabase/admin-auth";

export const metadata: Metadata = {
  title: "Home",
};

export const dynamic = "force-dynamic";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-200/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141211]";

const UNAVAILABLE_METRIC_TEXT = "This metric could not be loaded. Try again.";
const UNAVAILABLE_CHECK_TEXT = "This could not be checked. Try again.";

function formatActivityDate(value: string) {
  return formatHongKongDateTime(value, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SectionHeader({
  id,
  title,
  description,
  action,
}: {
  id: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <h2
          id={id}
          className="break-words text-xl font-medium tracking-[0.06em] text-stone-100 sm:text-2xl"
        >
          {title}
        </h2>
        <p className="text-sm leading-6 text-stone-400">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex rounded-lg text-sm text-stone-300 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white ${focusRing}`}
    >
      {children}
    </Link>
  );
}

function ActivityNotice({
  children,
  role,
}: {
  children: ReactNode;
  role?: "status";
}) {
  return (
    <p
      role={role}
      className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-8 text-center text-sm leading-6 text-stone-400"
    >
      {children}
    </p>
  );
}

// One compact number inside the connected overview panel. Revenue is rendered
// separately as the lead figure; every other metric shares this smaller,
// scannable form so the panel reads as one business picture, not five cards.
function CompactMetric({
  label,
  metric,
  description,
  formatValue = (value) => value.toLocaleString("en-HK"),
}: {
  label: string;
  metric: AdminHomeMetric<number>;
  description: string;
  formatValue?: (value: number) => string;
}) {
  const isUnavailable = metric.hasError || metric.value === null;

  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-[0.16em] text-stone-400">
        {label}
      </dt>
      <dd className="mt-2 break-words text-xl font-medium leading-none text-stone-100 [overflow-wrap:anywhere] sm:text-2xl">
        {isUnavailable ? "Unavailable" : formatValue(metric.value)}
      </dd>
      <dd className="mt-2 text-xs leading-5 text-stone-400">
        {isUnavailable ? UNAVAILABLE_METRIC_TEXT : description}
      </dd>
    </div>
  );
}

function BusinessSummary({ summary }: { summary: AdminHomeData["summary"] }) {
  const revenue = summary.revenueTodayCents;
  const isRevenueUnavailable = revenue.hasError || revenue.value === null;

  return (
    <section aria-labelledby="business-summary-heading" className="space-y-4">
      <SectionHeader
        id="business-summary-heading"
        title="Overview"
        description="Today’s sales and orders, plus current stock levels."
      />

      <dl
        aria-label="Admin Home summary"
        className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-6 sm:px-6"
      >
        <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch xl:gap-8">
          <div className="min-w-0 xl:w-64 xl:shrink-0 xl:border-r xl:border-white/10 xl:pr-8">
            <dt className="text-xs uppercase tracking-[0.16em] text-stone-400">
              Revenue today
            </dt>
            <dd className="mt-2 break-words text-4xl font-medium leading-none text-stone-100 [overflow-wrap:anywhere]">
              {isRevenueUnavailable
                ? "Unavailable"
                : formatPrice(revenue.value / 100)}
            </dd>
            <dd className="mt-2 text-xs leading-5 text-stone-400">
              {isRevenueUnavailable
                ? UNAVAILABLE_METRIC_TEXT
                : "Normal confirmed HKD sales, excluding every order with a recorded refund."}
            </dd>
          </div>

          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <CompactMetric
              label="Orders today"
              metric={summary.ordersToday}
              description="Orders created since midnight in Hong Kong."
            />
            <CompactMetric
              label="Orders awaiting fulfilment"
              metric={summary.awaitingFulfilment}
              description="Settled, confirmed orders still unfulfilled or processing."
            />
            <CompactMetric
              label="Low stock products"
              metric={summary.lowStockProducts}
              description={`Products with 1–${LOW_STOCK_THRESHOLD} units remaining.`}
            />
            <CompactMetric
              label="Out of stock products"
              metric={summary.outOfStockProducts}
              description="Products with no units remaining."
            />
          </div>
        </div>
      </dl>
    </section>
  );
}

type AdminHomeTask = {
  key: string;
  label: string;
  href: string;
  description: string;
} & (
  | { state: "count"; count: number; tone: StatusTone }
  | { state: "unavailable" }
);

// Every condition here already has an exact, previously-verified count (or an
// explicit load failure) from `loadAdminHomeData`. Nothing is queried again
// here — a zero-count condition is simply left out of the list, and the page
// shows one calm confirmation when nothing qualifies.
function getAdminHomeTasks(data: AdminHomeData): AdminHomeTask[] {
  const tasks: AdminHomeTask[] = [];
  const { awaitingFulfilment, lowStockProducts, outOfStockProducts } =
    data.summary;
  const { recentFailures } = data;

  if (awaitingFulfilment.hasError) {
    tasks.push({
      key: "awaiting-fulfilment",
      label: "Orders awaiting fulfilment",
      href: "/admin/orders",
      description: UNAVAILABLE_CHECK_TEXT,
      state: "unavailable",
    });
  } else if (awaitingFulfilment.value > 0) {
    tasks.push({
      key: "awaiting-fulfilment",
      label: "Orders awaiting fulfilment",
      href: "/admin/orders",
      description: "Settled, confirmed orders still unfulfilled or processing.",
      state: "count",
      count: awaitingFulfilment.value,
      tone: "pending",
    });
  }

  if (lowStockProducts.hasError) {
    tasks.push({
      key: "low-stock",
      label: "Low stock products",
      href: "/admin/inventory?stock=low-stock",
      description: UNAVAILABLE_CHECK_TEXT,
      state: "unavailable",
    });
  } else if (lowStockProducts.value > 0) {
    tasks.push({
      key: "low-stock",
      label: "Low stock products",
      href: "/admin/inventory?stock=low-stock",
      description: `Products with 1–${LOW_STOCK_THRESHOLD} units remaining.`,
      state: "count",
      count: lowStockProducts.value,
      tone: "pending",
    });
  }

  if (outOfStockProducts.hasError) {
    tasks.push({
      key: "out-of-stock",
      label: "Out of stock products",
      href: "/admin/inventory?stock=out-of-stock",
      description: UNAVAILABLE_CHECK_TEXT,
      state: "unavailable",
    });
  } else if (outOfStockProducts.value > 0) {
    tasks.push({
      key: "out-of-stock",
      label: "Out of stock products",
      href: "/admin/inventory?stock=out-of-stock",
      description: "Products with no units remaining.",
      state: "count",
      count: outOfStockProducts.value,
      tone: "danger",
    });
  }

  if (recentFailures.hasError && recentFailures.items.length === 0) {
    tasks.push({
      key: "operational-issues",
      label: "Operational issues",
      href: "/admin/operations",
      description: UNAVAILABLE_CHECK_TEXT,
      state: "unavailable",
    });
  } else if (recentFailures.items.length > 0) {
    tasks.push({
      key: "operational-issues",
      label: "Operational issues",
      href: "/admin/operations",
      description: recentFailures.hasError
        ? "Unresolved webhook failures or failed email deliveries. Some could not be loaded."
        : "Unresolved webhook failures or failed email deliveries.",
      state: "count",
      count: recentFailures.items.length,
      tone: "danger",
    });
  }

  return tasks;
}

function TaskRow({ task }: { task: AdminHomeTask }) {
  const isUnavailable = task.state === "unavailable";
  const pillTone = isUnavailable ? "neutral" : task.tone;

  return (
    <li className="min-w-0">
      <Link
        href={task.href}
        aria-label={`${task.label}: ${
          isUnavailable ? "unavailable" : task.count
        }. ${task.description}`}
        className={`flex min-w-0 items-start justify-between gap-4 px-4 py-4 transition-colors hover:bg-white/[0.04] sm:px-5 ${focusRing}`}
      >
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-stone-100 [overflow-wrap:anywhere]">
            {task.label}
          </p>
          <p className="mt-1 break-words text-xs leading-5 text-stone-400 [overflow-wrap:anywhere]">
            {task.description}
          </p>
        </div>
        <span
          aria-hidden="true"
          className={`inline-flex min-w-[2.75rem] shrink-0 items-center justify-center rounded-full border px-3 py-1 text-sm font-medium ${STATUS_TONE_CLASSES[pillTone]}`}
        >
          {isUnavailable ? "N/A" : task.count.toLocaleString("en-HK")}
        </span>
      </Link>
    </li>
  );
}

function NeedsAttention({ tasks }: { tasks: AdminHomeTask[] }) {
  return (
    <section aria-labelledby="needs-attention-heading" className="space-y-4">
      <SectionHeader
        id="needs-attention-heading"
        title="Needs attention"
        description="Actionable items that may need a decision or a fix."
      />

      {tasks.length === 0 ? (
        <p
          role="status"
          className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6 text-sm leading-6 text-stone-300"
        >
          All clear — nothing needs attention right now.
        </p>
      ) : (
        <ul
          aria-label="Needs attention"
          className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
        >
          {tasks.map((task) => (
            <TaskRow key={task.key} task={task} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentOrders({
  data,
}: {
  data: AdminHomeData["recentOrders"];
}) {
  return (
    <section
      aria-labelledby="recent-orders-heading"
      className="min-w-0 space-y-4"
    >
      <SectionHeader
        id="recent-orders-heading"
        title="Recent orders"
        description="The five newest orders, shown in Hong Kong time."
        action={<TextLink href="/admin/orders">View all orders</TextLink>}
      />

      {data.hasError ? (
        <ActivityNotice role="status">
          Recent orders could not be loaded. Please try again.
        </ActivityNotice>
      ) : data.items.length === 0 ? (
        <ActivityNotice>No recent orders.</ActivityNotice>
      ) : (
        <ul
          aria-label="Recent orders"
          className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
        >
          {data.items.map((order) => (
            <li
              key={order.id}
              className="min-w-0 space-y-3 px-4 py-4 sm:px-5"
            >
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    aria-label={`Open order ${order.id}`}
                    className={`block w-fit max-w-full break-all font-mono text-sm text-stone-100 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white ${focusRing}`}
                  >
                    {order.id.slice(0, 8)}
                  </Link>
                  <p className="mt-1 min-w-0 break-words text-sm text-stone-300 [overflow-wrap:anywhere]">
                    {order.customer_name || "Customer name unavailable"}
                  </p>
                  <p className="min-w-0 break-words text-xs leading-5 text-stone-400 [overflow-wrap:anywhere]">
                    {order.customer_email || "Email unavailable"}
                  </p>
                </div>

                <p className="shrink-0 text-sm font-medium text-stone-100">
                  {formatPrice(order.total)}
                </p>
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <StatusBadge kind="payment" value={order.payment_status} />
                <StatusBadge kind="fulfilment" value={order.fulfilment_status} />
                <time dateTime={order.created_at} className="text-xs text-stone-400">
                  {formatActivityDate(order.created_at)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentFailures({
  data,
}: {
  data: AdminHomeData["recentFailures"];
}) {
  const hasPartialError = data.hasError && data.items.length > 0;

  return (
    <section
      aria-labelledby="recent-failures-heading"
      className="min-w-0 space-y-4"
    >
      <SectionHeader
        id="recent-failures-heading"
        title="Recent operational issues"
        description="Unresolved webhook and failed email deliveries that may need attention."
        action={<TextLink href="/admin/operations">View operations</TextLink>}
      />

      {hasPartialError ? (
        <p
          role="status"
          className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm leading-6 text-stone-400"
        >
          Some operational issues could not be loaded. Available items are
          shown below.
        </p>
      ) : null}

      <ul
        aria-label="Recent operational issues"
        className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
      >
        {data.items.map((failure) => (
          <li
            key={`${failure.source}-${failure.id}`}
            className="min-w-0 space-y-3 px-4 py-4 sm:px-5"
          >
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p className="break-words text-sm text-stone-100 [overflow-wrap:anywhere]">
                  {formatStatusLabel(failure.title)}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-stone-400">
                  {failure.source === "webhook" ? "Webhook" : "Email delivery"}
                </p>
              </div>
              <StatusBadge
                kind={failure.source === "webhook" ? "webhook" : "email"}
                value={failure.status}
              />
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs text-stone-400">
              {failure.orderId ? (
                <Link
                  href={`/admin/orders/${failure.orderId}`}
                  aria-label={`Open related order ${failure.orderId}`}
                  className={`break-all font-mono text-stone-300 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white ${focusRing}`}
                >
                  Order {failure.orderId.slice(0, 8)}
                </Link>
              ) : (
                <span>Not linked to an order</span>
              )}
              <time dateTime={failure.occurredAt}>
                {formatActivityDate(failure.occurredAt)}
              </time>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const QUICK_ACTIONS = [
  { label: "View orders", href: "/admin/orders" },
  { label: "View inventory", href: "/admin/inventory" },
  { label: "View coupons", href: "/admin/coupons" },
  { label: "View operations", href: "/admin/operations" },
] as const;

function QuickActions() {
  return (
    <section aria-labelledby="quick-actions-heading" className="min-w-0 space-y-4">
      <SectionHeader
        id="quick-actions-heading"
        title="Quick actions"
        description="Jump to the most common admin tasks."
      />

      <nav aria-label="Admin quick actions">
        <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          {QUICK_ACTIONS.map((action) => (
            <li key={action.href} className="min-w-0">
              <Link
                href={action.href}
                className={`flex min-w-0 items-center justify-between gap-3 px-4 py-3.5 text-sm text-stone-200 transition-colors hover:bg-white/[0.05] hover:text-white ${focusRing}`}
              >
                <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                  {action.label}
                </span>
                <span aria-hidden="true" className="shrink-0 text-stone-400">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}

export default async function AdminHomePage() {
  // Keep redirects outside all dashboard data error handling.
  await requireAdminUser();

  const data = await loadAdminHomeData();
  const tasks = getAdminHomeTasks(data);
  const hasOperationalIssues = data.recentFailures.items.length > 0;

  return (
    <div className="min-w-0 space-y-10">
      <AdminPageHeader
        title="Home"
        description="Today’s orders, stock, and open tasks — all times in Hong Kong."
      />

      <BusinessSummary summary={data.summary} />

      <NeedsAttention tasks={tasks} />

      <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 space-y-10">
          <RecentOrders data={data.recentOrders} />
          {hasOperationalIssues ? (
            <RecentFailures data={data.recentFailures} />
          ) : null}
        </div>

        <QuickActions />
      </div>
    </div>
  );
}
