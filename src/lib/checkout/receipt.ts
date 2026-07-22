import Stripe from "stripe";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { stripe } from "@/lib/stripe/server";

type PersistedOrder = {
  id: string;
  created_at: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  address_line_1: string;
  address_line_2: string | null;
  district: string | null;
  city: string;
  postal_code: string | null;
  country: string;
  payment_status: string;
  order_status: string;
  refund_id: string | null;
  refund_status: string | null;
  subtotal: number | string;
  shipping_fee: number | string;
  total: number | string;
  currency: string;
  stripe_payment_intent_id: string | null;
};

export type CheckoutReceiptOrder = Omit<
  PersistedOrder,
  "currency" | "stripe_payment_intent_id"
>;

export type CheckoutReceiptItem = {
  id: string;
  product_name: string;
  unit_price: number | string;
  quantity: number;
  size_label: string | null;
};

export type CheckoutReceiptLookup = {
  isVerifiedSession: boolean;
  order: CheckoutReceiptOrder | null;
  orderItems: CheckoutReceiptItem[];
  stripePaymentStatus: Stripe.Checkout.Session["payment_status"] | null;
};

const CHECKOUT_SESSION_ID_PATTERN = /^cs_(?:test|live)_[a-zA-Z0-9]+$/;

function getPaymentIntentId(session: Stripe.Checkout.Session) {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;
}

function isConfirmedPaymentStatus(paymentStatus: string) {
  return paymentStatus === "paid" || paymentStatus === "no_payment_required";
}

function amountMatches(
  persistedAmount: number | string,
  stripeAmount: number | null,
) {
  return (
    stripeAmount !== null &&
    Math.round(Number(persistedAmount) * 100) === stripeAmount
  );
}

function toCheckoutReceiptOrder(order: PersistedOrder): CheckoutReceiptOrder {
  return {
    id: order.id,
    created_at: order.created_at,
    customer_email: order.customer_email,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    address_line_1: order.address_line_1,
    address_line_2: order.address_line_2,
    district: order.district,
    city: order.city,
    postal_code: order.postal_code,
    country: order.country,
    payment_status: order.payment_status,
    order_status: order.order_status,
    refund_id: order.refund_id,
    refund_status: order.refund_status,
    subtotal: order.subtotal,
    shipping_fee: order.shipping_fee,
    total: order.total,
  };
}

function invalidReceiptLookup(): CheckoutReceiptLookup {
  return {
    isVerifiedSession: false,
    order: null,
    orderItems: [],
    stripePaymentStatus: null,
  };
}

async function retrieveCheckoutSession(stripeSessionId: string) {
  if (!CHECKOUT_SESSION_ID_PATTERN.test(stripeSessionId)) {
    return null;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(stripeSessionId);

    return session.mode === "payment" ? session : null;
  } catch (error) {
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      return null;
    }

    throw error;
  }
}

export async function loadVerifiedCheckoutReceipt(
  stripeSessionId: string,
): Promise<CheckoutReceiptLookup> {
  const session = await retrieveCheckoutSession(stripeSessionId);

  if (!session) {
    return invalidReceiptLookup();
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, created_at, customer_email, customer_name, customer_phone, address_line_1, address_line_2, district, city, postal_code, country, payment_status, order_status, refund_id, refund_status, subtotal, shipping_fee, total, currency, stripe_payment_intent_id",
    )
    .eq("stripe_session_id", session.id)
    .maybeSingle<PersistedOrder>();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      isVerifiedSession: true,
      order: null,
      orderItems: [],
      stripePaymentStatus: session.payment_status,
    };
  }

  const isMatchingOrder =
    data.stripe_payment_intent_id === getPaymentIntentId(session) &&
    data.currency.toLowerCase() === session.currency?.toLowerCase() &&
    amountMatches(data.subtotal, session.amount_subtotal) &&
    amountMatches(
      data.shipping_fee,
      session.total_details?.amount_shipping ?? 0,
    ) &&
    amountMatches(data.total, session.amount_total);

  if (!isMatchingOrder) {
    console.error("Stripe Checkout Session did not match its persisted order", {
      orderId: data.id,
      stripeSessionId: session.id,
    });
    return invalidReceiptLookup();
  }

  const order = toCheckoutReceiptOrder(data);
  let orderItems: CheckoutReceiptItem[] = [];

  if (
    isConfirmedPaymentStatus(session.payment_status) &&
    isConfirmedPaymentStatus(order.payment_status) &&
    order.order_status === "confirmed"
  ) {
    const { data: persistedItems, error: itemsError } = await supabase
      .from("order_items")
      .select("id, product_name, unit_price, quantity, size_label")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true })
      .returns<CheckoutReceiptItem[]>();

    if (itemsError) {
      throw itemsError;
    }

    orderItems = persistedItems ?? [];
  }

  return {
    isVerifiedSession: true,
    order,
    orderItems,
    stripePaymentStatus: session.payment_status,
  };
}
