import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260727010000_add_manual_order_email_retry.sql",
  import.meta.url,
);

async function migrationSql() {
  return (await readFile(migrationUrl, "utf8"))
    .replace(/\s+/g, " ")
    .toLowerCase();
}

describe("manual order email retry migration contract", () => {
  it("atomically claims a failed or safely stale row and returns authoritative delivery data", async () => {
    const sql = await migrationSql();

    expect(sql).toContain(
      "create or replace function public.claim_order_email_retry",
    );
    expect(sql).toContain("where emails.id = p_email_id");
    expect(sql).toContain("emails.status = 'failed'");
    expect(sql).toContain("emails.status = 'pending'");
    expect(sql).toContain(
      "emails.retry_disposition = 'retryable'",
    );
    expect(sql).toContain(
      "emails.retry_disposition = 'unclassified'",
    );
    expect(sql).toContain(
      "emails.retry_disposition = 'unclassified' and emails.has_ambiguous_outcome and emails.first_attempt_at > timezone('utc', now()) - interval '23 hours'",
    );
    expect(sql).not.toContain(
      "emails.retry_disposition = 'unclassified' and emails.has_ambiguous_outcome and emails.last_attempt_at > timezone('utc', now()) - interval '23 hours'",
    );
    expect(sql).toContain("interval '5 minutes'");
    expect(sql).toContain("interval '23 hours'");
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain(
      "attempt_count = emails.attempt_count + 1",
    );
    expect(sql).toContain(
      "last_attempt_at = timezone('utc', now())",
    );

    for (const field of [
      "emails.id",
      "emails.order_id",
      "emails.email_kind",
      "emails.recipient",
    ]) {
      expect(sql).toContain(field);
    }
  });

  it("keeps the claim private to the service role", async () => {
    const sql = await migrationSql();

    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
    expect(sql).toContain(
      "revoke execute on function public.claim_order_email_retry(uuid) from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.claim_order_email_retry(uuid) to service_role",
    );
    expect(sql).toContain(
      "revoke execute on function public.claim_order_email(uuid, text, text) from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.claim_order_email(uuid, text, text) to service_role",
    );
    expect(sql).toContain(
      "grant execute on function public.mark_order_email_retry_uncertain(uuid, text) to service_role",
    );
    expect(sql).toContain(
      "grant execute on function public.mark_order_email_failed_retryable(uuid, text) to service_role",
    );
    expect(sql).toContain(
      "grant execute on function public.mark_order_email_retry_blocked(uuid, text) to service_role",
    );
  });

  it("classifies definite, historical, and blocked failures separately", async () => {
    const sql = await migrationSql();

    expect(sql).toContain(
      "add column if not exists retry_disposition text not null default 'unclassified'",
    );
    expect(sql).toContain(
      "retry_disposition in ('unclassified', 'retryable', 'blocked')",
    );
    expect(sql).toContain(
      "add column if not exists has_ambiguous_outcome boolean not null default true",
    );
    expect(sql).toContain(
      "alter column has_ambiguous_outcome set default false",
    );
    expect(sql).toContain(
      "has_ambiguous_outcome = emails.has_ambiguous_outcome or emails.status = 'pending'",
    );
    expect(sql).toContain(
      "emails.retry_disposition = 'retryable' and not emails.has_ambiguous_outcome",
    );
    expect(sql).toContain(
      "create or replace function public.mark_order_email_failed_retryable(",
    );
    expect(sql).toContain("retry_disposition = 'retryable'");
    expect(sql).toContain(
      "create or replace function public.mark_order_email_retry_blocked(",
    );
    expect(sql).toContain("retry_disposition = 'blocked'");
    expect(sql).toContain(
      "create or replace function public.mark_order_email_failed(",
    );
    expect(sql).toContain("interval '23 hours'");
  });

  it("never promotes a row with an earlier ambiguous outcome", async () => {
    const sql = await migrationSql();
    const retryableFailure = sql
      .split(
        "create or replace function public.mark_order_email_failed_retryable(",
      )[1]
      ?.split(
        "create or replace function public.mark_order_email_retry_blocked(",
      )[0];
    const rollingFailure = sql
      .split(
        "create or replace function public.mark_order_email_failed(",
      )[1]
      ?.split(
        "create or replace function public.mark_order_email_failed_retryable(",
      )[0];

    expect(retryableFailure).toContain(
      "retry_disposition = case when has_ambiguous_outcome then 'unclassified' else 'retryable' end",
    );
    expect(retryableFailure).toContain("and status = 'pending'");
    expect(rollingFailure).toContain(
      "has_ambiguous_outcome = true",
    );
    expect(rollingFailure).toContain("and status = 'pending'");
  });

  it("bounds ordinary webhook reclaims of ambiguous pending sends", async () => {
    const sql = await migrationSql();
    const webhookClaim = sql
      .split(
        "create or replace function public.claim_order_email( p_order_id uuid,",
      )[1]
      ?.split(
        "create or replace function public.mark_order_email_retry_uncertain(",
      )[0];

    expect(webhookClaim).toBeDefined();
    expect(webhookClaim).toContain(
      "on conflict (order_id, email_kind) do update",
    );
    expect(webhookClaim).toContain("emails.status = 'failed'");
    expect(webhookClaim).toContain("emails.status = 'pending'");
    expect(webhookClaim).toContain("interval '5 minutes'");
    expect(webhookClaim).toContain("interval '23 hours'");
    expect(webhookClaim).not.toContain("emails.status <> 'sent'");
  });

  it("records an ambiguous outcome without reopening it as failed", async () => {
    const sql = await migrationSql();
    const uncertainFunction = sql.split(
      "create or replace function public.mark_order_email_retry_uncertain(",
    )[1];

    expect(uncertainFunction).toBeDefined();
    expect(uncertainFunction).toContain("status = 'pending'");
    expect(uncertainFunction).toContain(
      "retry_disposition = 'unclassified'",
    );
    expect(uncertainFunction).toContain(
      "error_message = left(",
    );
    expect(uncertainFunction).toContain(
      "and status = 'pending'",
    );
    expect(uncertainFunction).not.toContain("status = 'failed'");
  });

  it("exposes retry classification only through the server-side operations view", async () => {
    const sql = await migrationSql();

    expect(sql).toContain(
      "create or replace view public.unsent_order_emails with (security_invoker = true)",
    );
    expect(sql).toContain("emails.retry_disposition");
    expect(sql).toContain("emails.updated_at");
    expect(sql).toContain(
      "revoke all privileges on table public.unsent_order_emails from anon, authenticated",
    );
  });
});
