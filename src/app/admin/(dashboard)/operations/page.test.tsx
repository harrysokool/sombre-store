// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminUser: vi.fn(),
  listUnresolvedWebhookFailures: vi.fn(),
  listUnsentOrderEmails: vi.fn(),
}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  requireAdminUser: mocks.requireAdminUser,
}));

vi.mock("@/lib/admin/operations", () => ({
  listUnresolvedWebhookFailures: mocks.listUnresolvedWebhookFailures,
  listUnsentOrderEmails: mocks.listUnsentOrderEmails,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import AdminOperationsPage from "./page";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ORDER_ID = "22222222-2222-4222-8222-222222222222";

// 2026-07-24T20:00:00Z is still 24 July in UTC but already 25 July in
// Asia/Hong_Kong (UTC+8), so asserting the shifted day proves the explicit
// timeZone option is applied.
const FAILURE = {
  id: "failure-1",
  stripe_event_id: "evt_1PsombreTESTeventidentifier",
  stripe_event_type: "refund.updated",
  order_id: ORDER_ID,
  error_summary: "Stripe refund could not be linked to a Sombre order.",
  failure_kind: "permanent",
  occurrence_count: 3,
  first_failed_at: "2026-07-24T20:00:00.000Z",
  last_failed_at: "2026-07-24T22:30:00.000Z",
};

const EMAIL = {
  id: "email-1",
  order_id: OTHER_ORDER_ID,
  email_kind: "customer_order_confirmation",
  recipient: "customer@example.com",
  status: "failed",
  error_summary: "The sender domain is not verified.",
  attempt_count: 2,
  first_attempt_at: "2026-07-24T20:00:00.000Z",
  last_attempt_at: "2026-07-24T21:15:00.000Z",
};

// Both queues render twice on purpose: stacked cards for small screens and a
// table from `lg` up. Every assertion scopes to one presentation of one
// section, so a value can never be found in the wrong place.
function failureCards() {
  return within(screen.getByRole("list", { name: "Webhook failures" }));
}

function failureTable() {
  return within(screen.getByRole("table", { name: "Webhook failures" }));
}

function emailCards() {
  return within(screen.getByRole("list", { name: "Unsent emails" }));
}

function emailTable() {
  return within(screen.getByRole("table", { name: "Unsent emails" }));
}

describe("admin operations page", () => {
  beforeEach(() => {
    mocks.requireAdminUser.mockReset();
    mocks.listUnresolvedWebhookFailures.mockReset();
    mocks.listUnsentOrderEmails.mockReset();
    mocks.requireAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
    mocks.listUnresolvedWebhookFailures.mockResolvedValue([]);
    mocks.listUnsentOrderEmails.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("checks admin authentication before reading either queue", async () => {
    mocks.requireAdminUser.mockRejectedValue(
      new Error("redirect to admin login"),
    );

    await expect(AdminOperationsPage()).rejects.toThrow(
      "redirect to admin login",
    );
    expect(mocks.listUnresolvedWebhookFailures).not.toHaveBeenCalled();
    expect(mocks.listUnsentOrderEmails).not.toHaveBeenCalled();
  });

  it("shows a single clear empty state when both queues are empty", async () => {
    render(await AdminOperationsPage());

    expect(screen.getByText("Nothing needs attention.")).toBeInTheDocument();
    expect(
      screen.getByText("No unresolved webhook failures and no unsent emails."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("list", { name: "Webhook failures" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Unsent emails" })).toBeNull();
  });

  it("keeps both sections separate when only one queue has rows", async () => {
    mocks.listUnresolvedWebhookFailures.mockResolvedValue([FAILURE]);

    render(await AdminOperationsPage());

    expect(
      screen.getByRole("heading", { name: "Webhook failures" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Unsent emails" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No unsent emails.")).toBeInTheDocument();
    expect(screen.queryByText("Nothing needs attention.")).toBeNull();
  });

  it("renders every webhook failure field in the desktop table", async () => {
    mocks.listUnresolvedWebhookFailures.mockResolvedValue([FAILURE]);

    render(await AdminOperationsPage());

    const table = failureTable();

    for (const header of [
      "Event",
      "Category",
      "Error",
      "Order",
      "Attempts",
      "First failed",
      "Last failed",
    ]) {
      expect(
        table.getByRole("columnheader", { name: header }),
      ).toBeInTheDocument();
    }

    expect(table.getByText("refund.updated")).toBeInTheDocument();
    expect(
      table.getByText("evt_1PsombreTESTeventidentifier"),
    ).toBeInTheDocument();
    expect(table.getByText("Permanent")).toBeInTheDocument();
    expect(
      table.getByText(
        "Stripe refund could not be linked to a Sombre order.",
      ),
    ).toBeInTheDocument();
    expect(table.getByText("3")).toBeInTheDocument();
    expect(table.getAllByText(/25 Jul 2026/)).toHaveLength(2);
  });

  it("renders every unsent email field in the desktop table", async () => {
    mocks.listUnsentOrderEmails.mockResolvedValue([EMAIL]);

    render(await AdminOperationsPage());

    const table = emailTable();

    for (const header of [
      "Order",
      "Email",
      "Recipient",
      "Attempts",
      "Last error",
      "First attempted",
      "Last attempted",
    ]) {
      expect(
        table.getByRole("columnheader", { name: header }),
      ).toBeInTheDocument();
    }

    expect(
      table.getByText("Customer order confirmation"),
    ).toBeInTheDocument();
    expect(table.getByText("Failed")).toBeInTheDocument();
    expect(table.getByText("customer@example.com")).toBeInTheDocument();
    expect(table.getByText("2")).toBeInTheDocument();
    expect(
      table.getByText("The sender domain is not verified."),
    ).toBeInTheDocument();
    expect(table.getAllByText(/25 Jul 2026/)).toHaveLength(2);
  });

  it("stacks both queues into cards for small screens", async () => {
    mocks.listUnresolvedWebhookFailures.mockResolvedValue([FAILURE]);
    mocks.listUnsentOrderEmails.mockResolvedValue([EMAIL]);

    render(await AdminOperationsPage());

    const failureCard = within(failureCards().getAllByRole("listitem")[0]);
    expect(failureCard.getByText("refund.updated")).toBeInTheDocument();
    expect(failureCard.getByText("Event ID")).toBeInTheDocument();
    expect(failureCard.getByText("Permanent")).toBeInTheDocument();
    expect(failureCard.getByText("Attempts")).toBeInTheDocument();
    expect(failureCard.getByText("First failed")).toBeInTheDocument();
    expect(failureCard.getByText("Last failed")).toBeInTheDocument();

    const emailCard = within(emailCards().getAllByRole("listitem")[0]);
    expect(
      emailCard.getByText("Customer order confirmation"),
    ).toBeInTheDocument();
    expect(emailCard.getByText("Recipient")).toBeInTheDocument();
    expect(emailCard.getByText("customer@example.com")).toBeInTheDocument();
    expect(emailCard.getByText("Last error")).toBeInTheDocument();
    expect(emailCard.getByText("First attempted")).toBeInTheDocument();
    expect(emailCard.getByText("Last attempted")).toBeInTheDocument();
  });

  it("hides the cards at desktop widths and the tables below them", async () => {
    mocks.listUnresolvedWebhookFailures.mockResolvedValue([FAILURE]);
    mocks.listUnsentOrderEmails.mockResolvedValue([EMAIL]);

    render(await AdminOperationsPage());

    // Only one presentation is visible at any width, so the two can never
    // overlap on screen.
    for (const name of ["Webhook failures", "Unsent emails"]) {
      expect(screen.getByRole("list", { name })).toHaveClass("lg:hidden");
      expect(screen.getByRole("table", { name }).parentElement).toHaveClass(
        "hidden",
        "lg:block",
      );
    }
  });

  it("links each queue row to its admin order page", async () => {
    mocks.listUnresolvedWebhookFailures.mockResolvedValue([FAILURE]);
    mocks.listUnsentOrderEmails.mockResolvedValue([EMAIL]);

    render(await AdminOperationsPage());

    expect(
      failureTable().getByRole("link", { name: "11111111" }),
    ).toHaveAttribute("href", `/admin/orders/${ORDER_ID}`);
    expect(
      failureCards().getByRole("link", { name: "11111111" }),
    ).toHaveAttribute("href", `/admin/orders/${ORDER_ID}`);
    expect(
      emailTable().getByRole("link", { name: "22222222" }),
    ).toHaveAttribute("href", `/admin/orders/${OTHER_ORDER_ID}`);
    expect(
      emailCards().getByRole("link", { name: "22222222" }),
    ).toHaveAttribute("href", `/admin/orders/${OTHER_ORDER_ID}`);
  });

  it("says so instead of linking when a failure has no order", async () => {
    mocks.listUnresolvedWebhookFailures.mockResolvedValue([
      { ...FAILURE, order_id: null },
    ]);

    render(await AdminOperationsPage());

    expect(failureTable().getByText("Not linked")).toBeInTheDocument();
    expect(
      failureTable().queryByRole("link", { name: /^[0-9a-f]{8}$/ }),
    ).toBeNull();
  });

  it("tones each queue status while keeping its word readable", async () => {
    mocks.listUnresolvedWebhookFailures.mockResolvedValue([
      FAILURE,
      { ...FAILURE, id: "failure-2", failure_kind: "retryable" },
    ]);
    mocks.listUnsentOrderEmails.mockResolvedValue([
      EMAIL,
      { ...EMAIL, id: "email-2", status: "pending" },
    ]);

    render(await AdminOperationsPage());

    expect(failureTable().getByText("Permanent")).toHaveAttribute(
      "data-tone",
      "danger",
    );
    expect(failureTable().getByText("Retryable")).toHaveAttribute(
      "data-tone",
      "pending",
    );
    expect(emailTable().getByText("Failed")).toHaveAttribute(
      "data-tone",
      "danger",
    );
    expect(emailTable().getByText("Pending")).toHaveAttribute(
      "data-tone",
      "pending",
    );
  });

  it("wraps long Stripe IDs and error summaries instead of forcing scroll", async () => {
    const longEventId = `evt_${"1a2b3c4d5e".repeat(6)}`;
    const longError =
      "Stripe rejected the refund request because the payment intent has already been fully refunded by an earlier delivery of this same event.";

    mocks.listUnresolvedWebhookFailures.mockResolvedValue([
      { ...FAILURE, stripe_event_id: longEventId, error_summary: longError },
    ]);
    mocks.listUnsentOrderEmails.mockResolvedValue([
      { ...EMAIL, error_summary: longError },
    ]);

    render(await AdminOperationsPage());

    const eventCell = failureTable().getByText(longEventId).closest("td");
    expect(eventCell).toHaveClass("break-words", "[overflow-wrap:anywhere]");
    expect(eventCell).toHaveClass("max-w-[16rem]");

    const errorCell = failureTable().getByText(longError).closest("td");
    expect(errorCell).toHaveClass("break-words", "[overflow-wrap:anywhere]");

    const cardValue = failureCards().getByText(longError).closest("dd");
    expect(cardValue).toHaveClass("break-words", "[overflow-wrap:anywhere]");
    expect(cardValue).toHaveClass("min-w-0");

    expect(emailTable().getByText(longError).closest("td")).toHaveClass(
      "break-words",
      "[overflow-wrap:anywhere]",
    );
  });

  it("formats every timestamp in Hong Kong time regardless of the host timezone", async () => {
    mocks.listUnresolvedWebhookFailures.mockResolvedValue([FAILURE]);
    mocks.listUnsentOrderEmails.mockResolvedValue([EMAIL]);

    render(await AdminOperationsPage());

    // 20:00Z -> 04:00 the next day in Hong Kong; 22:30Z -> 06:30 the next day.
    expect(failureTable().getByText("25 Jul 2026, 4:00 am")).toBeInTheDocument();
    expect(failureTable().getByText("25 Jul 2026, 6:30 am")).toBeInTheDocument();
    expect(emailTable().getByText("25 Jul 2026, 4:00 am")).toBeInTheDocument();
    expect(emailTable().getByText("25 Jul 2026, 5:15 am")).toBeInTheDocument();
  });

  it("shows a safe message for a failed query without exposing the raw error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.listUnresolvedWebhookFailures.mockRejectedValue(
      new Error('relation "unresolved_webhook_failures" does not exist'),
    );
    mocks.listUnsentOrderEmails.mockResolvedValue([EMAIL]);

    render(await AdminOperationsPage());

    expect(
      screen.getByText("Webhook failures could not be loaded. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/does not exist/)).toBeNull();
    expect(screen.queryByText(/relation/)).toBeNull();

    // The other section is unaffected by its neighbour's failure.
    expect(emailTable().getByText("customer@example.com")).toBeInTheDocument();
  });

  it("keeps the failing section from hiding a healthy neighbour in either direction", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.listUnresolvedWebhookFailures.mockResolvedValue([FAILURE]);
    mocks.listUnsentOrderEmails.mockRejectedValue(new Error("supabase down"));

    render(await AdminOperationsPage());

    expect(
      screen.getByText("Unsent emails could not be loaded. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/supabase down/)).toBeNull();
    expect(failureTable().getByText("refund.updated")).toBeInTheDocument();
  });

  it("stays read-only, offering no retry, resolve, resend, or delete control", async () => {
    mocks.listUnresolvedWebhookFailures.mockResolvedValue([FAILURE]);
    mocks.listUnsentOrderEmails.mockResolvedValue([EMAIL]);

    render(await AdminOperationsPage());

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(document.querySelector("form")).toBeNull();
  });

  it("keeps informational labels off the failing low-contrast class", async () => {
    mocks.listUnresolvedWebhookFailures.mockResolvedValue([FAILURE]);
    mocks.listUnsentOrderEmails.mockResolvedValue([
      { ...EMAIL, order_id: null },
    ]);

    render(await AdminOperationsPage());

    const countLabel = screen.getByText("1 unresolved");
    expect(countLabel.className).not.toContain("text-stone-500");
    expect(countLabel.className).toContain("text-stone-400");

    const headerRow = failureTable()
      .getByRole("columnheader", { name: "Event" })
      .closest("tr");
    expect(headerRow).not.toHaveClass("text-stone-500");
    expect(headerRow).toHaveClass("text-stone-400");

    const notLinked = emailTable().getByText("Not linked");
    expect(notLinked.className).not.toContain("text-stone-500");
    expect(notLinked.className).toContain("text-stone-400");
  });
});
