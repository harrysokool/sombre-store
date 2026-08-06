import "server-only";

import Stripe from "stripe";

const STRIPE_TEST_SECRET_KEY_PATTERN = /^sk_test_[A-Za-z0-9]+$/;

function getStripeTestSecretKey() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    throw new Error(
      "Missing Stripe environment variable. Set STRIPE_SECRET_KEY to a Stripe test secret key.",
    );
  }

  if (stripeSecretKey.startsWith("sk_live_")) {
    throw new Error(
      "Live Stripe secret keys are not permitted during prelaunch. Set STRIPE_SECRET_KEY to a Stripe test secret key.",
    );
  }

  if (!STRIPE_TEST_SECRET_KEY_PATTERN.test(stripeSecretKey)) {
    throw new Error(
      "Invalid STRIPE_SECRET_KEY. Sombre prelaunch requires a Stripe test secret key beginning with sk_test_.",
    );
  }

  return stripeSecretKey;
}

const stripeSecretKey = getStripeTestSecretKey();

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
