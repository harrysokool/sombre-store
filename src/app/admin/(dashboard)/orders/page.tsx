import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { listAdminOrders, type AdminOrderListItem } from "@/lib/admin/orders";
import { formatHongKongDateTime } from "@/lib/format-date";
import { formatPrice } from "@/lib/storefront/format-price";
import { requireAdminUser } from "@/lib/supabase/admin-auth";

export const metadata: Metadata = {
  title: "Orders",
};

export const dynamic = "force-dynamic";

function formatOrderDate(value: string) {
  return formatHongKongDateTime(value, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// One labelled field inside a mobile order card. The label stacks above the
// value on the narrowest screens so a long email never squeezes into a sliver.
function CardField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-xs uppercase tracking-[0.18em] text-stone-400">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm text-stone-200 [overflow-wrap:anywhere]">
        {children}
      </dd>
    </div>
  );
}

async function loadOrders() {
  try {
    return { orders: await listAdminOrders(), hasError: false };
  } catch (error) {
    console.error("Failed to load orders for /admin/orders:", error);
    return { orders: [] as AdminOrderListItem[], hasError: true };
  }
}

function OrdersContent({
  orders,
  hasError,
}: {
  orders: AdminOrderListItem[];
  hasError: boolean;
}) {
  if (hasError) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center text-sm text-stone-400">
        Orders could not be loaded. Please try again.
      </p>
    );
  }

  if (orders.length === 0) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center text-sm text-stone-400">
        No orders yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs uppercase tracking-[0.22em] text-stone-400">
        {orders.length} {orders.length === 1 ? "order" : "orders"}
      </p>

      {/* Small screens: one stacked card per order, so nothing has to be
          scrolled sideways to be read. The table below takes over at `lg`,
          which is the first width where it fits without a squeeze. */}
      <ul aria-label="Orders" className="space-y-3 lg:hidden">
        {orders.map((order) => (
          <li
            key={order.id}
            className="min-w-0 space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <Link
                href={`/admin/orders/${order.id}`}
                className="min-w-0 break-all font-mono text-sm text-stone-100 underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                {order.id.slice(0, 8)}
              </Link>
              <span className="text-xs uppercase tracking-[0.18em] text-stone-400">
                Order
              </span>
            </div>

            <dl className="space-y-3">
              <CardField label="Customer">
                <span className="block">{order.customer_name || "—"}</span>
                <span className="block text-stone-400">
                  {order.customer_email || "—"}
                </span>
              </CardField>
              <CardField label="Date">
                {formatOrderDate(order.created_at)}
              </CardField>
              <CardField label="Payment">
                <StatusBadge kind="payment" value={order.payment_status} />
              </CardField>
              <CardField label="Status">
                <StatusBadge kind="order" value={order.order_status} />
              </CardField>
              <CardField label="Fulfilment">
                <StatusBadge
                  kind="fulfilment"
                  value={order.fulfilment_status}
                />
              </CardField>
            </dl>

            <div className="flex items-baseline justify-between gap-4 border-t border-white/10 pt-3">
              <span className="text-xs uppercase tracking-[0.18em] text-stone-400">
                Total
              </span>
              <span className="text-base font-medium text-stone-100">
                {formatPrice(order.total)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-2xl border border-white/10 lg:block">
        <table className="w-full min-w-[54rem] border-collapse text-left text-sm">
          <caption className="sr-only">Orders</caption>
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-stone-400">
              <th className="px-4 py-4 font-normal">Order</th>
              <th className="px-4 py-4 font-normal">Customer</th>
              <th className="px-4 py-4 font-normal">Date</th>
              <th className="px-4 py-4 font-normal">Payment</th>
              <th className="px-4 py-4 font-normal">Status</th>
              <th className="px-4 py-4 font-normal">Fulfilment</th>
              <th className="px-4 py-4 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.id}
                className="border-b border-white/5 align-top transition-colors last:border-b-0 hover:bg-white/[0.03]"
              >
                <td className="px-4 py-4">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="font-mono text-xs text-stone-300 underline underline-offset-4 transition-colors hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  >
                    {order.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="max-w-[18rem] break-words px-4 py-4 text-stone-200 [overflow-wrap:anywhere]">
                  <span className="block">{order.customer_name || "—"}</span>
                  <span className="block text-xs text-stone-400">
                    {order.customer_email || "—"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-stone-400">
                  {formatOrderDate(order.created_at)}
                </td>
                <td className="px-4 py-4">
                  <StatusBadge kind="payment" value={order.payment_status} />
                </td>
                <td className="px-4 py-4">
                  <StatusBadge kind="order" value={order.order_status} />
                </td>
                <td className="px-4 py-4">
                  <StatusBadge
                    kind="fulfilment"
                    value={order.fulfilment_status}
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right text-stone-100">
                  {formatPrice(order.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function AdminOrdersPage() {
  // Runs outside the loader so an authentication redirect is never swallowed.
  await requireAdminUser();

  const { orders, hasError } = await loadOrders();

  return (
    <div className="min-w-0 space-y-8">
      <AdminPageHeader title="Orders" />
      <OrdersContent orders={orders} hasError={hasError} />
    </div>
  );
}
