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

export type OrderEmailKind =
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

type ClaimedOrderEmail = {
  email_id: string;
  claimed_order_id: string;
  claimed_email_kind: string;
  claimed_recipient: string;
};

type OrderEmailDeliveryState = {
  order_id: string;
  status: string;
  retry_disposition: string;
};

export type RetryOrderEmailResult =
  | { status: "sent"; orderId: string }
  | { status: "failed"; orderId: string }
  | { status: "not_applicable"; orderId: string }
  | { status: "outcome_unknown"; orderId: string }
  | { status: "already_sent"; orderId: string }
  | { status: "in_progress"; orderId: string }
  | { status: "requires_review"; orderId: string }
  | { status: "not_found"; orderId: null };

const ORDER_EMAIL_RENDERERS: Record<
  OrderEmailKind,
  PlannedEmail["render"]
> = {
  customer_order_confirmation: renderCustomerOrderConfirmation,
  seller_order_notification: renderSellerOrderNotification,
  customer_refund_pending: renderCustomerRefundPending,
  customer_refunded: renderCustomerRefunded,
  customer_refund_failed: renderCustomerRefundFailed,
};

const ORDER_EMAIL_COLUMNS =
  "id, created_at, customer_email, customer_name, customer_phone, address_line_1, address_line_2, district, city, postal_code, country, coupon_code, original_subtotal, discount_total, subtotal, shipping_fee, total, order_status";

function isOrderEmailKind(value: string): value is OrderEmailKind {
  return Object.prototype.hasOwnProperty.call(
    ORDER_EMAIL_RENDERERS,
    value,
  );
}

function plannedEmail(
  kind: OrderEmailKind,
  recipient: string,
): PlannedEmail {
  return {
    kind,
    recipient,
    render: ORDER_EMAIL_RENDERERS[kind],
  };
}

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
    .select(
      "product_name, size_label, unit_price, original_unit_price, discount_percent, quantity, original_line_total, discount_amount, discounted_line_total",
    )
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
      planned.push(
        plannedEmail(
          "customer_order_confirmation",
          order.customer_email,
        ),
      );
    }

    if (config.sellerEmail) {
      planned.push(
        plannedEmail("seller_order_notification", config.sellerEmail),
      );
    }

    return planned;
  }

  if (!order.customer_email) {
    return [];
  }

  switch (order.order_status) {
    case "refund_pending":
      return [
        plannedEmail("customer_refund_pending", order.customer_email),
      ];
    case "refunded":
      return [
        plannedEmail("customer_refunded", order.customer_email),
      ];
    case "refund_failed":
      return [
        plannedEmail("customer_refund_failed", order.customer_email),
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

async function claimOrderEmailRetry(emailId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc(
    "claim_order_email_retry",
    {
      p_email_id: emailId,
    },
  );

  if (error) {
    throw error;
  }

  const claimedRows = data as ClaimedOrderEmail[] | null;
  return claimedRows?.[0] ?? null;
}

async function loadOrderEmailDeliveryState(emailId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("order_emails")
    .select("order_id, status, retry_disposition")
    .eq("id", emailId)
    .maybeSingle<OrderEmailDeliveryState>();

  if (error) {
    throw error;
  }

  return data;
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

async function markOrderEmailFailed(
  emailId: string,
  errorMessage: string,
  disposition: "retryable" | "blocked",
) {
  const supabase = createSupabaseServiceRoleClient();
  const functionName =
    disposition === "retryable"
      ? "mark_order_email_failed_retryable"
      : "mark_order_email_retry_blocked";
  const { error } = await supabase.rpc(functionName, {
    p_email_id: emailId,
    p_error_message: errorMessage,
  });

  if (error) {
    throw error;
  }
}

async function markOrderEmailRetryUncertain(
  emailId: string,
  errorMessage: string,
) {
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.rpc(
    "mark_order_email_retry_uncertain",
    {
      p_email_id: emailId,
      p_error_message: errorMessage,
    },
  );

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

// Provider and infrastructure errors may contain credentials, response bodies
// or request headers. Return only an allowlisted category or one of this
// module's fixed internal messages; arbitrary source text never reaches the
// administrator browser.
export function sanitizeEmailErrorMessage(error: unknown) {
  if (error === null || error === undefined) {
    return "";
  }

  const message = getErrorMessage(error).replace(/\s+/g, " ").trim();
  const normalized = `${getErrorName(error)} ${message}`.toLowerCase();
  const safeInternalMessages = new Set([
    "Email delivery is not configured.",
    "Order data for this email is unavailable.",
    "Unsupported transactional email type.",
    "This transactional email no longer matches the current order status.",
    "The recorded email recipient is no longer current.",
    "Email delivery outcome is uncertain. Check the provider before retrying.",
  ]);

  if (safeInternalMessages.has(message)) {
    return message;
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("rate_limit")
  ) {
    return "The email provider rate limit was reached.";
  }

  if (
    normalized.includes("domain") &&
    (normalized.includes("verify") ||
      normalized.includes("unverified"))
  ) {
    return "The email sender domain is not verified.";
  }

  if (
    normalized.includes("invalid") &&
    (normalized.includes("recipient") ||
      normalized.includes("email address"))
  ) {
    return "The email provider rejected the recipient address.";
  }

  if (
    normalized.includes("timeout") ||
    normalized.includes("network") ||
    normalized.includes("connection") ||
    normalized.includes("fetch")
  ) {
    return "The email provider could not be reached.";
  }

  return "Email delivery failed. Review the server logs before retrying.";
}

function getErrorName(error: unknown) {
  if (error instanceof Error) {
    return error.name;
  }

  if (
    typeof error === "object" &&
    error &&
    "name" in error &&
    typeof error.name === "string"
  ) {
    return error.name;
  }

  return "UnknownError";
}

function isProviderOutcomeUncertain(error: unknown) {
  if (
    typeof error !== "object" ||
    error === null ||
    !("statusCode" in error)
  ) {
    return true;
  }

  const statusCode = error.statusCode;

  return (
    statusCode === null ||
    statusCode === 408 ||
    statusCode === 409 ||
    (typeof statusCode === "number" && statusCode >= 500)
  );
}

async function recordClaimedEmailFailure(
  emailId: string,
  orderId: string,
  emailKind: string,
  error: unknown,
  disposition: "retryable" | "blocked" = "retryable",
) {
  console.error("Failed to send an order email", {
    orderId,
    emailKind,
    errorName: getErrorName(error),
  });

  try {
    await markOrderEmailFailed(
      emailId,
      sanitizeEmailErrorMessage(error) || "Unknown email delivery error.",
      disposition,
    );

    return true;
  } catch (markError) {
    console.error("Failed to record an order email failure", {
      orderId,
      emailKind,
      errorName: getErrorName(markError),
    });

    return false;
  }
}

async function recordUncertainEmailOutcome(
  emailId: string,
  orderId: string,
  emailKind: string,
  error: unknown,
) {
  console.error("Unable to confirm an order email delivery outcome", {
    orderId,
    emailKind,
    errorName: getErrorName(error),
  });

  try {
    await markOrderEmailRetryUncertain(
      emailId,
      "Email delivery outcome is uncertain. Check the provider before retrying.",
    );
  } catch (markError) {
    console.error("Failed to record an uncertain order email outcome", {
      orderId,
      emailKind,
      errorName: getErrorName(markError),
    });
  }
}

async function recordFailureOutcome(
  emailId: string,
  orderId: string,
  emailKind: string,
  error: unknown,
  disposition: "retryable" | "blocked" = "retryable",
) {
  const wasFailureRecorded = await recordClaimedEmailFailure(
    emailId,
    orderId,
    emailKind,
    error,
    disposition,
  );

  if (wasFailureRecorded) {
    return "failed" as const;
  }

  await recordUncertainEmailOutcome(
    emailId,
    orderId,
    emailKind,
    error,
  );

  return "outcome_unknown" as const;
}

async function deliverClaimedOrderEmail(
  config: EmailConfig,
  emailId: string,
  order: OrderEmailRecord,
  items: OrderEmailItem[],
  planned: PlannedEmail,
) {
  let rendered: RenderedEmail;

  try {
    rendered = planned.render(order, items);
  } catch (error) {
    return recordFailureOutcome(
      emailId,
      order.id,
      planned.kind,
      error,
    );
  }

  let providerResult: Awaited<
    ReturnType<EmailConfig["resend"]["emails"]["send"]>
  >;

  try {
    providerResult = await config.resend.emails.send(
      {
        from: config.from,
        to: planned.recipient,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: config.replyTo,
      },
      // The stable row key asks Resend to deduplicate an ambiguous retry. The
      // database only reclaims pending work while this 24-hour provider window
      // is still open; older pending work requires provider reconciliation.
      { idempotencyKey: `sombre-email-${emailId}` },
    );
  } catch (error) {
    // A network exception cannot prove whether the provider accepted the
    // request. Keep the row pending instead of declaring a safe-to-retry
    // failure.
    await recordUncertainEmailOutcome(
      emailId,
      order.id,
      planned.kind,
      error,
    );

    return "outcome_unknown" as const;
  }

  if (providerResult.error) {
    // Resend returns transport failures as resolved error objects. A missing
    // status, timeout, idempotency conflict, or server error cannot prove that
    // the provider did not accept the message, so keep the row pending for a
    // bounded idempotent retry or provider reconciliation.
    if (isProviderOutcomeUncertain(providerResult.error)) {
      await recordUncertainEmailOutcome(
        emailId,
        order.id,
        planned.kind,
        providerResult.error,
      );

      return "outcome_unknown" as const;
    }

    return recordFailureOutcome(
      emailId,
      order.id,
      planned.kind,
      providerResult.error,
    );
  }

  const providerMessageId = providerResult.data?.id ?? "";

  try {
    await markOrderEmailSent(emailId, providerMessageId);
    console.info("Sent order email", {
      orderId: order.id,
      emailKind: planned.kind,
      providerMessageId: providerMessageId || null,
    });

    return "sent" as const;
  } catch (error) {
    // The provider accepted the message, so marking this as an ordinary
    // failure could send a duplicate after its idempotency window expires.
    await recordUncertainEmailOutcome(
      emailId,
      order.id,
      planned.kind,
      error,
    );

    return "outcome_unknown" as const;
  }
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

  await deliverClaimedOrderEmail(config, emailId, order, items, planned);
}

async function rejectClaimedOrderEmailRetry(
  claimed: ClaimedOrderEmail,
  reason: string,
) {
  const failureStatus = await recordFailureOutcome(
    claimed.email_id,
    claimed.claimed_order_id,
    claimed.claimed_email_kind,
    new Error(reason),
    "blocked",
  );

  return {
    status:
      failureStatus === "failed"
        ? ("not_applicable" as const)
        : ("outcome_unknown" as const),
    orderId: claimed.claimed_order_id,
  };
}

// Retries exactly the failed queue row the administrator selected. The
// database claim supplies the authoritative order, kind and recipient in the
// same atomic update that changes failed -> pending, so form data can never
// choose a different template or recipient and concurrent clicks cannot both
// send.
export async function retryFailedOrderEmail(
  emailId: string,
): Promise<RetryOrderEmailResult> {
  const claimed = await claimOrderEmailRetry(emailId);

  if (!claimed) {
    const deliveryState = await loadOrderEmailDeliveryState(emailId);

    if (!deliveryState) {
      return { status: "not_found", orderId: null };
    }

    if (deliveryState.status === "sent") {
      return {
        status: "already_sent",
        orderId: deliveryState.order_id,
      };
    }

    if (deliveryState.status === "failed") {
      return {
        status:
          deliveryState.retry_disposition === "blocked"
            ? "not_applicable"
            : "requires_review",
        orderId: deliveryState.order_id,
      };
    }

    return {
      status: "in_progress",
      orderId: deliveryState.order_id,
    };
  }

  const orderId = claimed.claimed_order_id;
  const emailKind = claimed.claimed_email_kind;

  if (!isOrderEmailKind(emailKind)) {
    return rejectClaimedOrderEmailRetry(
      claimed,
      "Unsupported transactional email type.",
    );
  }

  try {
    const config = getEmailConfig();

    if (!config) {
      throw new Error("Email delivery is not configured.");
    }

    const order = await loadOrderForEmail(orderId);

    if (!order) {
      throw new Error("Order data for this email is unavailable.");
    }

    const currentPlan = planEmails(order, config).find(
      (candidate) => candidate.kind === emailKind,
    );

    if (!currentPlan) {
      return rejectClaimedOrderEmailRetry(
        claimed,
        "This transactional email no longer matches the current order status.",
      );
    }

    if (currentPlan.recipient !== claimed.claimed_recipient) {
      return rejectClaimedOrderEmailRetry(
        claimed,
        "The recorded email recipient is no longer current.",
      );
    }

    const items = await loadOrderItemsForEmail(orderId);
    const deliveryStatus = await deliverClaimedOrderEmail(
      config,
      claimed.email_id,
      order,
      items,
      currentPlan,
    );

    return { status: deliveryStatus, orderId };
  } catch (error) {
    const failureStatus = await recordFailureOutcome(
      claimed.email_id,
      orderId,
      emailKind,
      error,
    );

    return { status: failureStatus, orderId };
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
    console.error("Failed to process order emails", {
      orderId,
      errorName: getErrorName(error),
    });
  }
}
