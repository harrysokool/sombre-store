import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getStripeWebhookSecret, stripe } from "@/lib/stripe/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type PersistedOrder = {
  id: string;
  payment_status: string;
};

type CheckoutPaymentStatus = Stripe.Checkout.Session["payment_status"];
type ConfirmedPaymentStatus = Extract<
  CheckoutPaymentStatus,
  "paid" | "no_payment_required"
>;

function isConfirmedPaymentStatus(
  paymentStatus: CheckoutPaymentStatus,
): paymentStatus is ConfirmedPaymentStatus {
  return paymentStatus === "paid" || paymentStatus === "no_payment_required";
}

function getPaymentIntentId(session: Stripe.Checkout.Session) {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;
}

function getOrderSubtotal(
  session: Stripe.Checkout.Session,
  lineItems: Stripe.ApiList<Stripe.LineItem>,
) {
  if (typeof session.amount_subtotal === "number") {
    return session.amount_subtotal / 100;
  }

  return (
    lineItems.data.reduce(
      (total, lineItem) => total + (lineItem.amount_subtotal ?? 0),
      0,
    ) / 100
  );
}

function getOrderShippingFee(session: Stripe.Checkout.Session) {
  return (session.total_details?.amount_shipping ?? 0) / 100;
}

function getOrderTotal(
  session: Stripe.Checkout.Session,
  lineItems: Stripe.ApiList<Stripe.LineItem>,
) {
  if (typeof session.amount_total === "number") {
    return session.amount_total / 100;
  }

  return getOrderSubtotal(session, lineItems) + getOrderShippingFee(session);
}

function getExpandedStripeProduct(
  product: string | Stripe.Product | Stripe.DeletedProduct | null | undefined,
) {
  if (!product || typeof product === "string" || product.deleted) {
    return null;
  }

  return product;
}

async function findExistingOrder(stripeSessionId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, payment_status")
    .eq("stripe_session_id", stripeSessionId)
    .maybeSingle<PersistedOrder>();

  if (error) {
    throw error;
  }

  return data;
}

async function insertPendingOrderFromSession(
  session: Stripe.Checkout.Session,
  lineItems: Stripe.ApiList<Stripe.LineItem>,
) {
  const supabase = createSupabaseServiceRoleClient();
  const metadata: Stripe.Metadata = session.metadata ?? {};

  const { data, error } = await supabase
    .from("orders")
    .insert({
      stripe_session_id: session.id,
      stripe_payment_intent_id: getPaymentIntentId(session),
      customer_email:
        session.customer_details?.email ?? session.customer_email ?? "",
      customer_name: metadata.customer_name ?? "",
      customer_phone: metadata.customer_phone ?? null,
      address_line_1: metadata.address_line_1 ?? "",
      address_line_2: metadata.address_line_2 ?? null,
      city: metadata.city ?? "",
      postal_code: metadata.postal_code ?? "",
      country: metadata.country ?? "",
      subtotal: getOrderSubtotal(session, lineItems),
      shipping_fee: getOrderShippingFee(session),
      total: getOrderTotal(session, lineItems),
      currency: (session.currency ?? "hkd").toLowerCase(),
      // Keep the order unconfirmed until all of its line items are persisted.
      // A webhook retry can safely resume this pending row if a later write fails.
      payment_status: "unpaid",
    })
    .select("id, payment_status")
    .single<PersistedOrder>();

  if (error) {
    throw error;
  }

  return data;
}

async function getPersistedOrderItemCount(orderId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { count, error } = await supabase
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function confirmOrderPaymentAndReduceStock(
  orderId: string,
  paymentStatus: ConfirmedPaymentStatus,
) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc(
    "confirm_paid_order_and_reduce_stock",
    {
      p_order_id: orderId,
      p_payment_status: paymentStatus,
    },
  );

  if (error) {
    throw error;
  }

  return data === true;
}

async function insertOrderItems(
  orderId: string,
  lineItems: Stripe.ApiList<Stripe.LineItem>,
) {
  const supabase = createSupabaseServiceRoleClient();

  const items = lineItems.data.map((lineItem) => {
    const stripeProduct = getExpandedStripeProduct(lineItem.price?.product);
    const quantity = lineItem.quantity ?? 1;

    return {
      order_id: orderId,
      product_id: stripeProduct?.metadata.product_id || null,
      product_name:
        lineItem.description ?? stripeProduct?.name ?? "Unknown product",
      unit_price: (lineItem.amount_subtotal ?? 0) / quantity / 100,
      quantity,
      size_label: stripeProduct?.description ?? null,
      image_url: stripeProduct?.images?.[0] ?? null,
    };
  });

  const { error } = await supabase.from("order_items").insert(items);

  if (error) {
    throw error;
  }
}

async function handleConfirmedCheckoutSession(session: Stripe.Checkout.Session) {
  if (!isConfirmedPaymentStatus(session.payment_status)) {
    console.info("Stripe Checkout Session is awaiting payment confirmation", {
      sessionId: session.id,
      paymentStatus: session.payment_status,
    });
    return;
  }

  const existingOrder = await findExistingOrder(session.id);
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100,
    expand: ["data.price.product"],
  });
  const order =
    existingOrder ?? (await insertPendingOrderFromSession(session, lineItems));
  const persistedItemCount = await getPersistedOrderItemCount(order.id);

  if (persistedItemCount === 0) {
    await insertOrderItems(order.id, lineItems);
  } else if (persistedItemCount !== lineItems.data.length) {
    throw new Error(
      `Order ${order.id} has ${persistedItemCount} persisted items but Stripe returned ${lineItems.data.length}.`,
    );
  }

  const didReduceStock = await confirmOrderPaymentAndReduceStock(
    order.id,
    session.payment_status,
  );

  console.info("Stripe Checkout Session payment confirmed and persisted", {
    sessionId: session.id,
    orderId: order.id,
    itemCount: lineItems.data.length,
    paymentStatus: session.payment_status,
    didReduceStock,
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature header." },
      { status: 400 },
    );
  }

  const payload = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      getStripeWebhookSecret(),
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);

    return NextResponse.json(
      { error: "Invalid Stripe webhook request." },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleConfirmedCheckoutSession(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.info("Stripe Checkout Session payment failed", {
          sessionId: session.id,
          paymentStatus: session.payment_status,
        });
        break;
      }
      default:
        console.info(`Unhandled Stripe webhook event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed:", error);

    return NextResponse.json(
      { error: "Could not process Stripe webhook." },
      { status: 500 },
    );
  }
}
