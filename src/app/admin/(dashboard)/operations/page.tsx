import Link from "next/link";
import type { ReactNode } from "react";

import { StatusBadge } from "@/components/admin/status-badge";
import {
  listUnresolvedWebhookFailures,
  listUnsentOrderEmails,
  type AdminUnsentEmail,
  type AdminWebhookFailure,
} from "@/lib/admin/operations";
import { formatStatusLabel } from "@/lib/admin/status-tone";
import { requireAdminUser } from "@/lib/supabase/admin-auth";

export const dynamic = "force-dynamic";

// Read-only in this phase. Nothing here retries, resolves, resends, or deletes:
// the page exists so an operator can see that something needs attention, and
// the settling itself still happens in Stripe, Resend, or the database.

function formatOperationsTimestamp(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("en-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// One labelled field inside a mobile card. The label stacks above the value on
// the narrowest screens so a long Stripe ID never squeezes into a sliver.
function CardField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-xs uppercase tracking-[0.18em] text-stone-500">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm text-stone-200 [overflow-wrap:anywhere]">
        {children}
      </dd>
    </div>
  );
}

// The short form matches the orders list, and the link is the way through to
// the full record. An unlinked failure says so rather than rendering a dead link.
function OrderLink({ orderId }: { orderId: string | null }) {
  if (!orderId) {
    return <span className="text-stone-500">Not linked</span>;
  }

  return (
    <Link
      href={`/admin/orders/${orderId}`}
      className="font-mono text-xs text-stone-300 underline underline-offset-4 transition-colors hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    >
      {orderId.slice(0, 8)}
    </Link>
  );
}

function QueueNotice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center text-sm text-stone-400">
      {children}
    </p>
  );
}

function SectionHeading({
  id,
  title,
  description,
  count,
  countLabel,
}: {
  id: string;
  title: string;
  description: string;
  count: number | null;
  countLabel: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id={id}
          className="text-xl font-medium tracking-[0.08em] text-stone-100 sm:text-2xl"
        >
          {title}
        </h2>
        {count === null ? null : (
          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
            {count} {countLabel}
          </p>
        )}
      </div>
      <p className="text-sm leading-6 text-stone-400">{description}</p>
    </div>
  );
}

type Queue<Row> = { rows: Row[]; hasError: boolean };

// Settled independently so a failure in one view still leaves the other one
// readable. The reason is logged server-side; the page only ever shows a fixed
// message, never the raw Supabase or Postgres error.
async function loadOperationsQueues(): Promise<{
  webhookFailures: Queue<AdminWebhookFailure>;
  unsentEmails: Queue<AdminUnsentEmail>;
}> {
  const [failuresResult, emailsResult] = await Promise.allSettled([
    listUnresolvedWebhookFailures(),
    listUnsentOrderEmails(),
  ]);

  if (failuresResult.status === "rejected") {
    console.error(
      "Failed to load webhook failures for /admin/operations:",
      failuresResult.reason,
    );
  }

  if (emailsResult.status === "rejected") {
    console.error(
      "Failed to load unsent order emails for /admin/operations:",
      emailsResult.reason,
    );
  }

  return {
    webhookFailures:
      failuresResult.status === "fulfilled"
        ? { rows: failuresResult.value, hasError: false }
        : { rows: [], hasError: true },
    unsentEmails:
      emailsResult.status === "fulfilled"
        ? { rows: emailsResult.value, hasError: false }
        : { rows: [], hasError: true },
  };
}

function WebhookFailuresSection({
  queue,
}: {
  queue: Queue<AdminWebhookFailure>;
}) {
  const { rows, hasError } = queue;

  return (
    <section aria-labelledby="webhook-failures-heading" className="space-y-4">
      <SectionHeading
        id="webhook-failures-heading"
        title="Webhook failures"
        description="Stripe deliveries that did not process. Retryable events may still clear themselves; permanent events need a person."
        count={hasError ? null : rows.length}
        countLabel="unresolved"
      />

      {hasError ? (
        <QueueNotice>
          Webhook failures could not be loaded. Please try again.
        </QueueNotice>
      ) : rows.length === 0 ? (
        <QueueNotice>No unresolved webhook failures.</QueueNotice>
      ) : (
        <>
          <ul aria-label="Webhook failures" className="space-y-3 lg:hidden">
            {rows.map((failure) => (
              <li
                key={failure.id}
                className="min-w-0 space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                  <span className="min-w-0 break-words text-sm text-stone-100 [overflow-wrap:anywhere]">
                    {failure.stripe_event_type}
                  </span>
                  <StatusBadge kind="webhook" value={failure.failure_kind} />
                </div>

                <dl className="space-y-3">
                  <CardField label="Event ID">
                    <span className="font-mono text-xs">
                      {failure.stripe_event_id}
                    </span>
                  </CardField>
                  <CardField label="Error">
                    {failure.error_summary ?? "—"}
                  </CardField>
                  <CardField label="Order">
                    <OrderLink orderId={failure.order_id} />
                  </CardField>
                  <CardField label="Attempts">
                    {failure.occurrence_count}
                  </CardField>
                  <CardField label="First failed">
                    {formatOperationsTimestamp(failure.first_failed_at)}
                  </CardField>
                  <CardField label="Last failed">
                    {formatOperationsTimestamp(failure.last_failed_at)}
                  </CardField>
                </dl>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-2xl border border-white/10 lg:block">
            <table className="w-full min-w-[62rem] border-collapse text-left text-sm">
              <caption className="sr-only">Webhook failures</caption>
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-stone-500">
                  <th className="px-4 py-4 font-normal">Event</th>
                  <th className="px-4 py-4 font-normal">Category</th>
                  <th className="px-4 py-4 font-normal">Error</th>
                  <th className="px-4 py-4 font-normal">Order</th>
                  <th className="px-4 py-4 font-normal">Attempts</th>
                  <th className="px-4 py-4 font-normal">First failed</th>
                  <th className="px-4 py-4 font-normal">Last failed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((failure) => (
                  <tr
                    key={failure.id}
                    className="border-b border-white/5 align-top transition-colors last:border-b-0 hover:bg-white/[0.03]"
                  >
                    <td className="max-w-[16rem] break-words px-4 py-4 text-stone-200 [overflow-wrap:anywhere]">
                      <span className="block">{failure.stripe_event_type}</span>
                      <span className="mt-1 block font-mono text-xs text-stone-500">
                        {failure.stripe_event_id}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge
                        kind="webhook"
                        value={failure.failure_kind}
                      />
                    </td>
                    <td className="max-w-[20rem] break-words px-4 py-4 text-stone-300 [overflow-wrap:anywhere]">
                      {failure.error_summary ?? "—"}
                    </td>
                    <td className="px-4 py-4">
                      <OrderLink orderId={failure.order_id} />
                    </td>
                    <td className="px-4 py-4 text-stone-200">
                      {failure.occurrence_count}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-stone-400">
                      {formatOperationsTimestamp(failure.first_failed_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-stone-400">
                      {formatOperationsTimestamp(failure.last_failed_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function UnsentEmailsSection({ queue }: { queue: Queue<AdminUnsentEmail> }) {
  const { rows, hasError } = queue;

  return (
    <section aria-labelledby="unsent-emails-heading" className="space-y-4">
      <SectionHeading
        id="unsent-emails-heading"
        title="Unsent emails"
        description="Transactional emails that have not reached their recipient. Payment, stock, and refunds are unaffected by these."
        count={hasError ? null : rows.length}
        countLabel="unsent"
      />

      {hasError ? (
        <QueueNotice>
          Unsent emails could not be loaded. Please try again.
        </QueueNotice>
      ) : rows.length === 0 ? (
        <QueueNotice>No unsent emails.</QueueNotice>
      ) : (
        <>
          <ul aria-label="Unsent emails" className="space-y-3 lg:hidden">
            {rows.map((email) => (
              <li
                key={email.id}
                className="min-w-0 space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                  <span className="min-w-0 break-words text-sm text-stone-100 [overflow-wrap:anywhere]">
                    {formatStatusLabel(email.email_kind)}
                  </span>
                  <StatusBadge kind="email" value={email.status} />
                </div>

                <dl className="space-y-3">
                  <CardField label="Order">
                    <OrderLink orderId={email.order_id} />
                  </CardField>
                  <CardField label="Recipient">{email.recipient}</CardField>
                  <CardField label="Attempts">{email.attempt_count}</CardField>
                  <CardField label="Last error">
                    {email.error_summary ?? "—"}
                  </CardField>
                  <CardField label="First attempted">
                    {formatOperationsTimestamp(email.first_attempt_at)}
                  </CardField>
                  <CardField label="Last attempted">
                    {formatOperationsTimestamp(email.last_attempt_at)}
                  </CardField>
                </dl>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-2xl border border-white/10 lg:block">
            <table className="w-full min-w-[62rem] border-collapse text-left text-sm">
              <caption className="sr-only">Unsent emails</caption>
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-stone-500">
                  <th className="px-4 py-4 font-normal">Order</th>
                  <th className="px-4 py-4 font-normal">Email</th>
                  <th className="px-4 py-4 font-normal">Recipient</th>
                  <th className="px-4 py-4 font-normal">Attempts</th>
                  <th className="px-4 py-4 font-normal">Last error</th>
                  <th className="px-4 py-4 font-normal">First attempted</th>
                  <th className="px-4 py-4 font-normal">Last attempted</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((email) => (
                  <tr
                    key={email.id}
                    className="border-b border-white/5 align-top transition-colors last:border-b-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-4">
                      <OrderLink orderId={email.order_id} />
                    </td>
                    <td className="max-w-[14rem] break-words px-4 py-4 text-stone-200 [overflow-wrap:anywhere]">
                      <span className="block">
                        {formatStatusLabel(email.email_kind)}
                      </span>
                      <span className="mt-2 block">
                        <StatusBadge kind="email" value={email.status} />
                      </span>
                    </td>
                    <td className="max-w-[16rem] break-words px-4 py-4 text-stone-300 [overflow-wrap:anywhere]">
                      {email.recipient}
                    </td>
                    <td className="px-4 py-4 text-stone-200">
                      {email.attempt_count}
                    </td>
                    <td className="max-w-[18rem] break-words px-4 py-4 text-stone-300 [overflow-wrap:anywhere]">
                      {email.error_summary ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-stone-400">
                      {formatOperationsTimestamp(email.first_attempt_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-stone-400">
                      {formatOperationsTimestamp(email.last_attempt_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export default async function AdminOperationsPage() {
  // Runs outside the settled loads below so a redirect is never swallowed.
  await requireAdminUser();

  const { webhookFailures, unsentEmails } = await loadOperationsQueues();

  const isEverythingClear =
    !webhookFailures.hasError &&
    !unsentEmails.hasError &&
    webhookFailures.rows.length === 0 &&
    unsentEmails.rows.length === 0;

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-medium tracking-[0.08em] text-stone-100 sm:text-3xl">
          Operations
        </h1>
        <p className="text-sm leading-6 text-stone-400">
          Everything still waiting on attention. This page is read-only.
        </p>
      </div>

      {isEverythingClear ? (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-12 text-center">
          <p className="text-sm text-stone-200">Nothing needs attention.</p>
          <p className="text-sm text-stone-400">
            No unresolved webhook failures and no unsent emails.
          </p>
        </div>
      ) : (
        <>
          <WebhookFailuresSection queue={webhookFailures} />
          <UnsentEmailsSection queue={unsentEmails} />
        </>
      )}
    </div>
  );
}
