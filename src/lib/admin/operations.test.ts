import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createSupabase: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  getAdminUser: mocks.getAdminUser,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: mocks.createSupabase,
}));

import {
  listUnresolvedWebhookFailures,
  listUnsentOrderEmails,
  summarizeErrorMessage,
} from "./operations";

type QueryResult = {
  data?: unknown;
  error?: unknown;
};

// Records the query the data layer builds, so the selected view and columns can
// be asserted without a database.
function stubClient(result: QueryResult = {}) {
  const calls: { from?: string; select?: string } = {};
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
  };

  const builder = {
    select: vi.fn((columns: string) => {
      calls.select = columns;
      return builder;
    }),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    returns: vi.fn(() => Promise.resolve(resolved)),
  };

  const client = {
    from: vi.fn((table: string) => {
      calls.from = table;
      return builder;
    }),
  };

  mocks.createSupabase.mockReturnValue(client);

  return { calls, client };
}

const FAILURE_ROW = {
  id: "failure-1",
  stripe_event_id: "evt_1",
  stripe_event_type: "refund.updated",
  order_id: "11111111-1111-4111-8111-111111111111",
  error_message: "Refund could not be linked.",
  failure_kind: "permanent",
  occurrence_count: 2,
  first_failed_at: "2026-07-24T20:00:00.000Z",
  last_failed_at: "2026-07-24T22:00:00.000Z",
};

const EMAIL_ROW = {
  id: "email-1",
  order_id: "11111111-1111-4111-8111-111111111111",
  email_kind: "customer_order_confirmation",
  recipient: "customer@example.com",
  status: "failed",
  error_message: "Sender domain unverified.",
  attempt_count: 3,
  first_attempt_at: "2026-07-24T20:00:00.000Z",
  last_attempt_at: "2026-07-24T21:00:00.000Z",
};

describe("admin operations data layer", () => {
  beforeEach(() => {
    mocks.getAdminUser.mockReset();
    mocks.createSupabase.mockReset();
    mocks.getAdminUser.mockResolvedValue({ id: "admin-1" });
  });

  it("refuses to read either queue without an approved admin session", async () => {
    mocks.getAdminUser.mockResolvedValue(null);
    stubClient({ data: [] });

    await expect(listUnresolvedWebhookFailures()).rejects.toThrow(
      "Admin operations data requested without an approved session.",
    );
    await expect(listUnsentOrderEmails()).rejects.toThrow(
      "Admin operations data requested without an approved session.",
    );
    expect(mocks.createSupabase).not.toHaveBeenCalled();
  });

  it("reads webhook failures from the view with the service-role client", async () => {
    const { calls } = stubClient({ data: [FAILURE_ROW] });

    const failures = await listUnresolvedWebhookFailures();

    expect(mocks.createSupabase).toHaveBeenCalled();
    expect(calls.from).toBe("unresolved_webhook_failures");
    expect(failures).toHaveLength(1);
    expect(failures[0].stripe_event_id).toBe("evt_1");
    expect(failures[0].error_summary).toBe("Refund could not be linked.");
  });

  it("reads unsent emails from the view with the service-role client", async () => {
    const { calls } = stubClient({ data: [EMAIL_ROW] });

    const emails = await listUnsentOrderEmails();

    expect(calls.from).toBe("unsent_order_emails");
    expect(emails).toHaveLength(1);
    expect(emails[0].recipient).toBe("customer@example.com");
    expect(emails[0].error_summary).toBe("Sender domain unverified.");
  });

  it("never selects the customer columns the queue does not need", async () => {
    const { calls } = stubClient({ data: [] });

    await listUnresolvedWebhookFailures();

    // The view joins these from the order; the queue only reports what failed.
    expect(calls.select).not.toContain("customer_email");
    expect(calls.select).not.toContain("total");
    expect(calls.select).toContain("stripe_event_id");
  });

  it("returns an empty queue rather than null when the view has no rows", async () => {
    stubClient({ data: null });

    await expect(listUnresolvedWebhookFailures()).resolves.toEqual([]);
  });

  it("surfaces a query error to the caller", async () => {
    stubClient({ error: { message: "boom" } });

    await expect(listUnresolvedWebhookFailures()).rejects.toEqual({
      message: "boom",
    });
  });

  it("drops the raw error message in favour of a summary", async () => {
    stubClient({ data: [FAILURE_ROW] });

    const [failure] = await listUnresolvedWebhookFailures();

    expect(failure).not.toHaveProperty("error_message");
    expect(failure).toHaveProperty("error_summary");
  });
});

describe("summarizeErrorMessage", () => {
  it("collapses a multi-line stack trace into one readable line", () => {
    const summary = summarizeErrorMessage(
      "Send failed\n    at sendEmail (/app/src/lib/email.ts:42:11)\n    at async handler",
    );

    expect(summary).toBe(
      "Send failed at sendEmail (/app/src/lib/email.ts:42:11) at async handler",
    );
    expect(summary).not.toContain("\n");
  });

  it("truncates a very long message", () => {
    const summary = summarizeErrorMessage("x".repeat(500));

    expect(summary).toHaveLength(241);
    expect(summary?.endsWith("…")).toBe(true);
  });

  it("keeps a short message untouched", () => {
    expect(summarizeErrorMessage("Sender domain unverified.")).toBe(
      "Sender domain unverified.",
    );
  });

  it("reports nothing for a missing or blank message", () => {
    expect(summarizeErrorMessage(null)).toBeNull();
    expect(summarizeErrorMessage(undefined)).toBeNull();
    expect(summarizeErrorMessage("   \n  ")).toBeNull();
  });
});
