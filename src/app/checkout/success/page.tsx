import Link from "next/link";

import { CheckoutSuccessCartReset } from "@/components/cart/checkout-success-cart-reset";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SuccessPageSearchParams =
  | Promise<{ session_id?: string }>
  | { session_id?: string };

type PersistedOrder = {
  id: string;
  created_at: string;
  customer_email: string;
  payment_status: string;
};

async function findOrderByStripeSessionId(stripeSessionId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, created_at, customer_email, payment_status")
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
  const isOrderConfirmed = Boolean(order);

  return (
    <section className="px-6 py-24 sm:px-10 sm:py-32 lg:px-12">
      <CheckoutSuccessCartReset shouldClearCart={isOrderConfirmed} />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 rounded-[2rem] border border-white/10 bg-white/[0.02] px-6 py-14 text-center sm:px-10">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
            Sombre
          </p>
          <h1 className="text-4xl font-medium tracking-[0.14em] text-stone-100 sm:text-5xl">
            {isOrderConfirmed ? "Order received" : "Finalizing your order"}
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-8 text-stone-400">
            {isOrderConfirmed
              ? "Your payment has been recorded and your order is now saved with Sombre. A formal confirmation experience can be added next without changing the purchase flow again."
              : "Stripe has redirected you back to Sombre. We are still waiting for the confirmed order record to finish syncing, so this page is intentionally conservative for now."}
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
                Payment status
              </p>
              <p className="text-sm capitalize text-stone-200">
                {order.payment_status}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                Email
              </p>
              <p className="text-sm text-stone-200">{order.customer_email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                Received
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
          </div>
        ) : null}

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm uppercase tracking-[0.22em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10"
          >
            Continue to Shop
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
