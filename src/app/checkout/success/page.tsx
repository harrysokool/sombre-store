import Link from "next/link";

import { CheckoutSuccessStateManager } from "@/components/cart/checkout-success-state-manager";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/storefront/format-price";

type SuccessPageSearchParams =
  | Promise<{ session_id?: string }>
  | { session_id?: string };

type PersistedOrder = {
  id: string;
  created_at: string;
  customer_email: string;
  payment_status: string;
  subtotal: number | string;
  shipping_fee: number | string;
  total: number | string;
};

function isConfirmedPaymentStatus(paymentStatus: string) {
  return paymentStatus === "paid" || paymentStatus === "no_payment_required";
}

async function findOrderByStripeSessionId(stripeSessionId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, created_at, customer_email, payment_status, subtotal, shipping_fee, total",
    )
    .eq("stripe_session_id", stripeSessionId)
    .maybeSingle<PersistedOrder>();

  if (error) {
    throw error;
  }

  return data;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: SuccessPageSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const stripeSessionId = resolvedSearchParams.session_id?.trim() ?? "";
  const order =
    stripeSessionId.length > 0
      ? await findOrderByStripeSessionId(stripeSessionId)
      : null;
  const isPaymentConfirmed = order
    ? isConfirmedPaymentStatus(order.payment_status)
    : false;

  return (
    <section className="px-6 py-24 sm:px-10 sm:py-32 lg:px-12">
      {stripeSessionId ? (
        <CheckoutSuccessStateManager
          isPaymentConfirmed={isPaymentConfirmed}
          sessionId={stripeSessionId}
        />
      ) : null}

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 rounded-[2rem] border border-white/10 bg-white/[0.02] px-6 py-14 text-center sm:px-10">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
            Sombre
          </p>
          <h1 className="text-4xl font-medium tracking-[0.14em] text-stone-100 sm:text-5xl">
            {isPaymentConfirmed
              ? "Order received"
              : stripeSessionId
                ? "Payment not confirmed"
                : "Order status unavailable"}
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-8 text-stone-400">
            {isPaymentConfirmed
              ? "Thank you. Your payment was successful and your order has been received. We will use the email below for order updates and support."
              : stripeSessionId
                ? "Your order is not confirmed yet. We are waiting for Stripe payment confirmation and will update this page automatically. Your cart has not been changed."
                : "No Stripe Checkout Session was provided, so we cannot confirm a payment or order."}
          </p>
        </div>

        {order ? (
          <div className="grid gap-4 rounded-3xl border border-white/10 bg-black/20 px-5 py-6 text-left sm:grid-cols-2 sm:px-6">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                Order reference
              </p>
              <p className="text-sm text-stone-200">{order.id}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                Payment
              </p>
              <p className="text-sm capitalize text-stone-200">
                {order.payment_status}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                Confirmation email
              </p>
              <p className="text-sm text-stone-200">{order.customer_email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                Order date
              </p>
              <p className="text-sm text-stone-200">
                {new Date(order.created_at).toLocaleString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="space-y-3 border-t border-white/10 pt-4 sm:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                  Product subtotal
                </p>
                <p className="text-sm text-stone-200">
                  {formatPrice(order.subtotal)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                  Hong Kong shipping
                </p>
                <p className="text-sm text-stone-200">
                  {formatPrice(order.shipping_fee)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-3">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-300">
                  Total
                </p>
                <p className="text-base font-medium text-stone-100">
                  {formatPrice(order.total)}
                </p>
              </div>
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
          {isPaymentConfirmed ? null : (
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
