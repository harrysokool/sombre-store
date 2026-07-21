import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getStripeWebhookSecret, stripe } from "@/lib/stripe/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type PersistedOrder = {
  id: string;
  payment_status: string;
  order_status: string;
  refund_id: string | null;
  refund_status: string | null;
  stripe_payment_intent_id: string | null;
};

type PersistedOrderItemReference = {
  stripe_line_item_id: string | null;
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
    .select(
      "id, payment_status, order_status, refund_id, refund_status, stripe_payment_intent_id",
    )
    .eq("stripe_session_id", stripeSessionId)
    .maybeSingle<PersistedOrder>();

  if (error) {
    throw error;
  }

  return data;
}

async function findOrderById(orderId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, payment_status, order_status, refund_id, refund_status, stripe_payment_intent_id",
    )
    .eq("id", orderId)
    .single<PersistedOrder>();

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
    .select(
      "id, payment_status, order_status, refund_id, refund_status, stripe_payment_intent_id",
    )
    .single<PersistedOrder>();

  if (error) {
    throw error;
  }

  return data;
}

function normalizeRefundStatus(refundStatus: string | null) {
  switch (refundStatus) {
    case "pending":
    case "requires_action":
    case "succeeded":
    case "failed":
    case "canceled":
      return refundStatus;
    default:
      return "pending";
  }
}

async function saveRefundState(orderId: string, refund: Stripe.Refund) {
  const supabase = createSupabaseServiceRoleClient();
  const refundStatus = normalizeRefundStatus(refund.status);
  const orderStatus =
    refundStatus === "succeeded"
      ? "refunded"
      : refundStatus === "failed" || refundStatus === "canceled"
        ? "refund_failed"
        : "refund_pending";
  const values: {
    order_status: string;
    refund_id: string;
    refund_status: string;
    refunded_at?: string;
  } = {
    order_status: orderStatus,
    refund_id: refund.id,
    refund_status: refundStatus,
  };

  if (refundStatus === "succeeded") {
    values.refunded_at = new Date().toISOString();
  }

  let updateQuery = supabase
    .from("orders")
    .update(values)
    .eq("id", orderId)
    .neq("order_status", "refunded");

  // A delayed event or concurrent refund response must not move a terminal
  // refund back to an earlier state or rewrite its completion timestamp.
  if (refundStatus === "pending" || refundStatus === "requires_action") {
    updateQuery = updateQuery.neq("order_status", "refund_failed");
  }

  const { error } = await updateQuery;

  if (error) {
    throw error;
  }
}

async function saveNoPaymentRequiredOversell(orderId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("orders")
    .update({
      order_status: "unfulfillable",
      refund_status: "not_required",
    })
    .eq("id", orderId)
    .eq("order_status", "refund_pending");

  if (error) {
    throw error;
  }
}

async function saveRefundFailure(orderId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("orders")
    .update({
      order_status: "refund_failed",
      refund_status: "failed",
    })
    .eq("id", orderId)
    .eq("order_status", "refund_pending");

  if (error) {
    throw error;
  }
}

async function handlePaidOversellRefund(
  order: PersistedOrder,
  session: Stripe.Checkout.Session,
) {
  if (order.order_status !== "refund_pending") {
    return;
  }

  if (session.payment_status === "no_payment_required") {
    await saveNoPaymentRequiredOversell(order.id);
    return;
  }

  const paymentIntentId =
    order.stripe_payment_intent_id ?? getPaymentIntentId(session);

  try {
    if (order.refund_id) {
      const currentRefund = await stripe.refunds.retrieve(order.refund_id);
      await saveRefundState(order.id, currentRefund);
      return;
    }

    if (!paymentIntentId) {
      await saveRefundFailure(order.id);
      console.error(
        `Paid oversold order ${order.id} does not have a Stripe PaymentIntent.`,
      );
      return;
    }

    // Recover a refund created by an earlier delivery whose database update
    // did not finish. Concurrent deliveries are additionally protected by the
    // stable idempotency key on the create call below.
    const existingRefunds = await stripe.refunds.list({
      payment_intent: paymentIntentId,
      limit: 100,
    });
    const existingRefund = existingRefunds.data.find(
      (refund) => refund.metadata?.order_id === order.id,
    );

    if (existingRefund) {
      await saveRefundState(order.id, existingRefund);
      return;
    }

    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        metadata: {
          order_id: order.id,
          stripe_session_id: session.id,
          reason: "insufficient_stock",
        },
      },
      { idempotencyKey: `sombre-paid-oversell-${order.id}` },
    );

    await saveRefundState(order.id, refund);
  } catch (error) {
    // Invalid Stripe parameters will not become valid on a webhook retry.
    // Record the manual-attention state and acknowledge the delivery instead
    // of retrying the same deterministic failure indefinitely.
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      await saveRefundFailure(order.id);
      console.error("Stripe rejected an oversold order refund request", {
        orderId: order.id,
        paymentIntentId,
        error,
      });
      return;
    }

    throw error;
  }
}

async function handleRefundUpdate(refund: Stripe.Refund) {
  const orderId = refund.metadata?.order_id;

  if (!orderId) {
    console.info("Ignoring Stripe refund without a Sombre order ID", {
      refundId: refund.id,
      refundStatus: refund.status,
    });
    return;
  }

  // Stripe does not guarantee webhook event ordering, so retrieve the current
  // object rather than allowing an older event payload to regress the status.
  const currentRefund = await stripe.refunds.retrieve(refund.id);
  await saveRefundState(orderId, currentRefund);
}

async function getPersistedOrderItemReferences(orderId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("order_items")
    .select("stripe_line_item_id")
    .eq("order_id", orderId)
    .returns<PersistedOrderItemReference[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
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
      stripe_line_item_id: lineItem.id,
      product_id: stripeProduct?.metadata.product_id || null,
      product_name:
        lineItem.description ?? stripeProduct?.name ?? "Unknown product",
      unit_price: (lineItem.amount_subtotal ?? 0) / quantity / 100,
      quantity,
      size_label: stripeProduct?.description ?? null,
      image_url: stripeProduct?.images?.[0] ?? null,
    };
  });

  const { error } = await supabase.from("order_items").upsert(items, {
    onConflict: "order_id,stripe_line_item_id",
    ignoreDuplicates: true,
  });

  if (error) {
    throw error;
  }
}

function assertCompleteOrderItems(
  orderId: string,
  persistedItems: PersistedOrderItemReference[],
  lineItems: Stripe.ApiList<Stripe.LineItem>,
) {
  if (persistedItems.length !== lineItems.data.length) {
    throw new Error(
      `Order ${orderId} has ${persistedItems.length} persisted items but Stripe returned ${lineItems.data.length}.`,
    );
  }

  const persistedStripeLineItemIds = persistedItems
    .map((item) => item.stripe_line_item_id)
    .filter((itemId): itemId is string => itemId !== null);

  // Rows created before the idempotency migration have no Stripe line-item ID.
  // Their existing count check remains the compatibility guard for retries.
  if (persistedStripeLineItemIds.length === 0) {
    return;
  }

  const expectedStripeLineItemIds = new Set(
    lineItems.data.map((lineItem) => lineItem.id),
  );

  if (
    persistedStripeLineItemIds.length !== persistedItems.length ||
    persistedStripeLineItemIds.some(
      (itemId) => !expectedStripeLineItemIds.has(itemId),
    )
  ) {
    throw new Error(
      `Order ${orderId} does not contain the expected Stripe line items.`,
    );
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
  let persistedItems = await getPersistedOrderItemReferences(order.id);

  if (persistedItems.length === 0) {
    await insertOrderItems(order.id, lineItems);
    persistedItems = await getPersistedOrderItemReferences(order.id);
  }

  assertCompleteOrderItems(order.id, persistedItems, lineItems);

  const didReduceStock = await confirmOrderPaymentAndReduceStock(
    order.id,
    session.payment_status,
  );
  const processedOrder = await findOrderById(order.id);

  await handlePaidOversellRefund(processedOrder, session);

  console.info("Stripe Checkout Session payment confirmed and persisted", {
    sessionId: session.id,
    orderId: order.id,
    itemCount: lineItems.data.length,
    paymentStatus: session.payment_status,
    didReduceStock,
    orderStatus: processedOrder.order_status,
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
      case "refund.created":
      case "refund.updated":
      case "refund.failed":
        await handleRefundUpdate(event.data.object as Stripe.Refund);
        break;
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
