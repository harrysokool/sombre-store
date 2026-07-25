import { describe, expect, it } from "vitest";

import {
  formatStatusLabel,
  getStatusTone,
  STATUS_TONE_CLASSES,
  STATUS_TONES,
  type StatusKind,
  type StatusTone,
} from "@/lib/admin/status-tone";

// Every value the orders table check constraints allow, so a status that exists
// in the database can never quietly fall through to the neutral default.
const EXPECTED: Array<[StatusKind, string, StatusTone]> = [
  ["payment", "paid", "success"],
  ["payment", "no_payment_required", "success"],
  ["payment", "unpaid", "pending"],
  ["payment", "failed", "danger"],
  ["payment", "canceled", "neutral"],

  ["order", "confirmed", "success"],
  ["order", "pending", "pending"],
  ["order", "refund_pending", "pending"],
  ["order", "refunded", "danger"],
  ["order", "refund_failed", "danger"],
  ["order", "unfulfillable", "danger"],

  ["fulfilment", "delivered", "success"],
  ["fulfilment", "shipped", "success"],
  ["fulfilment", "processing", "pending"],
  ["fulfilment", "unfulfilled", "neutral"],

  ["refund", "succeeded", "danger"],
  ["refund", "pending", "pending"],
  ["refund", "requires_action", "pending"],
  ["refund", "failed", "danger"],
  ["refund", "canceled", "neutral"],
  ["refund", "not_required", "neutral"],

  ["coupon", "active", "success"],
  ["coupon", "inactive", "neutral"],

  ["webhook", "retryable", "pending"],
  ["webhook", "permanent", "danger"],

  ["email", "pending", "pending"],
  ["email", "failed", "danger"],
  ["email", "sent", "success"],
];

describe("admin status tone mapping", () => {
  it.each(EXPECTED)("maps %s status %s to the %s tone", (kind, value, tone) => {
    expect(getStatusTone(kind, value)).toBe(tone);
  });

  it("reads the same status differently per column", () => {
    // 'failed' is a payment problem; 'pending' is a normal waiting state. The
    // kind is what decides, so the same word can carry different meaning.
    expect(getStatusTone("payment", "failed")).toBe("danger");
    expect(getStatusTone("order", "pending")).toBe("pending");
    expect(getStatusTone("payment", "pending")).toBe("pending");
  });

  it("falls back to neutral for unknown or empty values", () => {
    expect(getStatusTone("order", "some_future_status")).toBe("neutral");
    expect(getStatusTone("payment", "")).toBe("neutral");
    expect(getStatusTone("fulfilment", "delivered_yesterday")).toBe("neutral");
  });

  it("never lets an unknown value read as success", () => {
    for (const kind of [
      "payment",
      "order",
      "fulfilment",
      "refund",
      "coupon",
      "webhook",
      "email",
    ] as const) {
      expect(getStatusTone(kind, "not_a_real_status")).not.toBe("success");
    }
  });

  it("tolerates casing and surrounding whitespace", () => {
    expect(getStatusTone("payment", " Paid ")).toBe("success");
    expect(getStatusTone("order", "REFUNDED")).toBe("danger");
  });

  it("gives every tone its own class set", () => {
    const classes = STATUS_TONES.map((tone) => STATUS_TONE_CLASSES[tone]);

    expect(classes).toHaveLength(4);
    expect(classes.every((value) => value.length > 0)).toBe(true);
    expect(new Set(classes).size).toBe(classes.length);
  });

  it("uses the existing admin palette for each tone", () => {
    expect(STATUS_TONE_CLASSES.success).toContain("emerald");
    expect(STATUS_TONE_CLASSES.pending).toContain("amber");
    expect(STATUS_TONE_CLASSES.danger).toContain("red");
    expect(STATUS_TONE_CLASSES.neutral).toContain("stone");
  });
});

describe("formatStatusLabel", () => {
  it("keeps a readable word for every status, so colour is never the only cue", () => {
    expect(formatStatusLabel("paid")).toBe("Paid");
    expect(formatStatusLabel("no_payment_required")).toBe(
      "No payment required",
    );
    expect(formatStatusLabel("requires_action")).toBe("Requires action");
    expect(formatStatusLabel("REFUND_PENDING")).toBe("Refund pending");
  });

  it("labels a missing status rather than rendering nothing", () => {
    expect(formatStatusLabel("")).toBe("Unknown");
    expect(formatStatusLabel("   ")).toBe("Unknown");
  });
});
