import Link from "next/link";

import { CheckoutSuccessStateManager } from "@/components/cart/checkout-success-state-manager";
import { loadVerifiedCheckoutReceipt } from "@/lib/checkout/receipt";
import { formatPrice } from "@/lib/storefront/format-price";

type SuccessPageSearchParams =
  | Promise<{ session_id?: string }>
  | { session_id?: string };

function isConfirmedPaymentStatus(paymentStatus: string | null) {
  return paymentStatus === "paid" || paymentStatus === "no_payment_required";
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: SuccessPageSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const stripeSessionId = resolvedSearchParams.session_id?.trim() ?? "";
  const receiptLookup =
    stripeSessionId.length > 0
      ? await loadVerifiedCheckoutReceipt(stripeSessionId)
      : {
          isVerifiedSession: false,
          order: null,
          orderItems: [],
          stripePaymentStatus: null,
        };
  const { isVerifiedSession, order, orderItems, stripePaymentStatus } =
    receiptLookup;
  const isPaymentConfirmed =
    isConfirmedPaymentStatus(stripePaymentStatus) &&
    isConfirmedPaymentStatus(order?.payment_status ?? null);
  const isOrderConfirmed =
    isPaymentConfirmed && order?.order_status === "confirmed";
  const isRefundPending = order?.order_status === "refund_pending";
  const isRefunded = order?.order_status === "refunded";
  const isRefundFailed = order?.order_status === "refund_failed";
  const isUnfulfillable = order?.order_status === "unfulfillable";
  const shouldRefresh =
    isVerifiedSession &&
    (!order || order.order_status === "pending" || isRefundPending);

  const heading = isOrderConfirmed
    ? "Order received"
    : isRefunded
      ? "Order refunded"
      : isRefundPending
        ? "Refund processing"
        : isRefundFailed
          ? "Refund needs attention"
          : isUnfulfillable
            ? "Order unavailable"
            : stripeSessionId && isVerifiedSession
              ? "Payment not confirmed"
              : "Order status unavailable";
  const message = isOrderConfirmed
    ? "Thank you. Your payment was successful and your order has been received. We will use the email below for order updates and support."
    : isRefunded
      ? "Your payment was confirmed, but the order could not be fulfilled because an item was no longer in stock. A full refund has been issued. Your bank may take additional time to show it."
      : isRefundPending
        ? "Your payment was confirmed, but the order could not be fulfilled because an item was no longer in stock. We are processing a full refund and will update this page when Stripe confirms it."
        : isRefundFailed
          ? "Your payment was confirmed, but the order could not be fulfilled and the automatic refund needs attention. Please contact us and include the order number below."
          : isUnfulfillable
            ? "This order could not be fulfilled because an item was no longer in stock. Stripe did not collect a payment, so no refund is required."
            : stripeSessionId && isVerifiedSession
              ? "Your order is not confirmed yet. We are waiting for Stripe payment confirmation and will update this page automatically. Your cart has not been changed."
              : stripeSessionId
                ? "The Stripe Checkout Session could not be verified, so no receipt information is available."
                : "No Stripe Checkout Session was provided, so we cannot confirm a payment or order.";

  return (
    <section className="px-6 py-24 sm:px-10 sm:py-32 lg:px-12">
      {stripeSessionId && isVerifiedSession ? (
        <CheckoutSuccessStateManager
          shouldCleanupCart={isOrderConfirmed}
          shouldRefresh={shouldRefresh}
          sessionId={stripeSessionId}
        />
      ) : null}

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 rounded-[2rem] border border-white/10 bg-white/[0.02] px-6 py-14 text-center sm:px-10">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
            Sombre
          </p>
          <h1 className="text-4xl font-medium tracking-[0.14em] text-stone-100 sm:text-5xl">
            {heading}
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-8 text-stone-400">
            {message}
          </p>
        </div>

        {isOrderConfirmed && order ? (
          <div className="space-y-8 rounded-3xl border border-white/10 bg-black/20 px-5 py-6 text-left sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                  Order number
                </p>
                <p className="break-all text-sm text-stone-200">{order.id}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                  Order date
                </p>
                <p className="text-sm text-stone-200">
                  {new Date(order.created_at).toLocaleString("en-HK", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            <div className="space-y-4 border-t border-white/10 pt-6">
              <h2 className="text-xs uppercase tracking-[0.24em] text-stone-500">
                Purchased products
              </h2>
              {orderItems.length > 0 ? (
                <div className="divide-y divide-white/10">
                  {orderItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-6 py-4 first:pt-0 last:pb-0"
                    >
                      <div className="space-y-1">
                        <p className="text-sm text-stone-100">
                          {item.product_name}
                        </p>
                        {item.size_label ? (
                          <p className="text-xs text-stone-500">
                            {item.size_label}
                          </p>
                        ) : null}
                        <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
                          Quantity {item.quantity}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm text-stone-200">
                        {formatPrice(Number(item.unit_price) * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-400">
                  Order item details are unavailable.
                </p>
              )}
            </div>

            <div className="grid gap-8 border-t border-white/10 pt-6 sm:grid-cols-2">
              <div className="space-y-3">
                <h2 className="text-xs uppercase tracking-[0.24em] text-stone-500">
                  Delivery details
                </h2>
                <address className="space-y-1 text-sm not-italic leading-6 text-stone-200">
                  <p>{order.customer_name}</p>
                  <p>{order.customer_email}</p>
                  {order.customer_phone ? <p>{order.customer_phone}</p> : null}
                  <p>{order.address_line_1}</p>
                  {order.address_line_2 ? <p>{order.address_line_2}</p> : null}
                  <p>
                    {order.city}, {order.postal_code}
                  </p>
                  <p>{order.country}</p>
                </address>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    Product subtotal
                  </p>
                  <p className="text-sm text-stone-200">
                    {formatPrice(order.subtotal)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    Shipping fee
                  </p>
                  <p className="text-sm text-stone-200">
                    {formatPrice(order.shipping_fee)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-300">
                    Final total
                  </p>
                  <p className="text-base font-medium text-stone-100">
                    {formatPrice(order.total)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {(isRefundPending || isRefunded || isRefundFailed || isUnfulfillable) &&
        order ? (
          <div className="grid gap-4 rounded-3xl border border-white/10 bg-black/20 px-5 py-6 text-left sm:grid-cols-2 sm:px-6">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                Order number
              </p>
              <p className="break-all text-sm text-stone-200">{order.id}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                Refund status
              </p>
              <p className="text-sm capitalize text-stone-200">
                {(order.refund_status ?? "pending").replaceAll("_", " ")}
              </p>
              {order.refund_id ? (
                <p className="break-all text-xs text-stone-500">
                  Reference {order.refund_id}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm uppercase tracking-[0.22em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10"
          >
            Continue Shopping
          </Link>
          {isOrderConfirmed ? null : (
            <Link
              href="/cart"
              className="inline-flex items-center justify-center text-sm uppercase tracking-[0.22em] text-stone-400 transition-colors hover:text-stone-100"
            >
              Review Cart
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
