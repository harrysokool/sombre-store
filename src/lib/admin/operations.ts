import "server-only";

import {
  retryFailedOrderEmail,
  sanitizeEmailErrorMessage,
  type RetryOrderEmailResult,
} from "@/lib/email/order-emails";
import { getAdminUser } from "@/lib/supabase/admin-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

// The two operational queues, read from the Supabase views that already exist
// for them. Both views hold private order and customer data: they have no RLS
// policy and no grant to anon or authenticated, so they are reachable only
// through the service-role client used here. Never read them from the public
// browser client.
//
// Only the columns the operations page renders are selected. The views also
// join customer_email, total, payment_status and order_status from the order;
// those are deliberately left unread, because the queue only needs to say what
// failed, not restate the customer's purchase.

const WEBHOOK_FAILURE_COLUMNS =
  "id, stripe_event_id, stripe_event_type, order_id, error_message, failure_kind, occurrence_count, first_failed_at, last_failed_at";

const UNSENT_EMAIL_COLUMNS =
  "id, order_id, email_kind, recipient, status, error_message, attempt_count, first_attempt_at, last_attempt_at, retry_disposition, updated_at";

const QUEUE_LIMIT = 200;
const MAX_ERROR_SUMMARY_LENGTH = 240;
const EMAIL_CLAIM_LEASE_MS = 5 * 60 * 1_000;
// Resend retains an idempotency key for 24 hours. Stop offering retries one
// hour earlier so data loading and rendering cannot cross the provider limit.
const EMAIL_SAFE_RETRY_WINDOW_MS = 23 * 60 * 60 * 1_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AdminWebhookFailure = {
  id: string;
  stripe_event_id: string;
  stripe_event_type: string;
  order_id: string | null;
  error_summary: string | null;
  failure_kind: string;
  occurrence_count: number;
  first_failed_at: string;
  last_failed_at: string;
};

export type AdminUnsentEmail = {
  id: string;
  order_id: string;
  email_kind: string;
  recipient: string;
  status: string;
  error_summary: string | null;
  attempt_count: number;
  first_attempt_at: string;
  last_attempt_at: string;
  failure_at: string | null;
  retry_available: boolean;
  retry_blocked: boolean;
};

type WebhookFailureRow = Omit<AdminWebhookFailure, "error_summary"> & {
  error_message: string | null;
};

type UnsentEmailRow = Omit<
  AdminUnsentEmail,
  "error_summary" | "failure_at" | "retry_available" | "retry_blocked"
> & {
  error_message: string | null;
  retry_disposition: string;
  updated_at: string;
};

/**
 * Reduces a stored error to one readable line.
 *
 * A provider or Postgres error can carry a multi-line stack trace, and the
 * operator only needs the leading summary to know what went wrong. Collapsing
 * and truncating here rather than in the page means the untrimmed text never
 * leaves the server at all.
 */
export function summarizeErrorMessage(message: string | null | undefined) {
  const collapsed = (message ?? "").replace(/\s+/g, " ").trim();

  if (!collapsed) {
    return null;
  }

  return collapsed.length > MAX_ERROR_SUMMARY_LENGTH
    ? `${collapsed.slice(0, MAX_ERROR_SUMMARY_LENGTH)}…`
    : collapsed;
}

// These queues describe private orders, so every read re-checks the admin gate
// itself rather than trusting the caller. Throws instead of redirecting so a
// page's error handling cannot swallow a redirect signal.
async function assertAdmin() {
  const adminUser = await getAdminUser();

  if (!adminUser) {
    throw new Error(
      "Admin operations data requested without an approved session.",
    );
  }
}

export async function listUnresolvedWebhookFailures(): Promise<
  AdminWebhookFailure[]
> {
  await assertAdmin();

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("unresolved_webhook_failures")
    .select(WEBHOOK_FAILURE_COLUMNS)
    .order("last_failed_at", { ascending: false })
    .limit(QUEUE_LIMIT)
    .returns<WebhookFailureRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(({ error_message, ...failure }) => ({
    ...failure,
    error_summary: summarizeErrorMessage(error_message),
  }));
}

export async function listUnsentOrderEmails(): Promise<AdminUnsentEmail[]> {
  await assertAdmin();

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("unsent_order_emails")
    .select(UNSENT_EMAIL_COLUMNS)
    .order("last_attempt_at", { ascending: false })
    .limit(QUEUE_LIMIT)
    .returns<UnsentEmailRow[]>();

  if (error) {
    throw error;
  }

  const now = Date.now();

  return (data ?? []).map(
    ({ error_message, retry_disposition, updated_at, ...email }) => {
      const firstAttemptAt = Date.parse(email.first_attempt_at);
      const lastAttemptAt = Date.parse(email.last_attempt_at);
      const hasRetryableStaleClaim =
        email.status === "pending" &&
        Number.isFinite(firstAttemptAt) &&
        Number.isFinite(lastAttemptAt) &&
        now - lastAttemptAt > EMAIL_CLAIM_LEASE_MS &&
        now - firstAttemptAt < EMAIL_SAFE_RETRY_WINDOW_MS;

      const hasRetryableFailedDelivery =
        email.status === "failed" &&
        (retry_disposition === "retryable" ||
          (retry_disposition === "unclassified" &&
            Number.isFinite(firstAttemptAt) &&
            now - firstAttemptAt < EMAIL_SAFE_RETRY_WINDOW_MS));

      return {
        ...email,
        error_summary: summarizeErrorMessage(
          sanitizeEmailErrorMessage(error_message),
        ),
        failure_at: email.status === "failed" ? updated_at : null,
        retry_available:
          hasRetryableFailedDelivery || hasRetryableStaleClaim,
        retry_blocked: retry_disposition === "blocked",
      };
    },
  );
}

// Server Actions are directly callable, so this operation repeats the admin
// gate before the service-role email claim is created. Only the queue row ID is
// accepted; the database supplies the order, kind and recipient atomically.
export async function retryUnsentOrderEmail(
  emailId: string,
): Promise<RetryOrderEmailResult> {
  await assertAdmin();

  if (!UUID_PATTERN.test(emailId)) {
    return { status: "not_found", orderId: null };
  }

  return retryFailedOrderEmail(emailId);
}
