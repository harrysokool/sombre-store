import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServiceRoleClient: vi.fn(),
  getEmailConfig: vi.fn(),
  renderCustomerOrderConfirmation: vi.fn(),
  renderCustomerRefundFailed: vi.fn(),
  renderCustomerRefundPending: vi.fn(),
  renderCustomerRefunded: vi.fn(),
  renderCustomerShippingConfirmation: vi.fn(),
  renderSellerOrderNotification: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@/lib/email/client", () => ({
  getEmailConfig: mocks.getEmailConfig,
}));

vi.mock("@/lib/email/templates", () => ({
  renderCustomerOrderConfirmation:
    mocks.renderCustomerOrderConfirmation,
  renderCustomerRefundFailed: mocks.renderCustomerRefundFailed,
  renderCustomerRefundPending: mocks.renderCustomerRefundPending,
  renderCustomerRefunded: mocks.renderCustomerRefunded,
  renderCustomerShippingConfirmation:
    mocks.renderCustomerShippingConfirmation,
  renderSellerOrderNotification: mocks.renderSellerOrderNotification,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient:
    mocks.createSupabaseServiceRoleClient,
}));

import {
  retryFailedOrderEmail,
  sanitizeEmailErrorMessage,
  sendOrderStatusEmails,
  sendShippingConfirmationEmail,
  type OrderEmailKind,
} from "./order-emails";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const EMAIL_ID = "22222222-2222-4222-8222-222222222222";

type EmailRow = {
  id: string;
  order_id: string;
  email_kind: OrderEmailKind;
  recipient: string;
  status: "pending" | "sent" | "failed";
  error_message: string | null;
  attempt_count: number;
  provider_message_id: string | null;
  sent_at: string | null;
  retry_disposition: "unclassified" | "retryable" | "blocked";
  has_ambiguous_outcome: boolean;
};

const order = {
  id: ORDER_ID,
  created_at: "2026-07-27T02:52:00.000Z",
  customer_email: "customer@example.com",
  customer_name: "Sombre Customer",
  customer_phone: null,
  address_line_1: "1 Fragrance Road",
  address_line_2: null,
  district: "Central",
  city: "Hong Kong",
  postal_code: null,
  country: "Hong Kong",
  coupon_code: null,
  original_subtotal: "1188.00",
  discount_total: "0.00",
  subtotal: "1188.00",
  shipping_fee: "50.00",
  total: "1238.00",
  order_status: "confirmed",
  fulfilment_status: "unfulfilled",
  courier: null as string | null,
  tracking_number: null as string | null,
};

const items = [
  {
    product_name: "Test fragrance",
    size_label: "50 ml",
    unit_price: "1188.00",
    original_unit_price: null,
    discount_percent: null,
    quantity: 1,
    original_line_total: null,
    discount_amount: null,
    discounted_line_total: null,
  },
];

let emailRows: Map<string, EmailRow>;
let allowPendingRetry: boolean;
let markFailedError: { message: string } | null;
let markSentError: { message: string } | null;

function failedEmail(
  kind: OrderEmailKind = "customer_order_confirmation",
  recipient = "customer@example.com",
): EmailRow {
  return {
    id: EMAIL_ID,
    order_id: ORDER_ID,
    email_kind: kind,
    recipient,
    status: "failed",
    error_message: "Temporary provider failure.",
    attempt_count: 1,
    provider_message_id: null,
    sent_at: null,
    retry_disposition: "retryable",
    has_ambiguous_outcome: false,
  };
}

function createQuery(table: string) {
  const equalFilters = new Map<string, unknown>();
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: unknown) => {
      equalFilters.set(column, value);
      return query;
    }),
    order: vi.fn(() => query),
    returns: vi.fn(async () => {
      if (table !== "order_items") {
        throw new Error(`Unexpected returns query for ${table}.`);
      }

      return { data: items, error: null };
    }),
    maybeSingle: vi.fn(async () => {
      if (table === "orders") {
        return {
          data:
            equalFilters.get("id") === ORDER_ID ? order : null,
          error: null,
        };
      }

      if (table === "order_emails") {
        const row = emailRows.get(String(equalFilters.get("id")));

        return {
          data: row
            ? {
                order_id: row.order_id,
                status: row.status,
                retry_disposition: row.retry_disposition,
              }
            : null,
          error: null,
        };
      }

      throw new Error(`Unexpected maybeSingle query for ${table}.`);
    }),
  };

  return query;
}

function createSupabaseClient() {
  return {
    from: vi.fn((table: string) => createQuery(table)),
    rpc: vi.fn(
      async (name: string, parameters: Record<string, string>) => {
        if (name === "claim_order_email_retry") {
          const row = emailRows.get(parameters.p_email_id);

          if (
            !row ||
            (row.status !== "failed" &&
              !(row.status === "pending" && allowPendingRetry)) ||
            (row.status === "failed" &&
              row.retry_disposition !== "retryable")
          ) {
            return { data: [], error: null };
          }

          const wasPending = row.status === "pending";
          row.status = "pending";
          row.retry_disposition = "unclassified";
          row.has_ambiguous_outcome =
            row.has_ambiguous_outcome || wasPending;
          row.attempt_count += 1;

          return {
            data: [
              {
                email_id: row.id,
                claimed_order_id: row.order_id,
                claimed_email_kind: row.email_kind,
                claimed_recipient: row.recipient,
              },
            ],
            error: null,
          };
        }

        if (name === "claim_order_email") {
          const existing = [...emailRows.values()].find(
            (row) =>
              row.order_id === parameters.p_order_id &&
              row.email_kind === parameters.p_email_kind,
          );

          if (existing) {
            if (
              existing.status !== "failed" ||
              existing.retry_disposition !== "retryable"
            ) {
              return { data: null, error: null };
            }

            existing.status = "pending";
            existing.retry_disposition = "unclassified";
            existing.attempt_count += 1;
            return { data: existing.id, error: null };
          }

          const id = `email-${parameters.p_email_kind}`;
          emailRows.set(id, {
            id,
            order_id: parameters.p_order_id,
            email_kind: parameters.p_email_kind as OrderEmailKind,
            recipient: parameters.p_recipient,
            status: "pending",
            error_message: null,
            attempt_count: 1,
            provider_message_id: null,
            sent_at: null,
            retry_disposition: "unclassified",
            has_ambiguous_outcome: false,
          });

          return { data: id, error: null };
        }

        if (name === "mark_order_email_sent") {
          if (markSentError) {
            return { data: null, error: markSentError };
          }

          const row = emailRows.get(parameters.p_email_id);

          if (row) {
            row.status = "sent";
            row.sent_at = "2026-07-27T03:00:00.000Z";
            row.provider_message_id =
              parameters.p_provider_message_id;
            row.error_message = null;
            row.retry_disposition = "unclassified";
          }

          return { data: null, error: null };
        }

        if (name === "mark_order_email_failed_retryable") {
          if (markFailedError) {
            return { data: null, error: markFailedError };
          }

          const row = emailRows.get(parameters.p_email_id);

          if (row?.status === "pending") {
            row.status = "failed";
            row.retry_disposition = row.has_ambiguous_outcome
              ? "unclassified"
              : "retryable";
            row.error_message = parameters.p_error_message;
          }

          return { data: null, error: null };
        }

        if (name === "mark_order_email_retry_blocked") {
          if (markFailedError) {
            return { data: null, error: markFailedError };
          }

          const row = emailRows.get(parameters.p_email_id);

          if (row?.status === "pending") {
            row.status = "failed";
            row.retry_disposition = "blocked";
            row.error_message = parameters.p_error_message;
          }

          return { data: null, error: null };
        }

        if (name === "mark_order_email_retry_uncertain") {
          const row = emailRows.get(parameters.p_email_id);

          if (row?.status === "pending") {
            row.retry_disposition = "unclassified";
            row.has_ambiguous_outcome = true;
            row.error_message = parameters.p_error_message;
          }

          return { data: null, error: null };
        }

        throw new Error(`Unexpected RPC ${name}.`);
      },
    ),
  };
}

describe("manual order email retry", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    emailRows = new Map([[EMAIL_ID, failedEmail()]]);
    allowPendingRetry = false;
    markFailedError = null;
    markSentError = null;
    order.order_status = "confirmed";
    mocks.createSupabaseServiceRoleClient.mockImplementation(
      createSupabaseClient,
    );
    mocks.getEmailConfig.mockReturnValue({
      resend: { emails: { send: mocks.send } },
      from: "Sombre <orders@example.com>",
      replyTo: "support@example.com",
      sellerEmail: "seller@example.com",
    });
    mocks.send.mockResolvedValue({
      data: { id: "provider-message-1" },
      error: null,
    });

    for (const [renderer, subject] of [
      [
        mocks.renderCustomerOrderConfirmation,
        "customer confirmation",
      ],
      [mocks.renderSellerOrderNotification, "seller notification"],
      [mocks.renderCustomerRefundPending, "refund pending"],
      [mocks.renderCustomerRefunded, "refund succeeded"],
      [mocks.renderCustomerRefundFailed, "refund failed"],
    ] as const) {
      renderer.mockReturnValue({
        subject,
        html: `<p>${subject}</p>`,
        text: subject,
      });
    }
  });

  it.each([
    [
      "customer_order_confirmation",
      "customer@example.com",
      "customer confirmation",
      "renderCustomerOrderConfirmation",
      "confirmed",
    ],
    [
      "seller_order_notification",
      "seller@example.com",
      "seller notification",
      "renderSellerOrderNotification",
      "confirmed",
    ],
    [
      "customer_refund_pending",
      "customer@example.com",
      "refund pending",
      "renderCustomerRefundPending",
      "refund_pending",
    ],
    [
      "customer_refunded",
      "customer@example.com",
      "refund succeeded",
      "renderCustomerRefunded",
      "refunded",
    ],
    [
      "customer_refund_failed",
      "customer@example.com",
      "refund failed",
      "renderCustomerRefundFailed",
      "refund_failed",
    ],
  ] as const)(
    "uses the recorded %s template and recipient",
    async (kind, recipient, subject, rendererName, orderStatus) => {
      emailRows.set(EMAIL_ID, failedEmail(kind, recipient));
      order.order_status = orderStatus;

      await expect(retryFailedOrderEmail(EMAIL_ID)).resolves.toEqual({
        status: "sent",
        orderId: ORDER_ID,
      });

      expect(mocks[rendererName]).toHaveBeenCalledWith(order, items);
      expect(mocks.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: recipient,
          subject,
        }),
        { idempotencyKey: `sombre-email-${EMAIL_ID}` },
      );
    },
  );

  it("marks a successful retry sent and repeated requests do not send again", async () => {
    const first = await retryFailedOrderEmail(EMAIL_ID);
    const second = await retryFailedOrderEmail(EMAIL_ID);
    const row = emailRows.get(EMAIL_ID);

    expect(first).toEqual({ status: "sent", orderId: ORDER_ID });
    expect(second).toEqual({
      status: "already_sent",
      orderId: ORDER_ID,
    });
    expect(row).toMatchObject({
      status: "sent",
      attempt_count: 2,
      retry_disposition: "unclassified",
      provider_message_id: "provider-message-1",
      sent_at: expect.any(String),
      error_message: null,
    });
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("allows only one of two concurrent retries to send", async () => {
    let releaseSend:
      | ((value: {
          data: { id: string };
          error: null;
        }) => void)
      | undefined;
    mocks.send.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseSend = resolve;
        }),
    );

    const firstRetry = retryFailedOrderEmail(EMAIL_ID);

    await vi.waitFor(() => {
      expect(mocks.send).toHaveBeenCalledTimes(1);
    });

    await expect(retryFailedOrderEmail(EMAIL_ID)).resolves.toEqual({
      status: "in_progress",
      orderId: ORDER_ID,
    });

    releaseSend?.({
      data: { id: "provider-message-concurrent" },
      error: null,
    });

    await expect(firstRetry).resolves.toEqual({
      status: "sent",
      orderId: ORDER_ID,
    });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(emailRows.get(EMAIL_ID)?.attempt_count).toBe(2);
  });

  it("records a safe failed attempt and permits a later successful retry", async () => {
    const secret = "re_abcdefghijklmnopqrstuvwxyz123456";
    mocks.send.mockResolvedValueOnce({
      data: null,
      error: {
        name: "validation_error",
        statusCode: 400,
        message: `Bearer ${secret} was rejected`,
      },
    });

    await expect(retryFailedOrderEmail(EMAIL_ID)).resolves.toEqual({
      status: "failed",
      orderId: ORDER_ID,
    });
    expect(emailRows.get(EMAIL_ID)).toMatchObject({
      status: "failed",
      attempt_count: 2,
      retry_disposition: "retryable",
      error_message:
        "Email delivery failed. Review the server logs before retrying.",
    });
    expect(emailRows.get(EMAIL_ID)?.error_message).not.toContain(secret);

    await expect(retryFailedOrderEmail(EMAIL_ID)).resolves.toEqual({
      status: "sent",
      orderId: ORDER_ID,
    });
    expect(emailRows.get(EMAIL_ID)).toMatchObject({
      status: "sent",
      attempt_count: 3,
      error_message: null,
    });
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.send.mock.calls[0][1]).toEqual(
      mocks.send.mock.calls[1][1],
    );
  });

  it("does not retry a successful or in-flight email", async () => {
    const row = emailRows.get(EMAIL_ID)!;
    row.status = "sent";

    await expect(retryFailedOrderEmail(EMAIL_ID)).resolves.toEqual({
      status: "already_sent",
      orderId: ORDER_ID,
    });

    row.status = "pending";

    await expect(retryFailedOrderEmail(EMAIL_ID)).resolves.toEqual({
      status: "in_progress",
      orderId: ORDER_ID,
    });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(row.attempt_count).toBe(1);
  });

  it("reclaims an abandoned pending email only when the database lease permits it", async () => {
    const row = emailRows.get(EMAIL_ID)!;
    row.status = "pending";
    allowPendingRetry = true;

    await expect(retryFailedOrderEmail(EMAIL_ID)).resolves.toEqual({
      status: "sent",
      orderId: ORDER_ID,
    });
    expect(row).toMatchObject({
      status: "sent",
      attempt_count: 2,
    });
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("refuses a historical template that contradicts the current order state", async () => {
    emailRows.set(
      EMAIL_ID,
      failedEmail(
        "customer_refund_pending",
        "customer@example.com",
      ),
    );
    order.order_status = "refunded";

    await expect(retryFailedOrderEmail(EMAIL_ID)).resolves.toEqual({
      status: "not_applicable",
      orderId: ORDER_ID,
    });
    expect(emailRows.get(EMAIL_ID)).toMatchObject({
      status: "failed",
      attempt_count: 2,
      retry_disposition: "blocked",
      error_message:
        "This transactional email no longer matches the current order status.",
    });
    expect(mocks.send).not.toHaveBeenCalled();

    await expect(retryFailedOrderEmail(EMAIL_ID)).resolves.toEqual({
      status: "not_applicable",
      orderId: ORDER_ID,
    });
    expect(emailRows.get(EMAIL_ID)?.attempt_count).toBe(2);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("refuses a retry when the recorded recipient is no longer current", async () => {
    emailRows.set(
      EMAIL_ID,
      failedEmail(
        "seller_order_notification",
        "former-seller@example.com",
      ),
    );

    await expect(retryFailedOrderEmail(EMAIL_ID)).resolves.toEqual({
      status: "not_applicable",
      orderId: ORDER_ID,
    });
    expect(emailRows.get(EMAIL_ID)).toMatchObject({
      status: "failed",
      retry_disposition: "blocked",
      error_message: "The recorded email recipient is no longer current.",
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("requires provider review for an unclassified historical failure", async () => {
    const row = emailRows.get(EMAIL_ID)!;
    row.retry_disposition = "unclassified";

    await expect(retryFailedOrderEmail(EMAIL_ID)).resolves.toEqual({
      status: "requires_review",
      orderId: ORDER_ID,
    });
    expect(row.attempt_count).toBe(1);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("keeps a network-level provider outcome pending for reconciliation", async () => {
    mocks.send.mockResolvedValue({
      data: null,
      error: {
        name: "application_error",
        statusCode: null,
        message: "Unable to fetch data. The request could not be resolved.",
      },
    });

    await expect(retryFailedOrderEmail(EMAIL_ID)).resolves.toEqual({
      status: "outcome_unknown",
      orderId: ORDER_ID,
    });
    expect(emailRows.get(EMAIL_ID)).toMatchObject({
      status: "pending",
      attempt_count: 2,
      has_ambiguous_outcome: true,
      error_message:
        "Email delivery outcome is uncertain. Check the provider before retrying.",
    });
  });

  it.each([
    [500, "application_error"],
    [409, "concurrent_idempotent_requests"],
  ])(
    "keeps an ambiguous provider %s response pending",
    async (statusCode, name) => {
      mocks.send.mockResolvedValue({
        data: null,
        error: {
          name,
          statusCode,
          message: "Provider response is not safe to retry immediately.",
        },
      });

      await expect(retryFailedOrderEmail(EMAIL_ID)).resolves.toEqual({
        status: "outcome_unknown",
        orderId: ORDER_ID,
      });
      expect(emailRows.get(EMAIL_ID)).toMatchObject({
        status: "pending",
        attempt_count: 2,
        error_message:
          "Email delivery outcome is uncertain. Check the provider before retrying.",
      });
    },
  );

  it("does not promote an ambiguous delivery after a later definite rejection", async () => {
    const row = emailRows.get(EMAIL_ID)!;
    row.status = "pending";
    row.retry_disposition = "unclassified";
    row.has_ambiguous_outcome = true;
    allowPendingRetry = true;
    mocks.send.mockResolvedValue({
      data: null,
      error: {
        name: "invalid_api_key",
        statusCode: 401,
        message: "The provider rejected the current credentials.",
      },
    });

    await expect(retryFailedOrderEmail(EMAIL_ID)).resolves.toEqual({
      status: "failed",
      orderId: ORDER_ID,
    });
    expect(row).toMatchObject({
      status: "failed",
      retry_disposition: "unclassified",
      has_ambiguous_outcome: true,
      attempt_count: 2,
    });
  });

  it("does not reopen an email when the provider accepted it but sent-state persistence fails", async () => {
    markSentError = { message: "database unavailable" };

    await expect(retryFailedOrderEmail(EMAIL_ID)).resolves.toEqual({
      status: "outcome_unknown",
      orderId: ORDER_ID,
    });
    expect(emailRows.get(EMAIL_ID)).toMatchObject({
      status: "pending",
      attempt_count: 2,
      error_message:
        "Email delivery outcome is uncertain. Check the provider before retrying.",
    });
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("reports an uncertain outcome when a known failure cannot be persisted", async () => {
    markFailedError = { message: "database unavailable" };
    mocks.send.mockResolvedValue({
      data: null,
      error: {
        name: "rate_limit_exceeded",
        statusCode: 429,
        message: "Provider rate limit reached.",
      },
    });

    await expect(retryFailedOrderEmail(EMAIL_ID)).resolves.toEqual({
      status: "outcome_unknown",
      orderId: ORDER_ID,
    });
    expect(emailRows.get(EMAIL_ID)).toMatchObject({
      status: "pending",
      attempt_count: 2,
    });
  });

  it("keeps a retry failed when email configuration is unavailable", async () => {
    mocks.getEmailConfig.mockReturnValue(null);

    await expect(retryFailedOrderEmail(EMAIL_ID)).resolves.toEqual({
      status: "failed",
      orderId: ORDER_ID,
    });
    expect(emailRows.get(EMAIL_ID)).toMatchObject({
      status: "failed",
      attempt_count: 2,
      error_message: "Email delivery is not configured.",
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("returns not found for an unknown queue row", async () => {
    await expect(
      retryFailedOrderEmail(
        "33333333-3333-4333-8333-333333333333",
      ),
    ).resolves.toEqual({
      status: "not_found",
      orderId: null,
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("swallows provider failures for webhook-driven order emails", async () => {
    emailRows.clear();
    mocks.send
      .mockResolvedValueOnce({
        data: null,
        error: {
          name: "rate_limit_exceeded",
          statusCode: 429,
          message: "Temporary provider failure.",
        },
      })
      .mockResolvedValueOnce({
        data: { id: "provider-seller-message" },
        error: null,
      });

    await expect(sendOrderStatusEmails(ORDER_ID)).resolves.toBeUndefined();

    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(
      emailRows.get("email-customer_order_confirmation"),
    ).toMatchObject({
      status: "failed",
      attempt_count: 1,
    });
    expect(
      emailRows.get("email-seller_order_notification"),
    ).toMatchObject({
      status: "sent",
      attempt_count: 1,
    });
  });

  it("redacts common credential shapes from stored error text", () => {
    const sanitized = sanitizeEmailErrorMessage(
      "https://user:password@example.com/send?api_key=secret-value Bearer token-value eyJabc.def.ghi",
    );

    expect(sanitized).not.toContain("password");
    expect(sanitized).not.toContain("secret-value");
    expect(sanitized).not.toContain("token-value");
    expect(sanitized).not.toContain("eyJabc.def.ghi");
    expect(sanitized).toBe(
      "Email delivery failed. Review the server logs before retrying.",
    );
  });
});

describe("shipping confirmation email", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    emailRows = new Map();
    allowPendingRetry = false;
    markFailedError = null;
    markSentError = null;
    order.order_status = "confirmed";
    order.fulfilment_status = "shipped";
    order.courier = "SF Express";
    order.tracking_number = "SF1234567890";
    mocks.createSupabaseServiceRoleClient.mockImplementation(
      createSupabaseClient,
    );
    mocks.getEmailConfig.mockReturnValue({
      resend: { emails: { send: mocks.send } },
      from: "Sombre <orders@example.com>",
      replyTo: "support@example.com",
      sellerEmail: "seller@example.com",
    });
    mocks.send.mockResolvedValue({
      data: { id: "provider-message-1" },
      error: null,
    });
    mocks.renderCustomerShippingConfirmation.mockReturnValue({
      subject: "shipped",
      html: "<p>shipped</p>",
      text: "shipped",
    });
  });

  it("sends a shipping confirmation using the order's current customer and shipment details", async () => {
    await sendShippingConfirmationEmail(ORDER_ID);

    expect(mocks.renderCustomerShippingConfirmation).toHaveBeenCalledWith(
      order,
      items,
    );
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "customer@example.com",
        subject: "shipped",
      }),
      { idempotencyKey: "sombre-email-email-shipping_confirmation" },
    );
    expect(
      emailRows.get("email-shipping_confirmation"),
    ).toMatchObject({
      status: "sent",
      email_kind: "shipping_confirmation",
      recipient: "customer@example.com",
    });
  });

  it("does not send when the order has no courier recorded", async () => {
    order.courier = null;

    await sendShippingConfirmationEmail(ORDER_ID);

    expect(mocks.send).not.toHaveBeenCalled();
    expect(emailRows.size).toBe(0);
  });

  it("does not send when the order has no tracking number recorded", async () => {
    order.tracking_number = null;

    await sendShippingConfirmationEmail(ORDER_ID);

    expect(mocks.send).not.toHaveBeenCalled();
    expect(emailRows.size).toBe(0);
  });

  it("does not send a second email when called again for the same order", async () => {
    await sendShippingConfirmationEmail(ORDER_ID);
    await sendShippingConfirmationEmail(ORDER_ID);

    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(
      emailRows.get("email-shipping_confirmation"),
    ).toMatchObject({ status: "sent", attempt_count: 1 });
  });

  it("records a retryable failure when Resend rejects the send, leaving the order's shipped state untouched", async () => {
    mocks.send.mockResolvedValue({
      data: null,
      error: {
        name: "invalid_recipient",
        statusCode: 422,
        message: "Invalid recipient address.",
      },
    });

    await sendShippingConfirmationEmail(ORDER_ID);

    expect(
      emailRows.get("email-shipping_confirmation"),
    ).toMatchObject({
      status: "failed",
      retry_disposition: "retryable",
    });
    // Sending never touches the orders table, so a delivery failure has no way
    // to change fulfilment_status back off 'shipped'.
    expect(order.fulfilment_status).toBe("shipped");
  });

  it("can be resent through the generic retry system after a provider failure", async () => {
    mocks.send.mockResolvedValueOnce({
      data: null,
      error: {
        name: "invalid_recipient",
        statusCode: 422,
        message: "Invalid recipient address.",
      },
    });

    await sendShippingConfirmationEmail(ORDER_ID);
    const emailId = emailRows.get("email-shipping_confirmation")!.id;

    expect(
      emailRows.get("email-shipping_confirmation"),
    ).toMatchObject({ status: "failed", retry_disposition: "retryable" });

    mocks.send.mockResolvedValueOnce({
      data: { id: "provider-retry-1" },
      error: null,
    });

    await expect(retryFailedOrderEmail(emailId)).resolves.toEqual({
      status: "sent",
      orderId: ORDER_ID,
    });
    expect(emailRows.get(emailId)).toMatchObject({ status: "sent" });
  });
});
