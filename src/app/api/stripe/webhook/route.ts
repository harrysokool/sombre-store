import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getStripeWebhookSecret, stripe } from "@/lib/stripe/server";

export const runtime = "nodejs";

function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.info("Stripe checkout.session.completed received", {
    sessionId: session.id,
    paymentStatus: session.payment_status,
    customerEmail: session.customer_email,
    paymentIntentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
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
        handleCheckoutSessionCompleted(
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
