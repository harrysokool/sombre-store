import { getEmailConfig, type EmailConfig } from "@/lib/email/client";
import {
  renderCustomerOrderConfirmation,
  renderCustomerRefundFailed,
  renderCustomerRefundPending,
  renderCustomerRefunded,
  renderSellerOrderNotification,
  type OrderEmailItem,
  type OrderEmailOrder,
  type RenderedEmail,
} from "@/lib/email/templates";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

type OrderEmailKind =
  | "customer_order_confirmation"
  | "seller_order_notification"
  | "customer_refund_pending"
  | "customer_refunded"
  | "customer_refund_failed";

type OrderEmailRecord = OrderEmailOrder & {
  order_status: string;
};

type PlannedEmail = {
  kind: OrderEmailKind;
  recipient: string;
  render: (order: OrderEmailOrder, items: OrderEmailItem[]) => RenderedEmail;
};

const ORDER_EMAIL_COLUMNS =
  "id, created_at, customer_email, customer_name, customer_phone, address_line_1, address_line_2, district, city, postal_code, country, subtotal, shipping_fee, total, order_status";

async function loadOrderForEmail(orderId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_EMAIL_COLUMNS)
    .eq("id", orderId)
    .maybeSingle<OrderEmailRecord>();

  if (error) {
    throw error;
  }

  return data;
}

async function loadOrderItemsForEmail(orderId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("order_items")
    .select("product_name, size_label, unit_price, quantity")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })
    .returns<OrderEmailItem[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

// Decides which emails an order should receive from its fulfilment state.
// A confirmed order gets the normal confirmation; the refund states get a
// refund update instead, never a confirmation.
function planEmails(
  order: OrderEmailRecord,
  config: EmailConfig,
): PlannedEmail[] {
  if (order.order_status === "confirmed") {
    const planned: PlannedEmail[] = [];

    if (order.customer_email) {
      planned.push({
        kind: "customer_order_confirmation",
        recipient: order.customer_email,
        render: renderCustomerOrderConfirmation,
      });
    }

    if (config.sellerEmail) {
      planned.push({
        kind: "seller_order_notification",
        recipient: config.sellerEmail,
        render: renderSellerOrderNotification,
      });
    }

    return planned;
  }

  if (!order.customer_email) {
    return [];
  }

  switch (order.order_status) {
    case "refund_pending":
      return [
        {
          kind: "customer_refund_pending",
          recipient: order.customer_email,
          render: renderCustomerRefundPending,
        },
      ];
    case "refunded":
      return [
        {
          kind: "customer_refunded",
          recipient: order.customer_email,
          render: renderCustomerRefunded,
        },
      ];
    case "refund_failed":
      return [
        {
          kind: "customer_refund_failed",
          recipient: order.customer_email,
          render: renderCustomerRefundFailed,
        },
      ];
    default:
      // 'pending' is still being processed and 'unfulfillable' collected no
      // payment, so neither has anything to tell the customer yet.
      return [];
  }
}

// Returns the row id when this delivery may send, or null when the email has
// already gone out or another concurrent delivery just claimed it.
async function claimOrderEmail(
  orderId: string,
  kind: OrderEmailKind,
  recipient: string,
) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("claim_order_email", {
    p_order_id: orderId,
    p_email_kind: kind,
    p_recipient: recipient,
  });

  if (error) {
    throw error;
  }

  return typeof data === "string" ? data : null;
}

async function markOrderEmailSent(emailId: string, providerMessageId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.rpc("mark_order_email_sent", {
    p_email_id: emailId,
    p_provider_message_id: providerMessageId,
  });

  if (error) {
    throw error;
  }
}

async function markOrderEmailFailed(emailId: string, errorMessage: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.rpc("mark_order_email_failed", {
    p_email_id: emailId,
    p_error_message: errorMessage,
  });

  if (error) {
    throw error;
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error) {
    const { message } = error as { message?: unknown };

    if (typeof message === "string") {
      return message;
    }
  }

  return String(error);
}

async function sendPlannedEmail(
  config: EmailConfig,
  order: OrderEmailRecord,
  items: OrderEmailItem[],
  planned: PlannedEmail,
) {
  const emailId = await claimOrderEmail(
    order.id,
    planned.kind,
    planned.recipient,
  );

  if (!emailId) {
    return;
  }

  try {
    const rendered = planned.render(order, items);
    const { data, error } = await config.resend.emails.send(
      {
        from: config.from,
        to: planned.recipient,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: config.replyTo,
      },
      // The claim row is stable per order and email kind, so a retried send
      // cannot produce a second delivery even if the claim is re-granted.
      { idempotencyKey: `sombre-email-${emailId}` },
    );

    if (error) {
      throw error;
    }

    await markOrderEmailSent(emailId, data?.id ?? "");

    console.info("Sent order email", {
      orderId: order.id,
      emailKind: planned.kind,
      providerMessageId: data?.id ?? null,
    });
  } catch (error) {
    console.error("Failed to send an order email", {
      orderId: order.id,
      emailKind: planned.kind,
      error,
    });

    try {
      await markOrderEmailFailed(emailId, getErrorMessage(error));
    } catch (markError) {
      console.error("Failed to record an order email failure", {
        orderId: order.id,
        emailKind: planned.kind,
        markError,
      });
    }
  }
}

// Sends whichever transactional emails the order's current state calls for.
//
// This never throws. Email delivery is a follow-on effect of a payment that has
// already been taken, so a mail outage must not fail the Stripe webhook, change
// an order, or trigger a webhook retry.
export async function sendOrderStatusEmails(orderId: string): Promise<void> {
  try {
    const config = getEmailConfig();

    if (!config) {
      console.warn(
        "Email is not configured, skipping order emails. Set RESEND_API_KEY and EMAIL_FROM to enable them.",
        { orderId },
      );
      return;
    }

    const order = await loadOrderForEmail(orderId);

    if (!order) {
      console.error("Cannot send order emails for an unknown order", {
        orderId,
      });
      return;
    }

    const planned = planEmails(order, config);

    if (planned.length === 0) {
      return;
    }

    const items = await loadOrderItemsForEmail(order.id);

    // Sent one at a time so a single failure cannot prevent the others.
    for (const plannedEmail of planned) {
      await sendPlannedEmail(config, order, items, plannedEmail);
    }
  } catch (error) {
    console.error("Failed to process order emails", { orderId, error });
  }
}
