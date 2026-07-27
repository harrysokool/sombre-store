import { randomUUID } from "node:crypto";

import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderFulfilmentPanel } from "@/app/admin/(dashboard)/orders/[id]/order-fulfilment-panel";
import {
  OrderStockRestorationPanel,
  type RestorableOrderItem,
  type StockRestorationHistoryEntry,
} from "@/app/admin/(dashboard)/orders/[id]/order-stock-restoration-panel";
import { StatusBadge } from "@/components/admin/status-badge";
import { getFulfilmentBlockReason } from "@/lib/admin/fulfilment-rules";
import type { StatusKind } from "@/lib/admin/status-tone";
import { getAdminOrder } from "@/lib/admin/orders";
import { formatHongKongDateTime } from "@/lib/format-date";
import {
  getDiscountedOrderDisplay,
  getDiscountedOrderItemDisplay,
} from "@/lib/orders/discount-snapshots";
import { formatPrice } from "@/lib/storefront/format-price";
import { requireAdminUser } from "@/lib/supabase/admin-auth";

export const dynamic = "force-dynamic";

type AdminOrderPageProps = {
  params: Promise<{ id: string }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatTimestamp(value: string | null) {
  return value ? formatHongKongDateTime(value) : null;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-[0.24em] text-stone-400">
        {label}
      </p>
      <p className="break-words text-sm leading-6 text-stone-200 [overflow-wrap:anywhere]">
        {value}
      </p>
    </div>
  );
}

// Same shape as Field, but the value carries a tone as well as its word.
function StatusField({
  label,
  kind,
  value,
}: {
  label: string;
  kind: StatusKind;
  value: string;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-xs uppercase tracking-[0.24em] text-stone-400">
        {label}
      </p>
      <StatusBadge kind={kind} value={value} />
    </div>
  );
}

export default async function AdminOrderDetailPage({
  params,
}: AdminOrderPageProps) {
  await requireAdminUser();

  const { id } = await params;

  // A malformed id would otherwise reach Postgres as an invalid uuid and error.
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const result = await getAdminOrder(id);

  if (!result) {
    notFound();
  }

  const {
    order,
    items,
    hasUnresolvedRefundReview,
    stockRestorations = [],
  } = result;
  const orderDiscount = getDiscountedOrderDisplay(order);
  const fulfilmentBlockReason = getFulfilmentBlockReason({
    paymentStatus: order.payment_status,
    orderStatus: order.order_status,
    refundStatus: order.refund_status,
    refundId: order.refund_id,
    hasUnresolvedRefundReview,
  });
  const addressLines = [
    order.address_line_1,
    order.address_line_2,
    order.district,
    [order.city, order.postal_code].filter((part) => Boolean(part)).join(", "),
    order.country,
  ].filter((line): line is string => Boolean(line));
  const itemById = new Map(items.map((item) => [item.id, item]));
  const restoredQuantityByItem = new Map<string, number>();

  for (const restoration of stockRestorations) {
    restoredQuantityByItem.set(
      restoration.order_item_id,
      (restoredQuantityByItem.get(restoration.order_item_id) ?? 0) +
        restoration.quantity_restored,
    );
  }

  const restorableItems: RestorableOrderItem[] = items.map((item) => {
    const restoredQuantity = restoredQuantityByItem.get(item.id) ?? 0;

    return {
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      purchasedQuantity: item.quantity,
      restoredQuantity,
      remainingQuantity: Math.max(item.quantity - restoredQuantity, 0),
      requestId: randomUUID(),
    };
  });
  const restorationHistory: StockRestorationHistoryEntry[] =
    stockRestorations.map((restoration) => ({
      id: restoration.id,
      productName:
        itemById.get(restoration.order_item_id)?.product_name ??
        "Historical product",
      productId: restoration.product_id,
      quantityRestored: restoration.quantity_restored,
      reason: restoration.reason,
      administratorIdentity:
        restoration.administrator_email ??
        restoration.administrator_user_id ??
        "Legacy system",
      restoredAtLabel: formatHongKongDateTime(restoration.restored_at),
      isLegacy: restoration.source === "legacy_automatic",
    }));
  const stockRestorationLockedReason = order.stock_restored_at
    ? "This older order already had its full stock quantity restored automatically. No further units can be added."
    : !order.stock_reduced_at
      ? "This order did not reduce sellable stock, so there is nothing to restore."
      : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin/orders"
          className="text-xs uppercase tracking-[0.22em] text-stone-400 transition-colors hover:text-stone-300"
        >
          &larr; All orders
        </Link>
        <h2 className="break-all font-mono text-lg text-stone-100">
          {order.id}
        </h2>
        <p className="text-sm text-stone-400">
          {formatHongKongDateTime(order.created_at, {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>

      <div className="grid gap-5 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6 sm:grid-cols-3 sm:px-6">
        <StatusField
          label="Payment status"
          kind="payment"
          value={order.payment_status}
        />
        <StatusField
          label="Order status"
          kind="order"
          value={order.order_status}
        />
        {order.refund_status ? (
          <StatusField
            label="Refund status"
            kind="refund"
            value={order.refund_status}
          />
        ) : null}
      </div>

      {order.refund_status ? (
        <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6 sm:grid-cols-2 sm:px-6">
          {order.refund_id ? (
            <Field label="Refund reference" value={order.refund_id} />
          ) : null}
          {order.refunded_at ? (
            <Field
              label="Refunded at"
              value={formatHongKongDateTime(order.refunded_at)}
            />
          ) : null}
        </div>
      ) : null}

      <OrderFulfilmentPanel
        orderId={order.id}
        status={order.fulfilment_status}
        courier={order.courier}
        trackingNumber={order.tracking_number}
        shippedAtLabel={formatTimestamp(order.shipped_at)}
        deliveredAtLabel={formatTimestamp(order.delivered_at)}
        updatedAtLabel={formatTimestamp(order.fulfilment_updated_at)}
        lockedReason={fulfilmentBlockReason}
      />

      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6 sm:px-6">
        <h3 className="text-xs uppercase tracking-[0.24em] text-stone-400">
          Purchased products
        </h3>
        {items.length > 0 ? (
          <div className="divide-y divide-white/10">
            {items.map((item) => {
              const discount = getDiscountedOrderItemDisplay(item);
              const lineTotal = discount
                ? discount.finalLineTotal
                : Number(item.unit_price) * item.quantity;

              return (
                <div
                  key={item.id}
                  className="flex min-w-0 items-start justify-between gap-6 py-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="break-words text-sm text-stone-100 [overflow-wrap:anywhere]">
                      {item.product_name}
                    </p>
                    {item.size_label ? (
                      <p className="break-words text-xs text-stone-400 [overflow-wrap:anywhere]">
                        {item.size_label}
                      </p>
                    ) : null}
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
                      Quantity {item.quantity}
                      {discount
                        ? null
                        : ` × ${formatPrice(item.unit_price)}`}
                    </p>
                    {discount ? (
                      <dl className="mt-3 grid gap-x-5 gap-y-1.5 text-xs sm:grid-cols-2">
                        <div className="flex gap-2">
                          <dt className="text-stone-400">
                            Original unit price
                          </dt>
                          <dd className="text-stone-300">
                            {formatPrice(discount.originalUnitPrice)}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="text-stone-400">
                            Discount percentage
                          </dt>
                          <dd className="text-stone-300">
                            {discount.discountPercent}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="text-stone-400">
                            Final unit price
                          </dt>
                          <dd className="text-stone-300">
                            {formatPrice(discount.finalUnitPrice)}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="text-stone-400">
                            Line discount
                          </dt>
                          <dd className="text-stone-300">
                            −{formatPrice(discount.lineDiscount)}
                          </dd>
                        </div>
                      </dl>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-right text-sm text-stone-200">
                    {discount ? (
                      <span className="mb-1 block text-[0.6rem] uppercase tracking-[0.16em] text-stone-400">
                        Final line total
                      </span>
                    ) : (
                      <span className="sr-only">Line total </span>
                    )}
                    {formatPrice(lineTotal)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-stone-400">No line items recorded.</p>
        )}
      </div>

      {order.order_status === "refunded" &&
      order.refund_status === "succeeded" ? (
        <OrderStockRestorationPanel
          orderId={order.id}
          items={restorableItems}
          history={restorationHistory}
          lockedReason={stockRestorationLockedReason}
        />
      ) : null}

      <div className="grid gap-8 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6 sm:grid-cols-2 sm:px-6">
        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-[0.24em] text-stone-400">
            Delivery details
          </h3>
          <address className="space-y-1 text-sm not-italic leading-6 text-stone-200">
            <p>{order.customer_name}</p>
            <p>{order.customer_email}</p>
            {order.customer_phone ? <p>{order.customer_phone}</p> : null}
            {addressLines.map((line, index) => (
              <p key={`${index}-${line}`}>{line}</p>
            ))}
          </address>
          {order.district ? null : (
            <p className="text-xs text-stone-400">
              No district recorded (order predates district collection).
            </p>
          )}
        </div>

        <div className="space-y-3">
          {orderDiscount ? (
            <>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
                  Original subtotal
                </p>
                <p className="text-sm text-stone-200">
                  {formatPrice(orderDiscount.originalSubtotal)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
                  Coupon
                </p>
                <p className="min-w-0 break-words text-right text-sm text-stone-200 [overflow-wrap:anywhere]">
                  {orderDiscount.couponCode}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
                  Discount
                </p>
                <p className="text-sm text-stone-200">
                  −{formatPrice(orderDiscount.discountTotal)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
                  Discounted subtotal
                </p>
                <p className="text-sm text-stone-200">
                  {formatPrice(orderDiscount.discountedSubtotal)}
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
                Subtotal
              </p>
              <p className="text-sm text-stone-200">
                {formatPrice(order.subtotal)}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
              Shipping
            </p>
            <p className="text-sm text-stone-200">
              {formatPrice(
                orderDiscount
                  ? orderDiscount.shipping
                  : order.shipping_fee,
              )}
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-3">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-300">
              {orderDiscount ? "Total paid" : "Total"}
            </p>
            <p className="text-base font-medium text-stone-100">
              {formatPrice(
                orderDiscount ? orderDiscount.total : order.total,
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
