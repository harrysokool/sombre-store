import Link from "next/link";

import { listAdminOrders, type AdminOrderListItem } from "@/lib/admin/orders";
import { formatPrice } from "@/lib/storefront/format-price";
import { requireAdminUser } from "@/lib/supabase/admin-auth";

export const dynamic = "force-dynamic";

function formatOrderDate(value: string) {
  return new Date(value).toLocaleString("en-HK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusPill({ value }: { value: string }) {
  return (
    <span className="inline-flex whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs capitalize tracking-[0.08em] text-stone-300">
      {value.replaceAll("_", " ")}
    </span>
  );
}

async function loadOrders() {
  try {
    return { orders: await listAdminOrders(), hasError: false };
  } catch (error) {
    console.error("Failed to load orders for /admin:", error);
    return { orders: [] as AdminOrderListItem[], hasError: true };
  }
}

export default async function AdminOrdersPage() {
  // Runs outside the try/catch below so a redirect is never swallowed.
  await requireAdminUser();

  const { orders, hasError } = await loadOrders();

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
      <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
        {orders.length} {orders.length === 1 ? "order" : "orders"}
      </p>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-stone-500">
              <th className="px-4 py-4 font-normal">Order</th>
              <th className="px-4 py-4 font-normal">Customer</th>
              <th className="px-4 py-4 font-normal">Email</th>
              <th className="px-4 py-4 font-normal">Date</th>
              <th className="px-4 py-4 font-normal">Payment</th>
              <th className="px-4 py-4 font-normal">Status</th>
              <th className="px-4 py-4 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.id}
                className="border-b border-white/5 transition-colors last:border-b-0 hover:bg-white/[0.03]"
              >
                <td className="px-4 py-4">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="font-mono text-xs text-stone-300 underline underline-offset-4 transition-colors hover:text-stone-100"
                  >
                    {order.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-4 text-stone-200">
                  {order.customer_name || "—"}
                </td>
                <td className="px-4 py-4 text-stone-400">
                  {order.customer_email || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-stone-400">
                  {formatOrderDate(order.created_at)}
                </td>
                <td className="px-4 py-4">
                  <StatusPill value={order.payment_status} />
                </td>
                <td className="px-4 py-4">
                  <StatusPill value={order.order_status} />
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
