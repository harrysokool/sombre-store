import type { Metadata } from "next";
import Link from "next/link";

import { CheckoutSuccessStateManager } from "@/components/cart/checkout-success-state-manager";
import { loadVerifiedCheckoutReceipt } from "@/lib/checkout/receipt";
import { formatPrice } from "@/lib/storefront/format-price";

// The receipt is a private, per-session page reached via a bearer-like URL, so
// keep it out of search indexes. Only the robots directive is set here — no
// title/description/session data — so the Stripe Session ID is never exposed.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    noimageindex: true,
  },
};

type SuccessPageSearchParams =
  | Promise<{ session_id?: string }>
  | { session_id?: string };

const focusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950";

function isConfirmedPaymentStatus(paymentStatus: string | null) {
  return paymentStatus === "paid" || paymentStatus === "no_payment_required";
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

// Masks a stored email for the public receipt: keeps the domain and only a hint
// of the local part (e.g. "john@example.com" -> "j***n@example.com"). Written
// defensively so unusual or invalid stored values never throw or over-expose.
function maskEmail(email: string | null | undefined): string {
  const value = typeof email === "string" ? email.trim() : "";
  const atIndex = value.lastIndexOf("@");

  // No usable local part or domain: reveal nothing.
  if (atIndex <= 0 || atIndex === value.length - 1) {
    return "***";
  }

  const local = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);

  // Short local parts only ever reveal their first character.
  const maskedLocal =
    local.length <= 2
      ? `${local[0]}***`
      : `${local[0]}***${local[local.length - 1]}`;

  return `${maskedLocal}@${domain}`;
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

  const isConfirmedWithoutPayment =
    isPaymentConfirmed &&
    (stripePaymentStatus === "no_payment_required" ||
      order?.payment_status === "no_payment_required");
  const isPaidConfirmation =
    isOrderConfirmed &&
    stripePaymentStatus === "paid" &&
    order?.payment_status === "paid";
  const isPersistedPaymentFailed =
    isVerifiedSession && order?.payment_status === "failed";
  const isPersistedPaymentCanceled =
    isVerifiedSession && order?.payment_status === "canceled";
  const isPersistedOrderPending =
    isVerifiedSession && order?.order_status === "pending";

  const heading = isOrderConfirmed
    ? "Order confirmed"
    : isRefunded
      ? "Order refunded"
      : isRefundPending
        ? "Refund processing"
        : isRefundFailed
          ? "Refund needs attention"
          : isUnfulfillable
            ? "Order unavailable"
            : isPersistedPaymentFailed
              ? "Payment unsuccessful"
              : isPersistedPaymentCanceled
                ? "Payment canceled"
                : isPersistedOrderPending && isPaymentConfirmed
                  ? "Finalizing your order"
                  : stripeSessionId && isVerifiedSession
                    ? "Confirmation pending"
                    : "Order status unavailable";
  const message = isOrderConfirmed
    ? isConfirmedWithoutPayment
      ? "Your order has been confirmed. No payment was required for this order. We will use the email below for order updates."
      : "Your payment has been confirmed and your order has been received. We will use the email below for order updates."
    : isRefunded
      ? isPaymentConfirmed && !isConfirmedWithoutPayment
        ? "Your payment was confirmed, but the order could not be fulfilled because an item was no longer in stock. A full refund has been issued. Your bank may take additional time to show it."
        : "The verified order could not be fulfilled because an item was no longer in stock. The order record shows that a full refund has been issued."
      : isRefundPending
        ? isPaymentConfirmed && !isConfirmedWithoutPayment
          ? "Your payment was confirmed, but the order could not be fulfilled because an item was no longer in stock. We are processing a full refund and will update this page when Stripe confirms it."
          : "The verified order could not be fulfilled because an item was no longer in stock. The order record shows that a refund is processing, and this page will update automatically."
        : isRefundFailed
          ? isPaymentConfirmed && !isConfirmedWithoutPayment
            ? "Your payment was confirmed, but the order could not be fulfilled and the automatic refund needs attention. Please contact us and include the order number below."
            : "The verified order could not be fulfilled and its refund needs attention. Please contact us and include the order number below."
          : isUnfulfillable
            ? "This order could not be fulfilled because an item was no longer in stock. Stripe did not collect a payment, so no refund is required."
            : isPersistedPaymentFailed
              ? "The verified order record shows that payment failed. The order has not been confirmed, and your cart has not been changed."
              : isPersistedPaymentCanceled
                ? "The verified order record shows that payment was canceled. The order has not been confirmed, and your cart has not been changed."
                : isPersistedOrderPending && isPaymentConfirmed
                  ? isConfirmedWithoutPayment
                    ? "No payment is required, and the verified order is still being finalized. This page will update automatically. Your cart has not been changed."
                    : "Payment has been confirmed, and the verified order is still being finalized. This page will update automatically. Your cart has not been changed."
                  : stripeSessionId && isVerifiedSession && !order
                    ? "We are waiting for the verified order record to become available and will update this page automatically. Your cart has not been changed."
                    : stripeSessionId && isVerifiedSession
                      ? "Your order is not confirmed yet. We are waiting for Stripe payment confirmation and will update this page automatically when the order is pending. Your cart has not been changed."
                      : stripeSessionId
                        ? "The Stripe Checkout Session could not be verified, so no receipt information is available."
                        : "No Stripe Checkout Session was provided, so we cannot confirm a payment or order.";

  const statusEyebrow = isPaidConfirmation
    ? "Payment confirmed"
    : isOrderConfirmed
      ? "Order confirmed"
      : isRefunded
        ? "Refund complete"
        : isRefundPending
          ? "Refund pending"
          : isRefundFailed
            ? "Refund issue"
            : isUnfulfillable
              ? "Not fulfilled"
              : isPersistedPaymentFailed
                ? "Payment failed"
                : isPersistedPaymentCanceled
                  ? "Payment canceled"
                  : isPersistedOrderPending && isPaymentConfirmed
                    ? "Order processing"
                    : stripeSessionId && isVerifiedSession
                      ? "Status pending"
                      : stripeSessionId
                        ? "Verification unavailable"
                        : "Order lookup";
  const isAlertState =
    isRefundFailed ||
    isUnfulfillable ||
    isPersistedPaymentFailed ||
    isPersistedPaymentCanceled ||
    Boolean(stripeSessionId && !isVerifiedSession);

  return (
    <section className="px-6 py-20 sm:px-10 sm:py-28 lg:px-12">
      {stripeSessionId && isVerifiedSession ? (
        <CheckoutSuccessStateManager
          shouldCleanupCart={isOrderConfirmed}
          shouldRefresh={shouldRefresh}
          sessionId={stripeSessionId}
        />
      ) : null}

      <div className="mx-auto w-full max-w-6xl">
        <header
          role={isAlertState ? "alert" : "status"}
          aria-live={isAlertState ? "assertive" : "polite"}
          aria-atomic="true"
          aria-busy={shouldRefresh || undefined}
          className="mx-auto max-w-3xl text-center"
        >
          <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-500 sm:text-xs">
            {statusEyebrow}
          </p>
          <h1 className="mt-5 font-display text-5xl font-light leading-[0.95] text-stone-100 sm:text-6xl lg:text-7xl">
            {heading}
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-sm leading-8 text-stone-400 sm:text-base">
            {message}
          </p>
        </header>

        {isVerifiedSession && isOrderConfirmed && order ? (
          <div className="mt-16 border-t border-white/10 sm:mt-20">
            <section
              aria-labelledby="order-details-heading"
              className="py-10 sm:py-12"
            >
              <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.34em] text-stone-500">
                    Receipt
                  </p>
                  <h2
                    id="order-details-heading"
                    className="mt-3 font-display text-3xl font-light text-stone-100 sm:text-4xl"
                  >
                    Order details
                  </h2>
                </div>
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
                  {orderItems.length}{" "}
                  {orderItems.length === 1 ? "item" : "items"}
                </p>
              </div>

              <dl className="mt-10 grid gap-7 border-t border-white/10 pt-8 sm:grid-cols-3">
                <div className="min-w-0 space-y-2">
                  <dt className="text-[0.65rem] uppercase tracking-[0.24em] text-stone-500">
                    Order number
                  </dt>
                  <dd className="break-words text-sm text-stone-200 [overflow-wrap:anywhere]">
                    {order.id}
                  </dd>
                </div>
                <div className="min-w-0 space-y-2">
                  <dt className="text-[0.65rem] uppercase tracking-[0.24em] text-stone-500">
                    Order date
                  </dt>
                  <dd className="text-sm leading-6 text-stone-200">
                    {new Date(order.created_at).toLocaleString("en-HK", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </dd>
                </div>
                <div className="min-w-0 space-y-2">
                  <dt className="text-[0.65rem] uppercase tracking-[0.24em] text-stone-500">
                    Payment status
                  </dt>
                  <dd className="break-words text-sm capitalize text-stone-200 [overflow-wrap:anywhere]">
                    {isConfirmedWithoutPayment
                      ? "No payment required"
                      : formatStatus(order.payment_status)}
                  </dd>
                </div>
              </dl>
            </section>

            <section
              aria-labelledby="purchased-products-heading"
              className="border-t border-white/10 py-10 sm:py-12"
            >
              <h2
                id="purchased-products-heading"
                className="font-display text-2xl font-light text-stone-100 sm:text-3xl"
              >
                Purchased products
              </h2>
              {orderItems.length > 0 ? (
                <ul className="mt-8 divide-y divide-white/10 border-t border-white/10">
                  {orderItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex min-w-0 items-start justify-between gap-5 py-6 sm:gap-10"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <p className="break-words font-display text-xl leading-tight text-stone-100 [overflow-wrap:anywhere] sm:text-2xl">
                          {item.product_name}
                        </p>
                        {item.size_label ? (
                          <p className="break-words text-[0.65rem] uppercase tracking-[0.2em] text-stone-500 [overflow-wrap:anywhere]">
                            {item.size_label}
                          </p>
                        ) : null}
                        <p className="text-xs text-stone-500">
                          Quantity {item.quantity}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm text-stone-200">
                        {formatPrice(Number(item.unit_price) * item.quantity)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-6 text-sm leading-7 text-stone-400">
                  Order item details are unavailable.
                </p>
              )}
            </section>

            <div className="grid border-t border-white/10 lg:grid-cols-2 lg:divide-x lg:divide-white/10">
              <section
                aria-labelledby="order-contact-heading"
                className="py-10 lg:pr-16"
              >
                <h2
                  id="order-contact-heading"
                  className="font-display text-2xl font-light text-stone-100 sm:text-3xl"
                >
                  Order contact
                </h2>
                {/* Phone and the full shipping address are intentionally not
                    shown here: the success URL is effectively a bearer link, so
                    the public receipt exposes only the recipient name and a
                    masked email. The complete details remain in Supabase and the
                    protected admin area. */}
                <address className="mt-7 space-y-1 break-words text-sm not-italic leading-7 text-stone-300 [overflow-wrap:anywhere]">
                  <p>{order.customer_name}</p>
                  <p>{maskEmail(order.customer_email)}</p>
                </address>
              </section>

              <section
                aria-labelledby="order-total-heading"
                className="border-t border-white/10 py-10 lg:border-t-0 lg:pl-16"
              >
                <h2
                  id="order-total-heading"
                  className="font-display text-2xl font-light text-stone-100 sm:text-3xl"
                >
                  Order total
                </h2>
                <dl className="mt-7 space-y-5">
                  <div className="flex items-baseline justify-between gap-5">
                    <dt className="text-xs uppercase tracking-[0.2em] text-stone-500">
                      Subtotal
                    </dt>
                    <dd className="shrink-0 text-sm text-stone-300">
                      {formatPrice(order.subtotal)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-5">
                    <dt className="text-xs uppercase tracking-[0.2em] text-stone-500">
                      Shipping
                    </dt>
                    <dd className="shrink-0 text-sm text-stone-300">
                      {formatPrice(order.shipping_fee)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-5 border-t border-white/10 pt-5">
                    <dt className="text-xs uppercase tracking-[0.2em] text-stone-300">
                      Total
                    </dt>
                    <dd className="shrink-0 text-xl font-light text-stone-100">
                      {formatPrice(order.total)}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          </div>
        ) : null}

        {isVerifiedSession && order && !isOrderConfirmed ? (
          <section
            aria-labelledby="verified-order-heading"
            className="mt-16 border-y border-white/10 py-10 sm:mt-20 sm:py-12"
          >
            <h2
              id="verified-order-heading"
              className="font-display text-2xl font-light text-stone-100 sm:text-3xl"
            >
              Verified order record
            </h2>
            <dl className="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              <div className="min-w-0 space-y-2">
                <dt className="text-[0.65rem] uppercase tracking-[0.24em] text-stone-500">
                  Order number
                </dt>
                <dd className="break-words text-sm text-stone-200 [overflow-wrap:anywhere]">
                  {order.id}
                </dd>
              </div>
              <div className="min-w-0 space-y-2">
                <dt className="text-[0.65rem] uppercase tracking-[0.24em] text-stone-500">
                  Payment status
                </dt>
                <dd className="break-words text-sm capitalize text-stone-200 [overflow-wrap:anywhere]">
                  {formatStatus(order.payment_status)}
                </dd>
              </div>
              {(isRefundPending ||
                isRefunded ||
                isRefundFailed ||
                isUnfulfillable) &&
              (order.refund_status || order.refund_id) ? (
                <div className="min-w-0 space-y-2">
                  <dt className="text-[0.65rem] uppercase tracking-[0.24em] text-stone-500">
                    Refund status
                  </dt>
                  {order.refund_status ? (
                    <dd className="break-words text-sm capitalize text-stone-200 [overflow-wrap:anywhere]">
                      {formatStatus(order.refund_status)}
                    </dd>
                  ) : null}
                  {order.refund_id ? (
                    <dd className="break-words text-xs text-stone-500 [overflow-wrap:anywhere]">
                      Reference {order.refund_id}
                    </dd>
                  ) : null}
                </div>
              ) : null}
            </dl>
          </section>
        ) : null}

        <div
          className={`flex flex-col items-stretch justify-center gap-5 border-t border-white/10 pt-10 sm:flex-row sm:items-center ${
            isOrderConfirmed || (isVerifiedSession && order)
              ? "mt-0"
              : "mt-16 sm:mt-20"
          }`}
        >
          <Link
            href="/shop"
            className={`inline-flex min-h-12 items-center justify-center rounded-full bg-stone-100 px-8 py-4 text-xs uppercase tracking-[0.28em] text-stone-950 transition-colors hover:bg-white ${focusRing}`}
          >
            Continue Shopping
          </Link>
          {isOrderConfirmed ? null : (
            <Link
              href="/cart"
              className={`inline-flex min-h-12 items-center justify-center px-4 py-3 text-xs uppercase tracking-[0.24em] text-stone-400 transition-colors hover:text-stone-100 ${focusRing}`}
            >
              Review Cart
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
