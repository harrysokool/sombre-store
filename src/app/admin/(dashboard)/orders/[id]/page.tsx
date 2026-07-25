import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderFulfilmentPanel } from "@/app/admin/(dashboard)/orders/[id]/order-fulfilment-panel";
import { getFulfilmentBlockReason } from "@/lib/admin/fulfilment-rules";
import { getAdminOrder } from "@/lib/admin/orders";
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
  return value ? new Date(value).toLocaleString("en-HK") : null;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
        {label}
      </p>
      <p className="text-sm leading-6 text-stone-200">{value}</p>
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

  const { order, items, hasUnresolvedRefundReview } = result;
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin"
          className="text-xs uppercase tracking-[0.22em] text-stone-500 transition-colors hover:text-stone-300"
        >
          &larr; All orders
        </Link>
        <h2 className="break-all font-mono text-lg text-stone-100">
          {order.id}
        </h2>
        <p className="text-sm text-stone-400">
          {new Date(order.created_at).toLocaleString("en-HK", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6 sm:grid-cols-3 sm:px-6">
        <Field
          label="Payment status"
          value={order.payment_status.replaceAll("_", " ")}
        />
        <Field
          label="Order status"
          value={order.order_status.replaceAll("_", " ")}
        />
        {order.refund_status ? (
          <Field
            label="Refund status"
            value={order.refund_status.replaceAll("_", " ")}
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
              value={new Date(order.refunded_at).toLocaleString("en-HK")}
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
        <h3 className="text-xs uppercase tracking-[0.24em] text-stone-500">
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
                      <p className="break-words text-xs text-stone-500 [overflow-wrap:anywhere]">
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
                          <dt className="text-stone-500">
                            Original unit price
                          </dt>
                          <dd className="text-stone-300">
                            {formatPrice(discount.originalUnitPrice)}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="text-stone-500">
                            Discount percentage
                          </dt>
                          <dd className="text-stone-300">
                            {discount.discountPercent}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="text-stone-500">
                            Final unit price
                          </dt>
                          <dd className="text-stone-300">
                            {formatPrice(discount.finalUnitPrice)}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="text-stone-500">
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
                      <span className="mb-1 block text-[0.6rem] uppercase tracking-[0.16em] text-stone-500">
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

      <div className="grid gap-8 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6 sm:grid-cols-2 sm:px-6">
        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-[0.24em] text-stone-500">
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
            <p className="text-xs text-stone-500">
              No district recorded (order predates district collection).
            </p>
          )}
        </div>

        <div className="space-y-3">
          {orderDiscount ? (
            <>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Original subtotal
                </p>
                <p className="text-sm text-stone-200">
                  {formatPrice(orderDiscount.originalSubtotal)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Coupon
                </p>
                <p className="min-w-0 break-words text-right text-sm text-stone-200 [overflow-wrap:anywhere]">
                  {orderDiscount.couponCode}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Discount
                </p>
                <p className="text-sm text-stone-200">
                  −{formatPrice(orderDiscount.discountTotal)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Discounted subtotal
                </p>
                <p className="text-sm text-stone-200">
                  {formatPrice(orderDiscount.discountedSubtotal)}
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Subtotal
              </p>
              <p className="text-sm text-stone-200">
                {formatPrice(order.subtotal)}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
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
