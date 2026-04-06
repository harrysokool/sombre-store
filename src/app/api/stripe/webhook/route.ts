import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getStripeWebhookSecret, stripe } from "@/lib/stripe/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type PersistedOrder = {
  id: string;
};

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

async function findExistingOrder(stripeSessionId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_session_id", stripeSessionId)
    .maybeSingle<PersistedOrder>();

  if (error) {
    throw error;
  }

  return data;
}

async function insertOrderFromSession(
  session: Stripe.Checkout.Session,
  lineItems: Stripe.ApiList<Stripe.LineItem>,
) {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("orders")
    .insert({
      stripe_session_id: session.id,
      stripe_payment_intent_id: getPaymentIntentId(session),
      customer_email:
        session.customer_details?.email ?? session.customer_email ?? "",
      customer_name: session.metadata.customer_name ?? "",
      customer_phone: session.metadata.customer_phone ?? null,
      address_line_1: session.metadata.address_line_1 ?? "",
      address_line_2: session.metadata.address_line_2 ?? null,
      city: session.metadata.city ?? "",
      postal_code: session.metadata.postal_code ?? "",
      country: session.metadata.country ?? "",
      subtotal: getOrderSubtotal(session, lineItems),
      currency: (session.currency ?? "usd").toLowerCase(),
      payment_status: session.payment_status,
    })
    .select("id")
    .single<PersistedOrder>();

  if (error) {
    throw error;
  }

  return data;
}

async function insertOrderItems(
  orderId: string,
  lineItems: Stripe.ApiList<Stripe.LineItem>,
) {
  const supabase = createSupabaseServerClient();

  const items = lineItems.data.map((lineItem) => {
    const stripeProduct =
      lineItem.price?.product && typeof lineItem.price.product !== "string"
        ? lineItem.price.product
        : null;
    const quantity = lineItem.quantity ?? 1;

    return {
      order_id: orderId,
      product_id: stripeProduct?.metadata.product_id || null,
      product_name: lineItem.description,
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

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const existingOrder = await findExistingOrder(session.id);

  if (existingOrder) {
    console.info("Stripe checkout.session.completed already persisted", {
      sessionId: session.id,
      orderId: existingOrder.id,
    });
    return;
  }

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100,
    expand: ["data.price.product"],
  });

  const order = await insertOrderFromSession(session, lineItems);

  try {
    await insertOrderItems(order.id, lineItems);
  } catch (error) {
    await createSupabaseServerClient().from("orders").delete().eq("id", order.id);
    throw error;
  }

  console.info("Stripe checkout.session.completed persisted", {
    sessionId: session.id,
    orderId: order.id,
    itemCount: lineItems.data.length,
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

  try {
    const payload = await request.text();
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      getStripeWebhookSecret(),
    );

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      default:
        console.info(`Unhandled Stripe webhook event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook verification failed:", error);

    return NextResponse.json(
      { error: "Invalid Stripe webhook request." },
      { status: 400 },
    );
  }
}
