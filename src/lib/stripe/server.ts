import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error(
    "Missing Stripe environment variable. Set STRIPE_SECRET_KEY.",
  );
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2026-02-25.clover",
});

export function getStripeWebhookSecret() {
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeWebhookSecret) {
    throw new Error(
      "Missing Stripe environment variable. Set STRIPE_WEBHOOK_SECRET.",
    );
  }

  return stripeWebhookSecret;
}
