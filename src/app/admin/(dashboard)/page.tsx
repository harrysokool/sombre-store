import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  loadAdminHomeData,
  type AdminHomeMetric,
} from "@/lib/admin/home-data";
import {
  LOW_STOCK_THRESHOLD,
} from "@/lib/admin/inventory";
import { formatStatusLabel } from "@/lib/admin/status-tone";
import { formatHongKongDateTime } from "@/lib/format-date";
import { formatPrice } from "@/lib/storefront/format-price";
import { requireAdminUser } from "@/lib/supabase/admin-auth";

export const metadata: Metadata = {
  title: "Home",
};

export const dynamic = "force-dynamic";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-200/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141211]";

function formatActivityDate(value: string) {
  return formatHongKongDateTime(value, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MetricCard({
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
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-5">
      <dt className="text-xs uppercase tracking-[0.16em] text-stone-400">
        {label}
      </dt>
      <dd className="mt-3 break-words text-3xl font-medium leading-none text-stone-100 [overflow-wrap:anywhere] xl:text-2xl 2xl:text-3xl">
        {isUnavailable ? "Unavailable" : formatValue(metric.value)}
      </dd>
      <dd className="mt-3 text-xs leading-5 text-stone-400">
        {isUnavailable
          ? "This metric could not be loaded. Try again."
          : description}
      </dd>
    </div>
  );
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

function TextLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
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

function RecentOrders({
  data,
}: {
  data: Awaited<ReturnType<typeof loadAdminHomeData>>["recentOrders"];
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
                <StatusBadge
                  kind="payment"
                  value={order.payment_status}
                />
                <StatusBadge
                  kind="fulfilment"
                  value={order.fulfilment_status}
                />
                <time
                  dateTime={order.created_at}
                  className="text-xs text-stone-400"
                >
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
  data: Awaited<ReturnType<typeof loadAdminHomeData>>["recentFailures"];
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

      {data.hasError && data.items.length === 0 ? (
        <ActivityNotice role="status">
          Recent operational issues could not be loaded. Please try again.
        </ActivityNotice>
      ) : data.items.length === 0 ? (
        <ActivityNotice>No recent operational issues.</ActivityNotice>
      ) : (
        <>
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
                      {failure.source === "webhook"
                        ? "Webhook"
                        : "Email delivery"}
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
        </>
      )}
    </section>
  );
}

const QUICK_ACTIONS = [
  {
    label: "View orders",
    href: "/admin/orders",
    description: "Review payment and fulfilment status.",
  },
  {
    label: "View inventory",
    href: "/admin/inventory",
    description: "Check availability across the catalogue.",
  },
  {
    label: "View coupons",
    href: "/admin/coupons",
    description: "Review and manage existing promotions.",
  },
  {
    label: "View operations",
    href: "/admin/operations",
    description: "Inspect webhook and email delivery queues.",
  },
] as const;

function QuickActions() {
  return (
    <section aria-labelledby="quick-actions-heading" className="space-y-4">
      <SectionHeader
        id="quick-actions-heading"
        title="Quick actions"
        description="Go directly to the most common admin tasks."
      />

      <nav aria-label="Admin quick actions">
        <ul className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_ACTIONS.map((action) => (
            <li key={action.href} className="min-w-0">
              <Link
                href={action.href}
                className={`block h-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-5 transition-colors hover:border-white/20 hover:bg-white/[0.05] ${focusRing}`}
              >
                <span className="block text-sm font-medium text-stone-100">
                  {action.label}
                </span>
                <span className="mt-2 block text-xs leading-5 text-stone-400">
                  {action.description}
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

  return (
    <div className="min-w-0 space-y-10">
      <AdminPageHeader
        title="Home"
        description="A concise view of today’s orders, stock, and operational health. All dates and day boundaries use Hong Kong time."
      />

      <dl
        aria-label="Admin Home summary"
        className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      >
        <MetricCard
          label="Orders today"
          metric={data.summary.ordersToday}
          description="Orders created since midnight in Hong Kong."
        />
        <MetricCard
          label="Revenue today"
          metric={data.summary.revenueTodayCents}
          formatValue={(cents) => formatPrice(cents / 100)}
          description="Normal confirmed HKD sales, excluding every order with a recorded refund."
        />
        <MetricCard
          label="Orders awaiting fulfilment"
          metric={data.summary.awaitingFulfilment}
          description="Settled, confirmed orders still unfulfilled or processing."
        />
        <MetricCard
          label="Low stock products"
          metric={data.summary.lowStockProducts}
          description={`Products with 1–${LOW_STOCK_THRESHOLD} units remaining.`}
        />
        <MetricCard
          label="Out of stock products"
          metric={data.summary.outOfStockProducts}
          description="Products with no units remaining."
        />
      </dl>

      <div className="grid min-w-0 gap-10 xl:grid-cols-2">
        <RecentOrders data={data.recentOrders} />
        <RecentFailures data={data.recentFailures} />
      </div>

      <QuickActions />
    </div>
  );
}
