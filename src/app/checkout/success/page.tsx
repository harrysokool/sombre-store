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
  customer_name: string;
  customer_phone: string | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  postal_code: string;
  country: string;
  payment_status: string;
  subtotal: number | string;
  shipping_fee: number | string;
  total: number | string;
};

type PersistedOrderItem = {
  id: string;
  product_name: string;
  unit_price: number | string;
  quantity: number;
  size_label: string | null;
};

function isConfirmedPaymentStatus(paymentStatus: string) {
  return paymentStatus === "paid" || paymentStatus === "no_payment_required";
}

async function findOrderByStripeSessionId(stripeSessionId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, created_at, customer_email, customer_name, customer_phone, address_line_1, address_line_2, city, postal_code, country, payment_status, subtotal, shipping_fee, total",
    )
    .eq("stripe_session_id", stripeSessionId)
    .maybeSingle<PersistedOrder>();

  if (error) {
    throw error;
  }

  return data;
}

async function findOrderItems(orderId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("order_items")
    .select("id, product_name, unit_price, quantity, size_label")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })
    .returns<PersistedOrderItem[]>();

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
  const orderItems =
    isPaymentConfirmed && order ? await findOrderItems(order.id) : [];

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

        {isPaymentConfirmed && order ? (
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
